import { describe, expect, it } from "vitest";
import { consoleMailer, MailError, resendMailer } from "./index";
import { signInCodeMail } from "./sign-in-code";

describe("the sign-in mail", () => {
  it("has the code in text and HTML, not the subject", () => {
    const m = signInCodeMail("ada@example.com", "012345", 10);
    expect(m.subject).not.toContain("012345");
    expect(m.text).toMatch(/^012345$/m);
    expect(m.html).toContain("012345");
    expect(m.text).toContain("10 minutes");
  });
});

describe("Resend", () => {
  it("posts the mail with the key as a bearer token", async () => {
    let req: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => {
      req = { url, init };
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }) as unknown as typeof fetch;
    await resendMailer("re_test", "Tycho <noreply@example.com>", fake).send(signInCodeMail("ada@example.com", "123456", 10));
    expect(req!.url).toBe("https://api.resend.com/emails");
    expect((req!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(req!.init.body));
    expect(body).toMatchObject({ from: "Tycho <noreply@example.com>", to: ["ada@example.com"], subject: "Your Tycho sign-in code" });
  });

  it("throws MailError when Resend refuses or cannot be reached", async () => {
    const refuse = (async () => new Response("bad", { status: 422 })) as unknown as typeof fetch;
    await expect(resendMailer("k", "f", refuse).send(signInCodeMail("a@b.co", "1", 10))).rejects.toBeInstanceOf(MailError);
    const down = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(resendMailer("k", "f", down).send(signInCodeMail("a@b.co", "1", 10))).rejects.toBeInstanceOf(MailError);
  });
});

describe("dev mode", () => {
  it("prints the mail instead of sending it", async () => {
    const lines: string[] = [];
    await consoleMailer((l) => lines.push(l)).send(signInCodeMail("ada@example.com", "654321", 10));
    expect(lines.join("\n")).toContain("654321");
    expect(lines.join("\n")).toContain("not sent");
  });
});
