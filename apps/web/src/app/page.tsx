import type { Metadata } from "next";
import { PathsIcon } from "@/components/icons";
import { SOURCE_URL, Wordmark } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Scenarios" };

export default async function HomePage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center justify-between gap-4 border-b border-line px-6 sm:h-[4.5rem] sm:px-8">
        <Wordmark />
        <div className="flex min-w-0 items-center gap-3">
          <p className="hidden min-w-0 truncate text-sm text-ink-2 sm:block">
            <span className="sr-only">Signed in as </span>
            <span className="font-medium text-ink">{user.name}</span>
            <span aria-hidden="true" className="px-1.5 text-ink-3">
              ·
            </span>
            {user.email}
          </p>
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-[10px] bg-raised px-3.5 text-sm font-medium text-ink shadow-[inset_0_0_0_1px_var(--color-field)] transition-[box-shadow,background-color,scale] duration-150 ease-out motion-safe:active:scale-[0.96] [@media(hover:hover)]:hover:bg-sunken"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-6 pt-10 pb-16 sm:px-8 sm:pt-14 motion-safe:animate-enter">
        <h1 className="text-[1.625rem] leading-[1.15] font-semibold tracking-[-0.02em] text-ink">Scenarios</h1>
        <p className="mt-2 text-[15px] text-ink-2 sm:hidden">
          Signed in as <span className="font-medium text-ink">{user.name}</span>
        </p>

        <section aria-labelledby="empty-title" className="mt-8 rounded-2xl border border-dashed border-field px-6 py-12 text-center sm:py-16">
          <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-xl bg-sunken text-ink-2">
            <PathsIcon size={24} />
          </div>
          <h2 id="empty-title" className="text-base font-semibold text-ink">
            No scenarios yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-[30ch] text-[15px] text-ink-2">
            A scenario maps how one question could play out, from where it starts to each outcome.
          </p>
          <p className="mx-auto mt-4 max-w-[34ch] text-sm text-ink-3">
            Making scenarios is coming next.{" "}
            <a href={SOURCE_URL} className="text-ink-2 underline decoration-ink-3/40 underline-offset-[3px] [@media(hover:hover)]:hover:decoration-ink-2">
              Follow along
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
