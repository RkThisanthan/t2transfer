import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  const pool = mysql.createPool({ uri: url, connectionLimit: 10, timezone: "Z", charset: "utf8mb4" });
  // Keep the database session in UTC too, so CURRENT_TIMESTAMP defaults match the Dates the app writes.
  pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'");
  });
  return pool;
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { t2tPool?: mysql.Pool };
const pool = globalForDb.t2tPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.t2tPool = pool;

export const db = drizzle({ client: pool, schema, mode: "default" });
