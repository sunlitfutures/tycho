/**
 * Mail goes through one small interface, so another transport (SMTP, say)
 * is one more file: write a Mailer and pick it in getMailer().
 */
export type Mail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface Mailer {
  /** Resolves when the provider accepted the mail; throws MailError when it did not. */
  send(mail: Mail): Promise<void>;
}

export class MailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MailError";
  }
}

/** Sends through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export function resendMailer(apiKey: string, from: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(mail) {
      let res: Response;
      try {
        res = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (err) {
        throw new MailError(`Resend could not be reached: ${(err as Error).name}`);
      }
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new MailError(`Resend answered ${res.status}: ${detail.slice(0, 200)}`, res.status);
      }
    },
  };
}

/** Dev mode: prints each mail to the server console instead of sending it. */
export function consoleMailer(log: (line: string) => void = (l) => console.log(l)): Mailer {
  return {
    async send(mail) {
      const body = mail.text.replace(/^/gm, "  | ");
      log(`\n[tycho] Dev mode: RESEND_API_KEY is not set, so this mail was not sent.\n  To: ${mail.to}\n  Subject: ${mail.subject}\n${body}\n`);
    },
  };
}

let warned = false;

/** Resend when RESEND_API_KEY is set, otherwise the console. */
export function getMailer(): Mailer {
  const key = process.env.RESEND_API_KEY;
  if (key) return resendMailer(key, process.env.MAIL_FROM ?? "Tycho <noreply@example.com>");
  if (!warned) {
    warned = true;
    console.warn("[tycho] RESEND_API_KEY is not set: sign-in codes print to this console and no mail is sent.");
  }
  return consoleMailer();
}
