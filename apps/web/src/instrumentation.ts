export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MIGRATE_ON_START === "0") return;
  const url = process.env.DATABASE_URL;
  if (!url) return; // getDb() says what is missing on the first request.
  const { runMigrations } = await import("./db/migrate");
  await runMigrations(url);
}
