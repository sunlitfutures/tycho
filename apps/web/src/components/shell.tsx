import Link from "next/link";
import type { ReactNode } from "react";

export const SOURCE_URL = "https://github.com/sunlitfutures/tycho";

/** The name, with a small crater mark (Tycho is a crater on the Moon). */
export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="-m-2 inline-flex items-center gap-2 rounded-lg p-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="10.5" cy="7.5" r="2.25" fill="currentColor" />
      </svg>
      Tycho
    </Link>
  );
}

/** The frame for the sign-in steps: the name on top, one narrow column, the source link below. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-6 pt-5 sm:px-8 sm:pt-7">
        <Wordmark href="/sign-in" />
      </header>
      <main id="main" className="flex flex-1 justify-center px-6 pt-[clamp(2.5rem,11vh,7rem)] pb-16 sm:px-8">
        <div className="w-full max-w-[22.5rem] motion-safe:animate-enter">{children}</div>
      </main>
      <footer className="px-6 pb-6 text-[13px] text-ink-3 sm:px-8">
        Tycho is open source.{" "}
        <a href={SOURCE_URL} className="text-ink-2 underline decoration-ink-3/40 underline-offset-[3px] [@media(hover:hover)]:hover:decoration-ink-2">
          Read the code
        </a>
      </footer>
    </div>
  );
}

export function StepHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      {children ? <div className="mt-2.5 text-[15px] leading-normal text-ink-2">{children}</div> : null}
    </div>
  );
}
