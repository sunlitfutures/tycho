import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import { AlertIcon, CheckIcon, Spinner } from "./icons";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet";
  /** Shows a spinner beside the label and blocks a second press. */
  busy?: boolean;
  busyLabel?: string;
};

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] font-medium " +
  "transition-[background-color,color,box-shadow,opacity] duration-150 ease-out " +
  "motion-safe:transition-[background-color,color,box-shadow,opacity,scale] motion-safe:active:scale-[0.96] " +
  "disabled:cursor-not-allowed aria-busy:cursor-progress";

const variants = {
  primary: "h-12 w-full px-5 text-[15px] bg-ink text-bg [@media(hover:hover)]:hover:bg-ink/92 disabled:bg-sunken disabled:text-ink-2 disabled:shadow-[inset_0_0_0_1px_var(--color-line)] aria-busy:bg-ink/88",
  secondary:
    "h-10 px-3.5 text-sm text-ink bg-raised shadow-[inset_0_0_0_1px_var(--color-field)] [@media(hover:hover)]:hover:shadow-[inset_0_0_0_1px_var(--color-field-hover)] [@media(hover:hover)]:hover:bg-sunken",
  quiet:
    "h-11 -mx-2 px-2 text-[15px] text-ink underline decoration-ink/30 underline-offset-[3px] [@media(hover:hover)]:hover:decoration-ink disabled:text-ink-3 disabled:no-underline motion-safe:active:scale-100",
};

export function Button({ variant = "primary", busy, busyLabel, children, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={busy ? (e) => e.preventDefault() : props.onClick}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {busy ? <Spinner /> : null}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
}

type Tone = "error" | "info";

/** A status line: an icon and words, and color only as a third cue. */
export function Message({ tone, icon: IconComp, children, id }: { tone: Tone; icon?: ComponentType<{ size?: number; className?: string }>; children: ReactNode; id?: string }) {
  const Glyph = IconComp ?? (tone === "error" ? AlertIcon : CheckIcon);
  return (
    <p id={id} className={`flex items-start gap-2 text-sm leading-5 motion-safe:animate-message ${tone === "error" ? "text-danger" : "text-ink-2"}`}>
      <Glyph size={16} className={`mt-0.5 shrink-0 ${tone === "info" ? "text-info" : ""}`} />
      <span>
        <span className="sr-only">{tone === "error" ? "Error: " : ""}</span>
        {children}
      </span>
    </p>
  );
}

export const inputClass =
  "block h-12 w-full rounded-[10px] bg-raised px-3.5 text-base text-ink placeholder:text-ink-3 " +
  "shadow-[inset_0_0_0_1px_var(--color-field)] transition-[box-shadow] duration-150 ease-out " +
  "[@media(hover:hover)]:hover:shadow-[inset_0_0_0_1px_var(--color-field-hover)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus " +
  "aria-invalid:shadow-[inset_0_0_0_2px_var(--color-danger)] disabled:opacity-60";
