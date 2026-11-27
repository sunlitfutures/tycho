import { sql } from "drizzle-orm";
import { inject } from "vitest";
import { connect, type Db } from "../db";

let db: Db | undefined;

export function testDb(): Db {
  db ??= connect(inject("databaseUrl"), 4);
  return db;
}

export async function resetDb() {
  await testDb().execute(sql`truncate users, sessions, login_codes, login_code_misses cascade`);
}
