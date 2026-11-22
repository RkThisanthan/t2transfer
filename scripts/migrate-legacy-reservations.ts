// Migrates legacy reservations (t2_legacy.reservations) into the new tables. Phase 1 spec, Section 5.4.
//
// Usage: npm run db:migrate-legacy -- [options]
//   --dry-run              map and report only, write nothing
//   --since=YYYY-MM-DD     only bookings created on/after this date (Paris time)
//   --limit=N              stop after N legacy rows (for trial runs)
//   --include-incomplete   also migrate rows with no journey dates (abandoned form starts); skipped by default
//   --reset                first delete everything this script migrated before (source = 'legacy')
//
// Safe to re-run: rows whose legacy_id is already migrated are skipped.
// The report (reports/legacy-reservations-*.json) lists legacy ids only, never customer details.
import { mkdirSync, writeFileSync } from "node:fs";
import mysql from "mysql2/promise";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { locationTypes, locations, reservationLegs, reservations } from "../src/server/db/schema";
import { mapLegacyReservation, parisToUtc, type LegacyRow, type MappedReservation } from "../src/server/migration/legacy-reservation-mapping";

const BATCH = 500;

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    }),
  );
  if (args.since && !/^\d{4}-\d{2}-\d{2}$/.test(args.since)) throw new Error("--since must be YYYY-MM-DD");
  return {
    dryRun: args["dry-run"] === "true",
    since: args.since as string | undefined,
    limit: args.limit ? Number(args.limit) : undefined,
    includeIncomplete: args["include-incomplete"] === "true",
    reset: args.reset === "true",
  };
}

/** Legacy location ids → new ids. Ids of deleted legacy locations get an inactive placeholder. */
async function buildLocationMap(legacyIdsInUse: Set<number>, dryRun: boolean) {
  const map = new Map<number, number>();
  for (const l of await db.select({ id: locations.id, legacyId: locations.legacyId }).from(locations).where(isNotNull(locations.legacyId))) {
    map.set(l.legacyId!, l.id);
  }
  const missing = [...legacyIdsInUse].filter((id) => !map.has(id)).sort((a, b) => a - b);
  if (missing.length && !dryRun) {
    let [type] = await db.select().from(locationTypes).where(eq(locationTypes.name, "Removed legacy locations"));
    if (!type) {
      const [res] = await db.insert(locationTypes).values({ name: "Removed legacy locations", sortOrder: 999 });
      type = { id: res.insertId, name: "Removed legacy locations", sortOrder: 999, legacyId: null };
    }
    for (const legacyId of missing) {
      const [res] = await db.insert(locations).values({
        name: `Removed location #${legacyId}`,
        locationTypeId: type.id,
        isActive: false,
        legacyId,
      });
      map.set(legacyId, res.insertId);
    }
  }
  return { map, placeholders: missing };
}

