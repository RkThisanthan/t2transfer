import { notFound } from "next/navigation";
import { PageIntro } from "@/components/ui/page-intro";

// Menu items whose screens are not built yet.
const PENDING: Record<string, { title: string; note: string }> = {
  rates: { title: "Rates", note: "Locations and rates are built next in Phase 1 (P1-LOC, P1-RAT)." },
  testimonials: { title: "Testimonials", note: "Testimonials are built later in Phase 1 (P1-TST)." },
  vouchers: { title: "Voucher Codes", note: "Vouchers and voucher users are built later in Phase 1 (P1-VCH)." },
  "driver-assign": { title: "Driver Assign", note: "Driver assignment stays on the old admin panel until Driver Planning in Phase 3." },
};

export default async function PendingModulePage({ params }: { params: Promise<{ module: string }> }) {
  const info = PENDING[(await params).module];
  if (!info) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageIntro eyebrow="NOT BUILT YET" title={info.title} description={info.note} />
    </div>
  );
}
