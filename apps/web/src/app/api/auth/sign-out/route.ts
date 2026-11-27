import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { appOrigin, clearSessionCookies, forbidden, sameOrigin, sessionToken } from "@/lib/auth/http";
import { deleteSession } from "@/lib/auth/session";

/** Ends this browser's session. A plain form POST; answers with a redirect to sign in. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return forbidden();
  await deleteSession(getDb(), sessionToken(req.cookies));
  const res = NextResponse.redirect(new URL("/sign-in?signed-out=1", appOrigin(req.headers) ?? req.url), 303);
  clearSessionCookies(res, req.headers);
  return res;
}
