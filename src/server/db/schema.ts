import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Foundation tables from the Phase 1 spec, Section 5.1. All times are stored in UTC.

const timestamps = {
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: datetime("updated_at", { mode: "date" })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
    .$onUpdate(() => new Date()),
};

export const users = mysqlTable(
  "users",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    username: varchar("username", { length: 60 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    passwordHash: varchar("password_hash", { length: 100 }).notNull(),
    status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
    failedLoginCount: int("failed_login_count").notNull().default(0),
    lockedUntil: datetime("locked_until", { mode: "date" }),
    lastLoginAt: datetime("last_login_at", { mode: "date" }),
    ...timestamps,
    deletedAt: datetime("deleted_at", { mode: "date" }),
  },
  (t) => [uniqueIndex("users_username_unique").on(t.username), uniqueIndex("users_email_unique").on(t.email)],
);

export const roles = mysqlTable(
  "roles",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    key: varchar("key", { length: 50 }).notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 255 }),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("roles_key_unique").on(t.key)],
);

export const permissions = mysqlTable(
  "permissions",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    key: varchar("key", { length: 100 }).notNull(),
    module: varchar("module", { length: 50 }).notNull(),
    description: varchar("description", { length: 255 }),
  },
  (t) => [uniqueIndex("permissions_key_unique").on(t.key)],
);

