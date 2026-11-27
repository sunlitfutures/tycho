import { NextResponse, type NextRequest } from "next/server";
import { cookieSecure, SESSION_COOKIE, SESSION_COOKIE_SECURE } from "@/lib/auth/http";
import { SESSION_TTL_MS } from "@/lib/auth/session";

/**
 * Slides the session cookie: each page visit sets it again for another 30
 * days. The database row slides the same way (readSession), so both end
 * together. Signed-out visitors to a signed-in page go to sign in.
 */
export function proxy(req: NextRequest) {
  const name = req.cookies.get(SESSION_COOKIE_SECURE) ? SESSION_COOKIE_SECURE : req.cookies.get(SESSION_COOKIE) ? SESSION_COOKIE : null;
  const signedInOnly = req.nextUrl.pathname === "/" || req.nextUrl.pathname.startsWith("/welcome");
  if (!name) {
    return signedInOnly ? NextResponse.redirect(new URL("/sign-in", req.url)) : NextResponse.next();
  }
  const res = NextResponse.next();
  res.cookies.set(name, req.cookies.get(name)!.value, {
    httpOnly: true,
    secure: name === SESSION_COOKIE_SECURE || cookieSecure(req.headers),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}

export const config = {
  // Pages only: not the API, not static files.
  matcher: ["/((?!api/|_next/|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
