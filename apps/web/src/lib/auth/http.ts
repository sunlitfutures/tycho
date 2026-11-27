import { NextResponse, type NextRequest } from "next/server";
import { SESSION_TTL_MS } from "./session";

export const SESSION_COOKIE = "tycho_session";
/** The secure-context name: the browser only accepts it over HTTPS, host-only, path /. */
export const SESSION_COOKIE_SECURE = "__Host-tycho_session";
/** The address a code was sent to, so the code page can name it. Not a secret. */
export const PENDING_COOKIE = "tycho_pending";
export const PENDING_TTL_S = 30 * 60;

type HeaderBag = { get(name: string): string | null };

function isLocalHost(host: string) {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return name === "localhost" || name === "127.0.0.1" || name === "::1" || name.endsWith(".localhost");
}

/** Cookies are Secure everywhere but localhost, where plain HTTP is normal. */
export function cookieSecure(headers: HeaderBag): boolean {
  return !isLocalHost(headers.get("host") ?? "");
}

export function sessionCookieName(headers: HeaderBag): string {
  return cookieSecure(headers) ? SESSION_COOKIE_SECURE : SESSION_COOKIE;
}

/** The token from whichever session cookie this request carries. */
export function sessionToken(cookies: { get(name: string): { value: string } | undefined }): string | undefined {
  return cookies.get(SESSION_COOKIE_SECURE)?.value ?? cookies.get(SESSION_COOKIE)?.value;
}

export function setSessionCookie(res: NextResponse, headers: HeaderBag, token: string) {
  res.cookies.set(sessionCookieName(headers), token, {
    httpOnly: true,
    secure: cookieSecure(headers),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookies(res: NextResponse, headers: HeaderBag) {
  for (const name of [SESSION_COOKIE, SESSION_COOKIE_SECURE]) {
    res.cookies.set(name, "", { httpOnly: true, secure: name === SESSION_COOKIE_SECURE || cookieSecure(headers), sameSite: "lax", path: "/", maxAge: 0 });
  }
}

export function setPendingCookie(res: NextResponse, headers: HeaderBag, email: string) {
  res.cookies.set(PENDING_COOKIE, email, {
    httpOnly: true,
    secure: cookieSecure(headers),
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_TTL_S,
  });
}

export function clearPendingCookie(res: NextResponse, headers: HeaderBag) {
  res.cookies.set(PENDING_COOKIE, "", { httpOnly: true, secure: cookieSecure(headers), sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * The origin this app is served from: APP_URL when set (do set it behind a
 * proxy), else the request's own Host.
 */
export function appOrigin(headers: HeaderBag): string | null {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return null;
    }
  }
  const host = headers.get("host");
  if (!host) return null;
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (isLocalHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * CSRF check for every POST: the browser's Origin must be this app's, and a
 * fetch from another site is refused. Browsers send Origin on every POST.
 */
export function sameOrigin(headers: HeaderBag): boolean {
  const site = headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = headers.get("origin");
  if (!origin) return false;
  return origin === appOrigin(headers);
}

/**
 * The client's IP, from the last X-Forwarded-For entry: the one our own proxy
 * added. Earlier entries come from the visitor and can be faked. This holds
 * whether the proxy replaces the header (Caddy) or appends to it (nginx).
 * ponytail: assumes exactly one proxy in front; add a hop count if we put a CDN ahead of it.
 */
export function clientIp(headers: HeaderBag): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}

/** A JSON answer that is never cached. */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function forbidden() {
  return json({ error: "forbidden" }, 403);
}

/** Reads a JSON body, or null when the body is missing, not JSON, or too large. */
export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
  const text = await req.text().catch(() => "");
  if (text.length > 4096) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}