export const roleUser = mysqlTable(
  "role_user",
  {
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: int("role_id", { unsigned: true })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const permissionRole = mysqlTable(
  "permission_role",
  {
    roleId: int("role_id", { unsigned: true })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: int("permission_id", { unsigned: true })
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

// Sessions: the cookie holds a random token; only its SHA-256 hash is stored here.
export const sessions = mysqlTable(
  "sessions",
  {
    id: char("id", { length: 64 }).primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    remember: boolean("remember").notNull().default(false),
    expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
    lastSeenAt: datetime("last_seen_at", { mode: "date" }).notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const loginEvents = mysqlTable(
  "login_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
    usernameTried: varchar("username_tried", { length: 190 }),
    event: mysqlEnum("event", ["login", "logout", "failed", "locked", "blocked_ip"]).notNull(),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("login_events_user_idx").on(t.userId, t.createdAt),
    index("login_events_ip_idx").on(t.ip, t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;

// ---------------------------------------------------------------------------
// Reference data (spec Section 5.2), imported from the legacy database.

export const locationTypes = mysqlTable("location_types", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  sortOrder: int("sort_order").notNull().default(100),
  legacyId: int("legacy_id"),
});

export const locations = mysqlTable(
  "locations",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 190 }).notNull(),
    locationTypeId: int("location_type_id", { unsigned: true })
      .notNull()
      .references(() => locationTypes.id),
    sortOrder: int("sort_order").notNull().default(10000),
    isActive: boolean("is_active").notNull().default(true),
    legacyId: int("legacy_id"),
    ...timestamps,
  },
  (t) => [index("locations_type_idx").on(t.locationTypeId), uniqueIndex("locations_legacy_unique").on(t.legacyId)],
);

export const phoneCountryCodes = mysqlTable("phone_country_codes", {
  id: int("id", { unsigned: true }).autoincrement().primaryKey(),
  country: varchar("country", { length: 120 }).notNull(),
  code: varchar("code", { length: 12 }).notNull(),
  priority: int("priority").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Reservations (spec Section 4.5 and 5.2).
// Journey times (pickup_at, flight_at) are Paris local wall-clock times, stored as given,
// with no time-zone conversion. Audit and system timestamps are UTC.

// Site codes exactly as the legacy `site_name` column uses them (an empty legacy value means "T2").
// Stored as varchar so a new site needs no migration; names of IT, TIT2 and PD-SP are to confirm.
export const SITES = ["T2", "T2ES", "T2IT", "T2UK", "T2FR", "IT", "TIT2", "PAP", "PD", "PD-SP"] as const;
export const TRIP_TYPES = ["arrival", "departure", "arrival_departure", "single"] as const;
export const RESERVATION_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export const VEHICLE_CLASSES = ["economy", "business"] as const;
export const PAYMENT_METHODS = ["cash", "card", "online", "bank"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export const LEG_KINDS = ["arrival", "departure", "single"] as const;

const money = (name: string) => decimal(name, { precision: 10, scale: 2, mode: "number" });

export const reservations = mysqlTable(
  "reservations",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reference: varchar("reference", { length: 40 }).notNull(),
    site: varchar("site", { length: 12 }).$type<(typeof SITES)[number]>().notNull(),
    source: mysqlEnum("source", ["admin", "api", "legacy"]).notNull(),
    tripType: mysqlEnum("trip_type", TRIP_TYPES).notNull(),
    status: mysqlEnum("status", RESERVATION_STATUSES).notNull().default("pending"),

    title: varchar("title", { length: 10 }),
    firstName: varchar("first_name", { length: 150 }).notNull(),
    lastName: varchar("last_name", { length: 150 }).notNull(),
    email: varchar("email", { length: 190 }).notNull(),
    phoneCode: varchar("phone_code", { length: 20 }),
    phone: varchar("phone", { length: 50 }),

    adults: int("adults").notNull().default(1),
    children: int("children").notNull().default(0),
    babies: int("babies").notNull().default(0),
    luggageSmall: int("luggage_small").notNull().default(0),
    luggageLarge: int("luggage_large").notNull().default(0),
    luggageXl: int("luggage_xl").notNull().default(0),
    trolleys: int("trolleys").notNull().default(0),

    vehicleClass: mysqlEnum("vehicle_class", VEHICLE_CLASSES).notNull().default("economy"),
    upgradeCost: money("upgrade_cost").notNull().default(0),
    voucherCode: varchar("voucher_code", { length: 60 }),
    discount: money("discount").notNull().default(0),
    total: money("total").notNull().default(0),
    currency: char("currency", { length: 3 }).notNull().default("EUR"),
    paymentMethod: mysqlEnum("payment_method", PAYMENT_METHODS),
    paymentStatus: mysqlEnum("payment_status", PAYMENT_STATUSES).notNull().default("unpaid"),

    clientComments: text("client_comments"),
    specialNotes: text("special_notes"),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),

    legacyId: int("legacy_id"),
    apiClientId: int("api_client_id", { unsigned: true }),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
    updatedBy: bigint("updated_by", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    deletedAt: datetime("deleted_at", { mode: "date" }),
  },
  (t) => [
    uniqueIndex("reservations_reference_unique").on(t.reference),
    index("reservations_created_idx").on(t.createdAt),
    index("reservations_status_idx").on(t.status),
    index("reservations_email_idx").on(t.email),
    index("reservations_legacy_idx").on(t.legacyId),
  ],
);

export const reservationLegs = mysqlTable(
  "reservation_legs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    reservationId: bigint("reservation_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", LEG_KINDS).notNull(),
    pickupLocationId: int("pickup_location_id", { unsigned: true }).references(() => locations.id),
    pickupAddress: varchar("pickup_address", { length: 1000 }),
    dropLocationId: int("drop_location_id", { unsigned: true }).references(() => locations.id),
    dropAddress: varchar("drop_address", { length: 1000 }),
    pickupAt: datetime("pickup_at", { mode: "string" }),
    flightNo: varchar("flight_no", { length: 50 }),
    flightCity: varchar("flight_city", { length: 100 }),
    flightAt: datetime("flight_at", { mode: "string" }),
    rate: money("rate").notNull().default(0),
    nightCharge: money("night_charge").notNull().default(0),
    // VAT percentage for this transfer (legacy atva/dtva: 10 or 20). Informational until the VAT rule is confirmed.
    vatRate: decimal("vat_rate", { precision: 5, scale: 2, mode: "number" }).notNull().default(0),
  },
  (t) => [
    uniqueIndex("reservation_legs_kind_unique").on(t.reservationId, t.kind),
    index("reservation_legs_pickup_at_idx").on(t.pickupAt),
    index("reservation_legs_flight_at_idx").on(t.flightAt),
  ],
);

// One row per day; the counter gives T2-YYMMDD-NNNN references without race conditions.
export const referenceCounters = mysqlTable("reference_counters", {
  day: char("day", { length: 6 }).primaryKey(),
  lastValue: int("last_value").notNull().default(0),
});

// ---------------------------------------------------------------------------
// Audit log (P1-AUD) and Booking API clients (Section 6.1).

export const apiClients = mysqlTable(
  "api_clients",
  {
    id: int("id", { unsigned: true }).autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    site: varchar("site", { length: 12 }).$type<(typeof SITES)[number]>().notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    keyHash: char("key_hash", { length: 64 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastUsedAt: datetime("last_used_at", { mode: "date" }),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("api_clients_key_hash_unique").on(t.keyHash)],
);

export const idempotencyKeys = mysqlTable(
  "idempotency_keys",
  {
    apiClientId: int("api_client_id", { unsigned: true })
      .notNull()
      .references(() => apiClients.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 100 }).notNull(),
    requestHash: char("request_hash", { length: 64 }).notNull(),
    responseStatus: int("response_status").notNull(),
    responseBody: json("response_body").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [primaryKey({ columns: [t.apiClientId, t.key] })],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).references(() => users.id, { onDelete: "set null" }),
    apiClientId: int("api_client_id", { unsigned: true }).references(() => apiClients.id, { onDelete: "set null" }),
    action: mysqlEnum("action", ["create", "update", "delete", "restore"]).notNull(),
    auditableType: varchar("auditable_type", { length: 60 }).notNull(),
    auditableId: varchar("auditable_id", { length: 60 }).notNull(),
    oldValues: json("old_values"),
    newValues: json("new_values"),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("audit_logs_record_idx").on(t.auditableType, t.auditableId), index("audit_logs_user_idx").on(t.userId, t.createdAt)],
);

export type Reservation = typeof reservations.$inferSelect;
export type ReservationLeg = typeof reservationLegs.$inferSelect;
