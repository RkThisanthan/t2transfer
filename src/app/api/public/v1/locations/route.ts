import type { NextRequest } from "next/server";
import { guardApi, json } from "@/server/api/http";
import { getLocationGroups } from "@/server/reference-data";

// GET /api/public/v1/locations — pickup and drop places grouped by location type.
export async function GET(req: NextRequest) {
  const client = await guardApi(req);
  if (client instanceof Response) return client;
  const groups = await getLocationGroups();
  return json(200, { data: groups.map((g) => ({ type: g.typeName, locations: g.locations })) });
}
