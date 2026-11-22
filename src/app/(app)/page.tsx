import { redirect } from "next/navigation";

// The dashboard (daily chart, P1-CHT) is not built yet; reservations is the home screen for now.
export default function HomePage() {
  redirect("/reservations");
}
