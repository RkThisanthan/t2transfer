import { z } from "zod";
import {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RESERVATION_STATUSES,
  SITES,
  TRIP_TYPES,
  VEHICLE_CLASSES,
} from "@/server/db/schema";

// Accepts "2026-12-05T10:30" (datetime-local / ISO without zone) or "2026-12-05 10:30[:00]".
// Journey times are Paris local wall-clock times, stored without conversion.
const localDateTime = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, "Use date and time, e.g. 2026-12-05 10:30")
  .transform((v) => {
    const [d, t] = v.replace("T", " ").split(" ");
    return `${d} ${t.length === 5 ? `${t}:00` : t}`;
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const count = (max: number) =>
  z.coerce.number({ error: "Enter a whole number" }).int("Enter a whole number").min(0, "Cannot be negative").max(max, `At most ${max}`);
const amount = z.coerce.number().min(0).max(100000).multipleOf(0.01);

const legSchema = z.object({
  pickupLocationId: z.coerce.number().int().positive().optional().nullable(),
  pickupAddress: optionalText(500),
  dropLocationId: z.coerce.number().int().positive().optional().nullable(),
  dropAddress: optionalText(500),
  pickupAt: localDateTime.optional().nullable(),
  flightNo: optionalText(30),
  flightCity: optionalText(100),
  flightAt: localDateTime.optional().nullable(),
  rate: amount.default(0),
  nightCharge: amount.default(0),
  vatRate: z.coerce.number().min(0, "Cannot be negative").max(30, "At most 30%").default(0),
});
export type LegInput = z.infer<typeof legSchema>;

const baseSchema = z.object({
  site: z.enum(SITES, { error: "Choose a site" }),
  tripType: z.enum(TRIP_TYPES, { error: `Trip type must be one of: ${TRIP_TYPES.join(", ")}` }),
  title: z.enum(["Mr", "Mrs", "Ms", ""], { error: "Title must be Mr, Mrs or Ms" }).optional().transform((v) => (v ? v : null)),
  firstName: z.string({ error: "Enter the first name" }).trim().min(1, "Enter the first name").max(100),
  lastName: z.string({ error: "Enter the last name" }).trim().min(1, "Enter the last name").max(100),
  email: z.string({ error: "Enter a valid email" }).trim().toLowerCase().pipe(z.email("Enter a valid email")),
  phoneCode: optionalText(12),
  phone: optionalText(40),
  adults: z.preprocess((v) => (v === undefined || v === "" ? undefined : v), z.coerce.number({ error: "Enter the number of adults" }).int().min(1, "At least 1 adult").max(60)),
  children: count(60).default(0),
  babies: count(60).default(0),
  luggageSmall: count(60).default(0),
  luggageLarge: count(60).default(0),
  luggageXl: count(60).default(0),
  trolleys: count(20).default(0),
  vehicleClass: z.enum(VEHICLE_CLASSES).default("economy"),
  voucherCode: optionalText(60),
  clientComments: optionalText(2000),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  arrival: legSchema.optional(),
  departure: legSchema.optional(),
  single: legSchema.optional(),
});

/** Admin users can also set status, money and payment fields. */
export const adminReservationSchema = baseSchema
  .extend({
    status: z.enum(RESERVATION_STATUSES).default("pending"),
    upgradeCost: amount.default(0),
    discount: amount.default(0),
    paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable().or(z.literal("").transform(() => null)),
    paymentStatus: z.enum(PAYMENT_STATUSES).default("unpaid"),
    specialNotes: optionalText(2000),
  })
  .superRefine(checkLegs);

/** The public Booking API: no status, prices or payment fields (the server decides those). */
export const publicBookingSchema = baseSchema
  .omit({ site: true })
  .extend({
    arrival: legSchema.omit({ rate: true, nightCharge: true, vatRate: true }).optional(),
    departure: legSchema.omit({ rate: true, nightCharge: true, vatRate: true }).optional(),
    single: legSchema.omit({ rate: true, nightCharge: true, vatRate: true }).optional(),
  })
  .superRefine(checkLegs);

export type AdminReservationInput = z.infer<typeof adminReservationSchema>;
export type PublicBookingInput = z.infer<typeof publicBookingSchema>;

export const LEGS_FOR_TRIP = {
  arrival: ["arrival"],
  departure: ["departure"],
  arrival_departure: ["arrival", "departure"],
  single: ["single"],
} as const;

type LegShape = { pickupLocationId?: number | null; pickupAddress?: string | null; dropLocationId?: number | null; dropAddress?: string | null; pickupAt?: string | null; flightAt?: string | null };

function checkLegs(
  data: { tripType: (typeof TRIP_TYPES)[number]; arrival?: LegShape; departure?: LegShape; single?: LegShape },
  ctx: z.RefinementCtx,
) {
  for (const kind of LEGS_FOR_TRIP[data.tripType]) {
    const leg = data[kind];
    const path = [kind];
    if (!leg) {
      ctx.addIssue({ code: "custom", path, message: `Enter the ${kind} transfer details` });
      continue;
    }
    if (!leg.pickupLocationId && !leg.pickupAddress)
      ctx.addIssue({ code: "custom", path: [...path, "pickupLocationId"], message: "Choose a pickup place or enter an address" });
    if (!leg.dropLocationId && !leg.dropAddress)
      ctx.addIssue({ code: "custom", path: [...path, "dropLocationId"], message: "Choose a drop place or enter an address" });
    if (kind === "arrival" && !leg.flightAt)
      ctx.addIssue({ code: "custom", path: [...path, "flightAt"], message: "Enter the arrival flight date and time" });
    if (kind !== "arrival" && !leg.pickupAt)
      ctx.addIssue({ code: "custom", path: [...path, "pickupAt"], message: "Enter the pickup date and time" });
  }
}
