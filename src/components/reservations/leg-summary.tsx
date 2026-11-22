import { Icon } from "@/components/ui/icon";
import { formatLocal } from "@/lib/format";
import type { ReservationLeg } from "@/server/db/schema";

type Names = Map<number, string>;

export function place(names: Names, locationId: number | null, address: string | null): string {
  const name = locationId ? names.get(locationId) ?? `Location #${locationId}` : "";
  if (name && address) return `${name} - ${address}`;
  return name || address || "-";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-[12px] text-muted">{label}</p>
      <p className="text-[14px] leading-[1.5] font-medium break-words text-ink">{value}</p>
    </div>
  );
}

function Stop({ kind, label, value }: { kind: "pickup" | "drop"; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${kind === "pickup" ? "bg-brand-soft" : "bg-green-soft"}`}>
        <Icon name={kind === "pickup" ? "plane-landing" : "map-pin"} size={15} />
      </span>
      <Field label={label} value={value} />
    </div>
  );
}

/** Figma "Outbound journey" column (5:3986): used for the arrival leg or a single transfer. */
export function OutboundLeg({ leg, names }: { leg: ReservationLeg | undefined; names: Names }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5">
      <h3 className="flex items-center gap-2 text-[15px] text-ink">
        <Icon name="route" size={18} />
        {leg?.kind === "single" ? "Single transfer" : "Outbound transfer"}
      </h3>
      {leg ? (
        <>
          <Stop kind="pickup" label="Pickup" value={place(names, leg.pickupLocationId, leg.pickupAddress)} />
          <Stop kind="drop" label="Drop" value={place(names, leg.dropLocationId, leg.dropAddress)} />
          <div className="flex gap-4">
            {leg.kind === "arrival" ? (
              <>
                <Field label="Arrival flight time" value={formatLocal(leg.flightAt)} />
                <Field label="Flight" value={[leg.flightNo, leg.flightCity && `from ${leg.flightCity}`].filter(Boolean).join(" ") || "—"} />
              </>
            ) : (
              <Field label="Pickup time" value={formatLocal(leg.pickupAt)} />
            )}
          </div>
        </>
      ) : (
        <p className="text-[12px] leading-[1.5] text-muted">No outbound transfer for this reservation.</p>
      )}
    </section>
  );
}

/** Figma "Departure details" column (5:4006). */
export function DepartureLeg({ leg, names }: { leg: ReservationLeg | undefined; names: Names }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5">
      <h3 className="flex items-center gap-2 text-[15px] text-ink">
        <Icon name="plane-takeoff" size={18} />
        Departure transfer
      </h3>
      <div className="flex gap-4">
        <Field label="Departure flight time" value={formatLocal(leg?.flightAt)} />
        <Field label="Departure pickup time" value={formatLocal(leg?.pickupAt)} />
      </div>
      <Field label="Departure pickup" value={leg ? place(names, leg.pickupLocationId, leg.pickupAddress) : "-"} />
      <Field label="Departure drop" value={leg ? place(names, leg.dropLocationId, leg.dropAddress) : "-"} />
      {leg ? <Field label="Flight" value={[leg.flightNo, leg.flightCity && `to ${leg.flightCity}`].filter(Boolean).join(" ") || "—"} /> : null}
      {!leg ? <p className="text-[12px] leading-[1.5] text-muted">No departure times provided for this reservation.</p> : null}
    </section>
  );
}
