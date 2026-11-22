// Imports reference data (location types, locations, phone country codes) from a legacy SQL dump.
// Customer data is NOT read. Safe to re-run: rows are matched on legacy id / code.
// Usage: npm run db:import-reference -- "E:\T2Transfer\u220359069_t2transfer.sql"
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { locationTypes, locations, phoneCountryCodes } from "../src/server/db/schema";

type Value = string | number | null;

/** Returns the rows of the first `INSERT INTO \`table\` ... VALUES (...),(...);` block. */
function readInsert(sql: string, table: string): Value[][] {
  const start = sql.indexOf(`INSERT INTO \`${table}\``);
  if (start < 0) throw new Error(`No INSERT for ${table} in dump`);
  let i = sql.indexOf("VALUES", start) + "VALUES".length;
  const rows: Value[][] = [];
  let row: Value[] | null = null;
  let token = "";
  let inString = false;
  let quoted = false;
  const push = () => {
    if (!row) return;
    if (quoted) row.push(token);
    else if (token.trim().toUpperCase() === "NULL") row.push(null);
    else if (token.trim() !== "") row.push(Number(token.trim()));
    token = "";
    quoted = false;
  };
  for (; i < sql.length; i++) {
    const c = sql[i];
    if (inString) {
      if (c === "\\") { token += sql[++i]; continue; }
      if (c === "'") { if (sql[i + 1] === "'") { token += "'"; i++; continue; } inString = false; continue; }
      token += c;
      continue;
    }
    if (c === "'") { inString = true; quoted = true; token = ""; continue; }
    if (c === "(") { row = []; token = ""; continue; }
    if (c === ",") { if (row) push(); continue; }
    if (c === ")") { push(); if (row) rows.push(row); row = null; continue; }
    if (c === ";") break;
    if (row) token += c;
  }
  return rows;
}

async function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) throw new Error("Pass the path to the legacy SQL dump");
  const sql = readFileSync(dumpPath, "utf8");

  const typeIdByLegacy = new Map<number, number>();
  for (const [legacyId, name, rank] of readInsert(sql, "location_types")) {
    const [found] = await db.select().from(locationTypes).where(eq(locationTypes.legacyId, Number(legacyId)));
    if (found) {
      await db.update(locationTypes).set({ name: String(name), sortOrder: Number(rank ?? 100) }).where(eq(locationTypes.id, found.id));
      typeIdByLegacy.set(Number(legacyId), found.id);
    } else {
      const [res] = await db.insert(locationTypes).values({ name: String(name), sortOrder: Number(rank ?? 100), legacyId: Number(legacyId) });
      typeIdByLegacy.set(Number(legacyId), res.insertId);
    }
  }

  let locCount = 0;
  for (const [legacyId, name, type, rank] of readInsert(sql, "locations")) {
    const typeId = typeIdByLegacy.get(Number(type));
    if (!typeId) { console.warn(`Skipping location ${legacyId}: unknown type ${type}`); continue; }
    await db
      .insert(locations)
      .values({ name: String(name), locationTypeId: typeId, sortOrder: Number(rank ?? 10000), legacyId: Number(legacyId) })
      .onDuplicateKeyUpdate({ set: { name: String(name), locationTypeId: typeId } });
    locCount++;
  }

  const existingCodes = await db.select({ id: phoneCountryCodes.id }).from(phoneCountryCodes).limit(1);
  let codeCount = 0;
  if (existingCodes.length === 0) {
    const rows = readInsert(sql, "phone_country_codes").map(([, country, code, priority]) => ({
      country: String(country),
      code: String(code),
      priority: Number(priority ?? 0),
    }));
    for (let i = 0; i < rows.length; i += 200) await db.insert(phoneCountryCodes).values(rows.slice(i, i + 200));
    codeCount = rows.length;
  }

  console.log(`Location types: ${typeIdByLegacy.size}, locations: ${locCount}, phone codes added: ${codeCount}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
