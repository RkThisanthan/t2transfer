import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/config";

// Optimistic check only: no cookie → send to /login. The real session check runs in
// requireUser() on the server (protected layout, pages and actions).
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the auth pages, the public API, Next.js internals and static files.
  matcher: ["/((?!login|forgot-password|reset-password|api/public|_next/|favicon.ico|images/|icons/).*)"],
};
