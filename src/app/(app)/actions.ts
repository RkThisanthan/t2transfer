"use server";

import { redirect } from "next/navigation";
import { recordLoginEvent } from "@/server/auth/login";
import { getRequestMeta } from "@/server/auth/request-meta";
import { destroyCurrentSession } from "@/server/auth/session";

// P1-AUTH-03: logout ends the session (and any remember cookie) and is recorded.
export async function logoutAction() {
  const userId = await destroyCurrentSession();
  if (userId) await recordLoginEvent("logout", await getRequestMeta(), userId);
  redirect("/login");
}
