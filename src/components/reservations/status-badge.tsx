import type { Reservation } from "@/server/db/schema";

// Figma "Pending status" pill (5:3978); confirmed/cancelled/deleted follow the same shape.
const STYLES = {
  pending: "bg-pending-soft text-pending-ink",
  confirmed: "bg-green-soft text-green-ink",
  cancelled: "bg-danger-soft text-danger-ink",
  deleted: "bg-canvas text-muted",
} as const;

export function StatusBadge({ status, deleted }: { status: Reservation["status"]; deleted?: boolean }) {
  const key = deleted ? "deleted" : status;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] uppercase ${STYLES[key]}`}>
      <span aria-hidden="true" className="size-1.5 rounded-[3px] bg-current" />
      {key}
    </span>
  );
}
