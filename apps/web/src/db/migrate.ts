import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Any fixed number; it names the lock that keeps two servers from migrating at once. */
const MIGRATION_LOCK = 7_310_001;

export function migrationsFolder(): string {
  return process.env.MIGRATIONS_DIR ?? path.join(process.cwd(), "drizzle");
}

/** Applies the checked-in SQL migrations in ./drizzle that have not run yet. */
export async function runMigrations(url: string, folder = migrationsFolder()): Promise<void> {
  // One connection, so the session lock and the migration share it.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);
  try {
    await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK})`);
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK})`).catch(() => {});
    await client.end();
  }
}
