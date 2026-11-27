import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { tychoDb?: Db };

/** The app's database, from DATABASE_URL. One pool per process. */
export function getDb(): Db {
  if (!globalForDb.tychoDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
    globalForDb.tychoDb = connect(url);
  }
  return globalForDb.tychoDb;
}

export function connect(url: string, max = 10): Db {
  return drizzle(postgres(url, { max, onnotice: () => {} }), { schema });
}
