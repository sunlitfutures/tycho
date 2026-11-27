"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type ComponentType, type FormEvent } from "react";
import { AlertIcon, ArrowLeftIcon, ClockIcon, LockIcon, MailIcon, OfflineIcon } from "@/components/icons";
import { StepHeading } from "@/components/shell";
import { Button, Message } from "@/components/ui";
import { formatClock, formatWait } from "@/components/wait";
import { post, type Answer } from "@/lib/client";

const LENGTH = 6;

type Problem = { text: string; icon?: ComponentType<{ size?: number; className?: string }>; marksField?: boolean };
type CodeState = "open" | "expired" | "too_many_tries" | "none";

const DEAD: Record<Exclude<CodeState, "open">, Problem> = {
  expired: { text: "That code expired. Send a new one.", icon: ClockIcon },
  too_many_tries: { text: "Too many wrong tries. Send a new code.", icon: LockIcon },
  none: { text: "That code no longer works. Send a new one.", icon: AlertIcon },
};

const OFFLINE: Problem = { text: "Can’t reach Tycho. Check your connection and try again.", icon: OfflineIcon };

export function CodeForm({ email, initialState, resendInMs }: { email: string; initialState: CodeState; resendInMs: number }) {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phase, setPhase] = useState<"idle" | "verifying" | "done">("idle");
  const [dead, setDead] = useState(initialState !== "open");
  const [problem, setProblem] = useState<Problem | null>(initialState === "open" ? null : DEAD[initialState]);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // The resend countdown, on this browser's clock (the server sends a duration, not a time).
  const [resendAt, setResendAt] = useState(() => Date.now() + resendInMs);
  const [now, setNow] = useState(() => Date.now());
  const waitS = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (waitS <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [waitS > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // autoFocus can land before hydration, when onFocus is not wired yet.
  useEffect(() => {
    if (document.activeElement === inputRef.current) setFocused(true);
  }, []);

  const focusInput = () => requestAnimationFrame(() => inputRef.current?.focus());

  const verify = useCallback(
    async (code: string) => {
      if (submitting.current) return;
      if (code.length !== LENGTH) {
        setProblem({ text: `Enter all ${LENGTH} digits.`, marksField: true });
        focusInput();
        return;
      }
      submitting.current = true;
      setPhase("verifying");
      setProblem(null);
      setNotice("");
      const answer = await post("/api/auth/verify", { code });
      if (!answer.network && answer.status === 200) {
        setPhase("done");
        router.replace(String(answer.data.next ?? "/"));
        return;
      }
      submitting.current = false;
      setPhase("idle");
      handleVerifyFailure(answer);
    },
    [router], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleVerifyFailure(answer: Answer) {
    if (answer.network) {
      setProblem(OFFLINE); // keep the digits; Verify tries again
      focusInput();
      return;
    }
    const data = answer.data as { error?: string; triesLeft?: number; retryInMs?: number };
    switch (data.error) {
      case "wrong_code": {
        const left = Number(data.triesLeft);
        setProblem({ text: `That code isn’t right. ${left} ${left === 1 ? "try" : "tries"} left.`, marksField: true });
        break;
      }
      case "invalid_code":
        setProblem({ text: `Enter all ${LENGTH} digits.`, marksField: true });
        break;
      case "expired":
      case "too_many_tries":
      case "no_code":
        setDead(true);
        setProblem(DEAD[data.error === "no_code" ? "none" : data.error]);
        setValue("");
        return;
      case "rate_limited":
        setProblem({ text: `Too many tries from this network. Try again in ${formatWait(Number(data.retryInMs) || 60_000)}.`, icon: ClockIcon });
        break;
      default:
        setProblem({ text: "Something went wrong on our side. Try again in a moment." });
    }
    setValue("");
    setShakeKey((k) => k + 1);
    focusInput();
  }

  async function resend() {
    if (sending || waitS > 0) return;
    setSending(true);
    setNotice("");
    const answer = await post("/api/auth/start", { resend: true });
    setSending(false);
    if (!answer.network && answer.status === 200) {
      setResendAt(Date.now() + Number(answer.data.resendInMs ?? 60_000));
      setNow(Date.now());
      setDead(false);
      setProblem(null);
      setValue("");
      setNotice("We sent a new code. Codes from earlier emails no longer work.");
      focusInput();
      return;
    }
    if (answer.network) return setProblem(OFFLINE);
    const data = answer.data as { error?: string; scope?: string; retryInMs?: number };
    if (data.error === "no_email") return router.replace("/sign-in");
    if (data.error === "rate_limited") {
      const ms = Number(data.retryInMs) || 60_000;
      setResendAt(Date.now() + ms);
      setNow(Date.now());
      setProblem({
        text: data.scope === "ip" ? `Too many sign-in attempts from this network. Try again in ${formatWait(ms)}.` : `Too many codes for this email. Try again in ${formatWait(ms)}.`,
        icon: ClockIcon,
      });
      return;
    }
    if (data.error === "mail_failed") return setProblem({ text: "We couldn’t send the email. Try again in a moment.", icon: MailIcon });
    setProblem({ text: "Something went wrong on our side. Try again in a moment." });
  }

  // Six digits in: check them right away.
  useEffect(() => {
    if (value.length === LENGTH && !dead && phase === "idle" && !problem) void verify(value);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function take(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setValue(digits);
    if (problem && !dead) setProblem(null);
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length >= LENGTH) {
      e.preventDefault();
      take(digits);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (dead) return void resend();
    void verify(value);
  }

  const busy = phase !== "idle";
  const active = Math.min(value.length, LENGTH - 1);
  const errorId = `${id}-error`;
  const inputId = `${id}-code`;
  const markField = Boolean(problem?.marksField) && value.length === 0;

  return (
    <>
      <StepHeading title="Check your email">
        <p>
          Enter the {LENGTH}-digit code we sent to <span className="font-medium break-all text-ink">{email}</span>.
        </p>
        <Link
          href="/sign-in"
          className="mt-3 -ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-[15px] text-ink underline decoration-ink/30 underline-offset-[3px] [@media(hover:hover)]:hover:decoration-ink"
        >
          <ArrowLeftIcon size={16} className="shrink-0 text-ink-2" />
          Use a different email
        </Link>
      </StepHeading>

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-ink">
          Code
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={LENGTH + 8 /* room for a pasted "123 456" */}
            enterKeyHint="go"
            autoFocus={!dead}
            spellCheck={false}
            value={value}
            disabled={dead}
            readOnly={busy}
            aria-invalid={markField || undefined}
            aria-describedby={problem ? errorId : undefined}
            onChange={(e) => take(e.target.value)}
            onPaste={onPaste}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSelect={(e) => {
              // Keep the caret at the end: the boxes fill left to right.
              const el = e.currentTarget;
              if (el.selectionStart !== el.value.length) el.setSelectionRange(el.value.length, el.value.length);
            }}
            className="otp-input absolute inset-0 z-0 h-full w-full rounded-[10px] text-base disabled:cursor-not-allowed"
          />
          <div
            key={shakeKey}
            aria-hidden="true"
            className={`pointer-events-none relative z-10 flex items-center gap-2 ${shakeKey ? "motion-safe:animate-shake" : ""}`}
          >
            {Array.from({ length: LENGTH }, (_, i) => (
              <Slot
                key={i}
                char={value[i]}
                active={focused && !dead && i === active}
                caret={focused && !dead && !busy && i === value.length}
                invalid={markField}
                dim={dead || busy}
                gapAfter={i === LENGTH / 2 - 1}
              />
            ))}
          </div>
        </div>

        <div role="alert">
          {problem ? (
            <div className="pt-3">
              <Message tone="error" id={errorId} icon={problem.icon}>
                {problem.text}
              </Message>
            </div>
          ) : null}
        </div>

        {dead ? (
          <Button type="submit" className="mt-5" busy={sending} busyLabel="Sending code" disabled={waitS > 0}>
            {waitS > 0 ? (
              <>
                Send a new code in <span className="tabular-nums">{formatClock(waitS)}</span>
              </>
            ) : (
              "Send a new code"
            )}
          </Button>
        ) : (
          <Button type="submit" className="mt-5" busy={busy} busyLabel={phase === "done" ? "Signing in" : "Checking code"}>
            Verify
          </Button>
        )}

        <div role="status" className="text-sm">
          {notice ? (
            <div className="pt-4">
              <Message tone="info">{notice}</Message>
            </div>
          ) : null}
        </div>

        {dead ? null : (
          <div className="mt-6 flex min-h-11 flex-wrap items-center gap-x-1.5 text-[15px] text-ink-2">
            <span>Didn’t get it?</span>
            {waitS > 0 ? (
              <span className="text-ink-3">
                Send a new code in <span className="tabular-nums">{formatClock(waitS)}</span>
              </span>
            ) : (
              <Button type="button" variant="quiet" onClick={resend} busy={sending} busyLabel="Sending" className="mx-0">
                Send a new code
              </Button>
            )}
          </div>
        )}
      </form>
    </>
  );
}

function Slot({ char, active, caret, invalid, dim, gapAfter }: { char?: string; active: boolean; caret: boolean; invalid: boolean; dim: boolean; gapAfter: boolean }) {
  const ring = invalid
    ? "shadow-[inset_0_0_0_2px_var(--color-danger)]"
    : active
      ? "shadow-[inset_0_0_0_2px_var(--color-focus)]"
      : "shadow-[inset_0_0_0_1px_var(--color-field)]";
  return (
    <>
      <div
        className={`flex h-14 max-w-12 min-w-0 flex-1 items-center justify-center rounded-[10px] text-[1.5rem] leading-none font-medium tabular-nums text-ink transition-[box-shadow,opacity,background-color] duration-150 ease-out ${ring} ${dim ? "bg-sunken opacity-60" : "bg-raised"}`}
      >
        {char ?? (caret ? <span className="h-6 w-[1.5px] rounded-full bg-ink motion-safe:animate-blink" /> : null)}
      </div>
      {gapAfter ? <span className="mx-1 h-[1.5px] w-2.5 shrink-0 rounded-full bg-field" /> : null}
    </>
  );
}
