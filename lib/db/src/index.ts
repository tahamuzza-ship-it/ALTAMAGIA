import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

function resolveDatabaseUrl(): string {
  const railway = process.env.RAILWAY_DATABASE_URL;
  if (railway) {
    // El secreto puede venir sin host:puerto (Railway lo copió incompleto);
    // en ese caso lo completamos con RAILWAY_DB_HOST_PORT (no secreto).
    const hostPort = process.env.RAILWAY_DB_HOST_PORT;
    if (railway.includes("@:/") && hostPort) {
      return railway.replace("@:/", `@${hostPort}/`);
    }
    return railway;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  return process.env.DATABASE_URL;
}

export const pool = new Pool({ connectionString: resolveDatabaseUrl() });
export const db = drizzle(pool, { schema });

export * from "./schema";
