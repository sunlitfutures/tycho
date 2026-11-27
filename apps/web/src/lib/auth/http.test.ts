import { afterEach, describe, expect, it } from "vitest";
import { clientIp, cookieSecure, sameOrigin, sessionCookieName } from "./http";

const h = (o: Record<string, string>) => new Headers(o);

afterEach(() => {
  delete process.env.APP_URL;
});

describe("CSRF origin check", () => {
  it("passes a same-origin POST", () => {
    expect(sameOrigin(h({ host: "localhost:4310", origin: "http://localhost:4310", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
  it("refuses another site, a missing Origin, or a cross-site fetch", () => {
    expect(sameOrigin(h({ host: "localhost:4310", origin: "https://evil.example" }))).toBe(false);
    expect(sameOrigin(h({ host: "localhost:4310" }))).toBe(false);
    expect(sameOrigin(h({ host: "localhost:4310", origin: "http://localhost:4310", "sec-fetch-site": "cross-site" }))).toBe(false);
  });
  it("uses APP_URL when set", () => {
    process.env.APP_URL = "https://tycho.example.com";
    expect(sameOrigin(h({ host: "10.0.0.5:4310", origin: "https://tycho.example.com" }))).toBe(true);
    expect(sameOrigin(h({ host: "10.0.0.5:4310", origin: "http://10.0.0.5:4310" }))).toBe(false);
  });
});

describe("cookies", () => {
  it("are Secure, under the __Host- name, except on localhost", () => {
    expect(cookieSecure(h({ host: "localhost:4310" }))).toBe(false);
    expect(cookieSecure(h({ host: "127.0.0.1:4310" }))).toBe(false);
    expect(cookieSecure(h({ host: "tycho.example.com" }))).toBe(true);
    expect(sessionCookieName(h({ host: "tycho.example.com" }))).toBe("__Host-tycho_session");
  });
});

describe("client IP", () => {
  it("takes the last X-Forwarded-For entry, the one our proxy added", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    // A visitor's fake entry comes first; the proxy appends the real address.
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
