"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginSchema, type LoginState } from "@/lib/auth/login-schema";
import { verifyLogin } from "@/server/auth/login";
import { getRequestMeta } from "@/server/auth/request-meta";
import { createSession } from "@/server/auth/session";

const MESSAGES = {
  invalid: "Incorrect username or password.",
  locked: "Too many failed attempts. This account is locked for 15 minutes.",
  disabled: "This account is disabled. Contact a Super Admin.",
  ip_blocked: "Too many failed attempts from this network. Try again later.",
} as const;

// Only allow redirects to paths inside this app.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const remember = formData.get("remember") === "on";
  const parsed = loginSchema.safeParse({
    username: formData.get("username") ?? "",
    password: formData.get("password") ?? "",
    remember,
  });

  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      username: String(formData.get("username") ?? ""),
      remember,
      fieldErrors: { username: errors.username?.[0], password: errors.password?.[0] },
    };
  }

  const meta = await getRequestMeta();
  const result = await verifyLogin(parsed.data.username, parsed.data.password, meta);
  if (!result.ok) {
    return { username: parsed.data.username, remember, formError: MESSAGES[result.reason] };
  }

  await createSession(result.userId, parsed.data.remember, meta);
  redirect(safeNext(formData.get("next")));
}
