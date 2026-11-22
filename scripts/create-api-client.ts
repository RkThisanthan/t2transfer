// Creates a Booking API key for one WordPress site. The key is shown once; only its hash is stored.
// Usage: npm run api-client:create -- "T2 Transfer website" T2   (site = legacy site code, e.g. T2, T2ES, PAP, PD)
//        add --save-test-key to write it to .env.local as TEST_API_KEY instead of printing it (local testing only).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createApiClient } from "../src/server/api/clients";
import { SITES } from "../src/server/db/schema";

async function main() {
  const [name, site, flag] = process.argv.slice(2);
  if (!name || !SITES.includes(site as (typeof SITES)[number])) {
    throw new Error(`Usage: api-client:create -- "<name>" <${SITES.join("|")}> [--save-test-key]`);
  }
  const { id, key } = await createApiClient(name, site as (typeof SITES)[number], null);
  if (flag === "--save-test-key") {
    const env = readFileSync(".env.local", "utf8").split("\n").filter((l) => !l.startsWith("TEST_API_KEY=")).join("\n");
    writeFileSync(".env.local", env.trimEnd() + "\n");
    appendFileSync(".env.local", `TEST_API_KEY=${key}\n`);
    console.log(`API client #${id} "${name}" (${site}) created. Key saved to .env.local as TEST_API_KEY.`);
  } else {
    console.log(`API client #${id} "${name}" (${site}) created.\nKey (shown once, store it in the WordPress site's config):\n${key}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