async function main() {
  const opts = parseArgs();
  const legacyUrl = process.env.LEGACY_DATABASE_URL;
  if (!legacyUrl) throw new Error("LEGACY_DATABASE_URL is not set in .env.local");
  // dateStrings: legacy times are Paris wall-clock values; keep them exactly as stored.
  const legacy = await mysql.createConnection({ uri: legacyUrl, dateStrings: true, charset: "utf8mb4" });
  const started = Date.now();

  if (opts.reset && !opts.dryRun) {
    const [res] = await db.delete(reservations).where(eq(reservations.source, "legacy"));
    console.log(`Reset: removed ${res.affectedRows} previously migrated reservations.`);
  }

  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.since) { where.push("created_date >= ?"); params.push(`${opts.since} 00:00:00`); }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql = opts.limit ? `LIMIT ${Math.floor(opts.limit)}` : "";

  // Location ids used by the rows in scope (to create placeholders for removed locations once).
  const [locRows] = await legacy.query(
    `SELECT DISTINCT x FROM (
       SELECT pickup_location x FROM reservations ${whereSql} UNION SELECT drop_location FROM reservations ${whereSql}
       UNION SELECT departure_pickup_location FROM reservations ${whereSql} UNION SELECT departure_drop_location FROM reservations ${whereSql}
     ) t WHERE x > 0`,
    [...params, ...params, ...params, ...params],
  );
  const { map: locationMap, placeholders } = await buildLocationMap(new Set((locRows as { x: number }[]).map((r) => r.x)), opts.dryRun);

  const already = new Set(
    (await db.select({ legacyId: reservations.legacyId }).from(reservations).where(isNotNull(reservations.legacyId))).map((r) => r.legacyId!),
  );
  const usedRefs = new Set((await db.select({ ref: reservations.reference }).from(reservations)).map((r) => r.ref));

  const report = {
    startedAt: new Date(started).toISOString(),
    options: opts,
    read: 0,
    migrated: 0,
    skippedAlreadyMigrated: 0,
    skippedIncomplete: 0,
    failed: [] as { legacyId: number; error: string }[],
    tripTypes: {} as Record<string, number>,
    sites: {} as Record<string, number>,
    deleted: 0,
    generatedReferences: 0,
    renamedDuplicateReferences: [] as { legacyId: number; reference: string }[],
    placeholderLocations: placeholders,
    warnings: {} as Record<string, number[]>,
  };
  const warn = (code: string, id: number) => ((report.warnings[code] ??= []).push(id));

  const [rows] = await legacy.query(`SELECT * FROM reservations ${whereSql} ORDER BY id ${limitSql}`, params);
  const all = rows as LegacyRow[];
  console.log(`Read ${all.length} legacy reservations${opts.dryRun ? " (dry run)" : ""}.`);

  for (let i = 0; i < all.length; i += BATCH) {
    const batch: MappedReservation[] = [];
    for (const row of all.slice(i, i + BATCH)) {
      report.read++;
      if (already.has(row.id)) { report.skippedAlreadyMigrated++; continue; }
      const result = mapLegacyReservation(row, { includeIncomplete: opts.includeIncomplete });
      if (result.kind === "skip") { report.skippedIncomplete++; continue; }
      const r = result.reservation;
      for (const w of result.warnings) warn(w.split(":")[0], r.legacyId);

      // References: keep the legacy one; generate LEG-<id> when missing; suffix duplicates.
      if (!r.reference) { r.reference = `LEG-${r.legacyId}`; report.generatedReferences++; }
      if (usedRefs.has(r.reference)) {
        let n = 2;
        while (usedRefs.has(`${r.reference}-${n}`)) n++;
        r.reference = `${r.reference}-${n}`.slice(0, 40);
        report.renamedDuplicateReferences.push({ legacyId: r.legacyId, reference: r.reference });
      }
      usedRefs.add(r.reference);
      batch.push(r);
    }
    if (!batch.length) continue;

    for (const r of batch) {
      report.tripTypes[r.tripType] = (report.tripTypes[r.tripType] ?? 0) + 1;
      report.sites[r.site] = (report.sites[r.site] ?? 0) + 1;
      if (r.deletedAtParis) report.deleted++;
    }
    if (opts.dryRun) { report.migrated += batch.length; continue; }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(reservations).values(
          batch.map((r) => {
            const createdAt = r.createdAtParis ? parisToUtc(r.createdAtParis) : new Date("2000-01-01T00:00:00Z");
            return {
              reference: r.reference!,
              site: r.site,
              source: "legacy" as const,
              tripType: r.tripType,
              status: r.status,
              title: r.title,
              firstName: r.firstName,
              lastName: r.lastName,
              email: r.email,
              phoneCode: r.phoneCode,
              phone: r.phone,
              adults: r.adults,
              children: r.children,
              babies: r.babies,
              luggageSmall: r.luggageSmall,
              luggageXl: r.luggageXl,
              trolleys: r.trolleys,
              vehicleClass: r.vehicleClass,
              upgradeCost: r.upgradeCost,
              voucherCode: r.voucherCode,
              discount: r.discount,
              total: r.total,
              paymentMethod: r.paymentMethod,
              paymentStatus: r.paymentStatus,
              clientComments: r.clientComments,
              specialNotes: r.specialNotes,
              utmSource: r.utmSource,
              utmMedium: r.utmMedium,
              legacyId: r.legacyId,
              createdAt,
              updatedAt: createdAt,
              deletedAt: r.deletedAtParis ? parisToUtc(r.deletedAtParis) : null,
            };
          }),
        );
        const ids = await tx
          .select({ id: reservations.id, legacyId: reservations.legacyId })
          .from(reservations)
          .where(inArray(reservations.legacyId, batch.map((r) => r.legacyId)));
        const idByLegacy = new Map(ids.map((x) => [x.legacyId!, x.id]));
        const legRows = batch.flatMap((r) =>
          r.legs.map((l) => ({
            reservationId: idByLegacy.get(r.legacyId)!,
            kind: l.kind,
            pickupLocationId: l.pickupLegacyLocation ? locationMap.get(l.pickupLegacyLocation) ?? null : null,
            pickupAddress: l.pickupAddress,
            dropLocationId: l.dropLegacyLocation ? locationMap.get(l.dropLegacyLocation) ?? null : null,
            dropAddress: l.dropAddress,
            pickupAt: l.pickupAt,
            flightNo: l.flightNo,
            flightCity: l.flightCity,
            flightAt: l.flightAt,
            rate: l.rate,
            nightCharge: l.nightCharge,
            vatRate: l.vatRate,
          })),
        );
        if (legRows.length) await tx.insert(reservationLegs).values(legRows);
      });
      report.migrated += batch.length;
    } catch (err) {
      // One bad row should not lose the whole batch: retry this batch row by row is overkill here;
      // record every id in the batch so it can be investigated and re-run.
      for (const r of batch) report.failed.push({ legacyId: r.legacyId, error: (err as Error).message.slice(0, 300) });
    }
    process.stdout.write(`\r${Math.min(i + BATCH, all.length)} / ${all.length}`);
  }

  await legacy.end();
  const finishedIn = Math.round((Date.now() - started) / 1000);
  mkdirSync("reports", { recursive: true });
  const file = `reports/legacy-reservations-${new Date().toISOString().replace(/[:.]/g, "-")}${opts.dryRun ? "-dry-run" : ""}.json`;
  writeFileSync(file, JSON.stringify({ ...report, finishedInSeconds: finishedIn }, null, 2));

  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(reservations).where(eq(reservations.source, "legacy"));
  console.log(`\n
Read:                     ${report.read}
Migrated:                 ${report.migrated}${opts.dryRun ? " (would be)" : ""}
Skipped, already done:    ${report.skippedAlreadyMigrated}
Skipped, no dates:        ${report.skippedIncomplete}${opts.includeIncomplete ? "" : "  (use --include-incomplete to migrate them)"}
Failed:                   ${report.failed.length}
Trip types:               ${JSON.stringify(report.tripTypes)}
Sites:                    ${JSON.stringify(report.sites)}
Deleted (soft):           ${report.deleted}
Generated references:     ${report.generatedReferences}
Renamed duplicate refs:   ${report.renamedDuplicateReferences.length}
Placeholder locations:    ${placeholders.length}
Warnings:                 ${JSON.stringify(Object.fromEntries(Object.entries(report.warnings).map(([k, v]) => [k, v.length])))}
Legacy rows in t2_admin:  ${n}
Time:                     ${finishedIn}s
Report:                   ${file}`);
  process.exit(report.failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
