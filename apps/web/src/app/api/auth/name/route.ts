import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { normalizeName } from "@/lib/auth/email";
import { forbidden, json, readJson, sameOrigin, sessionToken } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session";

/** Sets the signed-in person's name. Body: {"name": "..."}. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return forbidden();
  const db = getDb();
  const found = await readSession(db, sessionToken(req.cookies));
  if (!found) return json({ error: "signed_out" }, 401);
  const body = await readJson(req);
  const name = normalizeName(body?.name);
  if (!name) return json({ error: "invalid_name" }, 400);
  await db.update(users).set({ name }).where(eq(users.id, found.user.id));
  return json({ ok: true, next: "/" });
}
