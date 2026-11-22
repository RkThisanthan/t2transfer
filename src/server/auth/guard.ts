import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "./session";

/** Use at the top of every protected layout, page and Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
