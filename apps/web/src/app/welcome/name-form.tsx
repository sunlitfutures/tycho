"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { OfflineIcon } from "@/components/icons";
import { Button, inputClass, Message } from "@/components/ui";
import { post } from "@/lib/client";

const MAX = 60;

export function NameForm() {
  const router = useRouter();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; field: boolean; offline?: boolean } | null>(null);
  const clean = name.replace(/\s+/g, " ").trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!clean) {
      setProblem({ text: "Enter your name.", field: true });
      inputRef.current?.focus();
      return;
    }
    if (clean.length > MAX) {
      setProblem({ text: `Keep it to ${MAX} characters or fewer.`, field: true });
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    const answer = await post("/api/auth/name", { name: clean });
    if (!answer.network && answer.status === 200) {
      router.replace("/");
      return;
    }
    setBusy(false);
    if (answer.network) setProblem({ text: "Can’t reach Tycho. Check your connection and try again.", field: false, offline: true });
    else if (answer.status === 401) router.replace("/sign-in");
    else if (answer.data.error === "invalid_name") setProblem({ text: "Enter your name.", field: true });
    else setProblem({ text: "Something went wrong on our side. Try again in a moment.", field: false });
    inputRef.current?.focus();
  }

  const errorId = `${id}-error`;
  const previewId = `${id}-preview`;
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={`${id}-name`} className="mb-2 block text-sm font-medium text-ink">
        Name
      </label>
      <input
        ref={inputRef}
        id={`${id}-name`}
        name="name"
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="done"
        required
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (problem?.field) setProblem(null);
        }}
        aria-invalid={problem?.field || undefined}
        aria-describedby={[problem ? errorId : "", previewId].filter(Boolean).join(" ")}
        className={inputClass}
      />
      <div role="alert">
        {problem ? (
          <div className="pt-3">
            <Message tone="error" id={errorId} icon={problem.offline ? OfflineIcon : undefined}>
              {problem.text}
            </Message>
          </div>
        ) : null}
      </div>
      <p id={previewId} className="mt-4 flex min-h-11 items-center gap-2.5 rounded-[10px] bg-sunken px-3.5 text-sm text-ink-2">
        <AgentDot />
        <span className="min-w-0 truncate">
          Your agent: <span className="font-medium text-ink">{clean ? `${clean}’s agent` : "Your name’s agent"}</span>
        </span>
      </p>
      <Button type="submit" busy={busy} busyLabel="Saving" className="mt-5">
        Continue
      </Button>
    </form>
  );
}

function AgentDot() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" className="shrink-0 text-ink-3">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}
