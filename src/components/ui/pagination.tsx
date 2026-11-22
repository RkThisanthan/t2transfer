import Link from "next/link";

type Props = {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  /** Total number of records, to show "Showing 21–40 of 100". */
  total?: number;
  pageSize?: number;
};

/** Page numbers around the current page, with gaps: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const pages = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

// Figma "Pagination" (5:4039): "Page X of Y", First / page numbers / Next / Last.
export function Pagination({ page, pageCount, hrefFor, total, pageSize }: Props) {
  const base = "flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-[12px] font-semibold";
  const link = `${base} border-line bg-white text-brand-dark hover:bg-brand-soft`;
  const disabled = `${base} border-line bg-white text-muted`;
  const from = total && pageSize ? Math.min(total, (page - 1) * pageSize + 1) : 0;
  const to = total && pageSize ? Math.min(total, page * pageSize) : 0;

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] text-muted">
        Page <span className="font-semibold text-ink">{page}</span> of <span className="font-semibold text-ink">{pageCount}</span>
        {total !== undefined && pageSize ? (
          <span>
            {" · "}
            {total === 0 ? "No reservations" : `Showing ${from}–${to} of ${total.toLocaleString("en-GB")}`}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {page > 1 ? <Link href={hrefFor(1)} className={link}>First</Link> : <span className={disabled}>First</span>}
        {pageWindow(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="flex h-9 items-center px-1 text-[12px] text-muted">…</span>
          ) : p === page ? (
            <span key={p} aria-current="page" className={`${base} border-brand bg-brand text-white`}>{p}</span>
          ) : (
            <Link key={p} href={hrefFor(p)} className={link} aria-label={`Page ${p}`}>{p}</Link>
          ),
        )}
        {page < pageCount ? <Link href={hrefFor(page + 1)} className={link}>Next</Link> : <span className={disabled}>Next</span>}
        {page < pageCount ? <Link href={hrefFor(pageCount)} className={link}>Last</Link> : <span className={disabled}>Last</span>}
      </div>
    </nav>
  );
}
