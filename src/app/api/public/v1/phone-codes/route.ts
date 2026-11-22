import type { NextRequest } from "next/server";
import { guardApi, json } from "@/server/api/http";
import { getPhoneCodes } from "@/server/reference-data";

// GET /api/public/v1/phone-codes — country phone codes for the phone field.
export async function GET(req: NextRequest) {
  const client = await guardApi(req);
  if (client instanceof Response) return client;
  return json(200, { data: await getPhoneCodes() });
}
