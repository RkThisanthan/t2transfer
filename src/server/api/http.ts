import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey, type ApiClient } from "./clients";

// Simple fixed-window rate limit, per key and per IP. One app process on the VPS, so memory is enough
// for Phase 1; move to Redis when the worker/realtime services arrive (Phase 2/3).
const WINDOW_MS = 60_000;
const LIMITS = { key: 120, ip: 60 };
const hits = new Map<string, { count: number; reset: number }>();

function limited(bucket: string, max: number): boolean {
  const now = Date.now();
  const entry = hits.get(bucket);
  if (!entry || entry.reset < now) {
    hits.set(bucket, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > max;
}

export const json = (status: number, body: unknown, headers?: Record<string, string>) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export function clientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
}

/** API key + rate limit for every public endpoint. Returns the client or an error response. */
export async function guardApi(req: NextRequest): Promise<ApiClient | NextResponse> {
  const ip = clientIp(req) ?? "unknown";
  if (limited(`ip:${ip}`, LIMITS.ip)) return json(429, { error: "rate_limited", message: "Too many requests. Try again in a minute." }, { "Retry-After": "60" });

  const client = await authenticateApiKey(req.headers.get("x-api-key"));
  if (!client) return json(401, { error: "unauthorized", message: "Missing or invalid API key." });

  if (limited(`key:${client.id}`, LIMITS.key)) return json(429, { error: "rate_limited", message: "Too many requests. Try again in a minute." }, { "Retry-After": "60" });
  return client;
}
