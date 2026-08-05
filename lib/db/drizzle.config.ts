import { defineConfig } from "drizzle-kit";
import path from "path";

function resolveDatabaseUrl(): string {
  const railway = process.env.RAILWAY_DATABASE_URL;
  if (railway) {
    const hostPort = process.env.RAILWAY_DB_HOST_PORT;
    if (railway.includes("@:/") && hostPort) {
      return railway.replace("@:/", `@${hostPort}/`);
    }
    return railway;
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL, ensure the database is provisioned");
  }
  return process.env.DATABASE_URL;
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
});
