"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ClockIcon, MailIcon, OfflineIcon } from "@/components/icons";
import { Button, inputClass, Message } from "@/components/ui";
import { post } from "@/lib/client";
import { formatWait } from "@/components/wait";

type Problem = { field: boolean; icon?: typeof MailIcon; text: ReactNode };

export function EmailForm({ signedOut }: { signedOut: boolean }) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const email = (new FormData(e.currentTarget).get("email") as string).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProblem({ field: true, text: "Enter an email address, like name@example.com." });
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    const answer = await post("/api/auth/start", { email });
    if (!answer.network && answer.status === 200) {
      router.push("/sign-in/code");
      return; // stay busy until the code page shows
    }
    setBusy(false);
    setProblem(describe(answer));
    inputRef.current?.focus();
  }

  const errorId = `${id}-error`;
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-email`} className="mb-2 block text-sm font-medium text-ink">
        Email
      </label>
      <input
        ref={inputRef}
        id={`${id}-email`}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        required
        autoFocus
        placeholder="name@example.com"
        aria-invalid={problem?.field || undefined}
        aria-describedby={problem ? errorId : undefined}
        onChange={() => problem?.field && setProblem(null)}
        className={inputClass}
      />
      <div role="alert">
        {problem ? (
          <div className="pt-3">
            <Message tone="error" id={errorId} icon={problem.icon}>
              {problem.text}
            </Message>
          </div>
        ) : null}
      </div>
      <Button type="submit" busy={busy} busyLabel="Sending code" className="mt-5">
        Continue
      </Button>
      <div role="status">
        {signedOut && !problem && !busy ? (
          <div className="mt-6">
            <Message tone="info">You signed out.</Message>
          </div>
        ) : null}
      </div>
    </form>
  );
}

function describe(answer: Awaited<ReturnType<typeof post>>): Problem {
  if (answer.network) return { field: false, icon: OfflineIcon, text: "Can’t reach Tycho. Check your connection and try again." };
  const { error, scope, retryInMs } = answer.data as { error?: string; scope?: string; retryInMs?: number };
  if (error === "invalid_email") return { field: true, text: "Enter an email address, like name@example.com." };
  if (error === "rate_limited") {
    const wait = formatWait(Number(retryInMs) || 60_000);
    return {
      field: false,
      icon: ClockIcon,
      text: scope === "ip" ? `Too many sign-in attempts from this network. Try again in ${wait}.` : `Too many codes for this email. Try again in ${wait}.`,
    };
  }
  if (error === "mail_failed") return { field: false, icon: MailIcon, text: "We couldn’t send the email. Try again in a moment." };
  return { field: false, text: "Something went wrong on our side. Try again in a moment." };
}
