import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { apiClients, type SITES } from "@/server/db/schema";

export type ApiClient = { id: number; name: string; site: (typeof SITES)[number] };

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

/** Creates a key for one WordPress site. The plain key is returned once and never stored. */
export async function createApiClient(name: string, site: ApiClient["site"], createdBy: number | null) {
  const key = `t2t_${randomBytes(32).toString("base64url")}`;
  const [res] = await db.insert(apiClients).values({ name, site, keyPrefix: key.slice(0, 12), keyHash: hash(key), createdBy });
  return { id: res.insertId, key };
}

/** Looks up the X-Api-Key header (P1-RES-12). Returns null for a missing, unknown or disabled key. */
export async function authenticateApiKey(key: string | null): Promise<ApiClient | null> {
  if (!key || key.length < 20 || key.length > 200) return null;
  const [client] = await db
    .select({ id: apiClients.id, name: apiClients.name, site: apiClients.site })
    .from(apiClients)
    .where(and(eq(apiClients.keyHash, hash(key)), eq(apiClients.isActive, true)))
    .limit(1);
  if (!client) return null;
  await db.update(apiClients).set({ lastUsedAt: new Date() }).where(eq(apiClients.id, client.id));
  return client;
}
