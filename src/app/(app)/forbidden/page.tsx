import { ButtonLink } from "@/components/ui/button";

// P1-UI-05: friendly page when a user lacks the permission for a screen.
export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-16">
      <p className="text-[11px] text-brand-dark">ACCESS</p>
      <h1 className="text-[28px] font-bold text-ink">You don&apos;t have access to this page</h1>
      <p className="text-[14px] leading-[1.6] text-muted">Ask a Super Admin to add the permission to one of your roles.</p>
      <ButtonLink href="/reservations">Go to reservations</ButtonLink>
    </div>
  );
}
