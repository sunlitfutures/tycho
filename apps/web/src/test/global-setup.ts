import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { runMigrations } from "../db/migrate";

/**
 * Tests run against a scratch database made here and dropped after:
 * tycho_test_<random> on the server in TEST_DATABASE_URL (default: the
 * docker compose database). Start it first with `docker compose up -d db`.
 */
export default async function setup({ provide }: { provide: (key: "databaseUrl", value: string) => void }) {
  const admin = process.env.TEST_DATABASE_URL ?? "postgres://tycho:tycho@127.0.0.1:55432/postgres";
  const name = `tycho_test_${randomBytes(4).toString("hex")}`;
  const sql = postgres(admin, { max: 1, onnotice: () => {} });
  await sql.unsafe(`create database ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  await runMigrations(url.toString());
  provide("databaseUrl", url.toString());
  return async () => {
    await sql.unsafe(`drop database if exists ${name} with (force)`);
    await sql.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
