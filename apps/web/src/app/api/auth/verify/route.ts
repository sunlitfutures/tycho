import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { clearPendingCookie, clientIp, forbidden, json, PENDING_COOKIE, readJson, sameOrigin, setSessionCookie } from "@/lib/auth/http";
import { verifyLogin } from "@/lib/auth/login";
import { createSession } from "@/lib/auth/session";

/** Checks a code for the address on the code page. Body: {"code": "123456"}. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return forbidden();
  const body = await readJson(req);
  if (!body) return json({ error: "bad_request" }, 400);
  const email = req.cookies.get(PENDING_COOKIE)?.value;
  if (!email) return json({ error: "no_code" }, 410);

  const db = getDb();
  const ip = clientIp(req.headers);
  const result = await verifyLogin(db, { email, code: body.code, ip });
  if (!result.ok) {
    switch (result.error) {
      case "invalid_code":
        return json({ error: "invalid_code" }, 400);
      case "wrong_code":
        return json({ error: "wrong_code", triesLeft: result.triesLeft }, 401);
      case "expired":
        return json({ error: "expired" }, 410);
      case "no_code":
        return json({ error: "no_code" }, 410);
      case "too_many_tries":
        return json({ error: "too_many_tries" }, 429);
      case "rate_limited":
        return json({ error: "rate_limited", scope: result.scope, retryInMs: result.retryAt.getTime() - Date.now() }, 429);
    }
  }

  const session = await createSession(db, result.user.id, { ip, userAgent: req.headers.get("user-agent") ?? undefined });
  const res = json({ ok: true, next: result.user.name ? "/" : "/welcome" });
  setSessionCookie(res, req.headers, session.token);
  clearPendingCookie(res, req.headers);
  return res;
}
