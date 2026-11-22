import { headers } from "next/headers";

export type RequestMeta = { ip: string | null; userAgent: string | null };

// Behind Nginx on the VPS, the real client IP arrives in X-Forwarded-For / X-Real-IP.
export async function getRequestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent")?.slice(0, 255) ?? null;
  return { ip: ip ? ip.slice(0, 45) : null, userAgent };
}
