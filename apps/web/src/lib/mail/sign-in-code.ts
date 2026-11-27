import type { Mail } from "./index";

/**
 * The sign-in mail. The code is in the body only, never the subject, so it
 * does not show on a lock screen or in a mail list.
 */
export function signInCodeMail(to: string, code: string, minutes: number): Mail {
  const subject = "Your Tycho sign-in code";
  const text = [
    "Your Tycho sign-in code:",
    "",
    code,
    "",
    `Enter it on the sign-in page. It works once, for ${minutes} minutes.`,
    "",
    "If you did not ask for this code, you can ignore this email. No one can sign in without it.",
    "",
    "Tycho",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${subject}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .bg { background: #121211 !important; }
    .ink { color: #f0efec !important; }
    .ink2 { color: #c3c2b7 !important; }
    .code { background: #1f1f1d !important; color: #f0efec !important; border-color: #3a3936 !important; }
    .rule { border-color: #2c2c2a !important; }
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background:#fcfcfb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#fcfcfb;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td class="ink" style="font-size:15px;font-weight:600;color:#0b0b0b;padding:0 0 32px;">Tycho</td></tr>
<tr><td class="ink" style="font-size:22px;line-height:1.25;font-weight:600;color:#0b0b0b;padding:0 0 12px;">Your sign-in code</td></tr>
<tr><td class="ink2" style="font-size:15px;line-height:1.5;color:#52514e;padding:0 0 24px;">Enter it on the sign-in page. It works once, for ${minutes} minutes.</td></tr>
<tr><td style="padding:0 0 32px;">
  <div class="code" style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;line-height:1;letter-spacing:8px;font-weight:600;color:#0b0b0b;background:#f3f2ee;border:1px solid #e1e0d9;border-radius:10px;padding:16px 16px 16px 24px;">${code}</div>
</td></tr>
<tr><td class="ink2 rule" style="font-size:13px;line-height:1.5;color:#52514e;border-top:1px solid #e1e0d9;padding:16px 0 0;">If you did not ask for this code, you can ignore this email. No one can sign in without it.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { to, subject, text, html };
}
