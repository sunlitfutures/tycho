import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { AuthShell } from "@/components/shell";
import { currentUser } from "@/lib/auth/current";
import { normalizeEmail } from "@/lib/auth/email";
import { PENDING_COOKIE } from "@/lib/auth/http";
import { codeState } from "@/lib/auth/login";
import { CodeForm } from "./code-form";

export const metadata: Metadata = { title: "Enter your code" };

export default async function CodePage() {
  if (await currentUser()) redirect("/");
  const email = normalizeEmail((await cookies()).get(PENDING_COOKIE)?.value);
  if (!email) redirect("/sign-in");
  const now = new Date();
  const state = await codeState(getDb(), email, now);
  return (
    <AuthShell>
      <CodeForm email={email} initialState={state.state} resendInMs={state.resendAt.getTime() - now.getTime()} />
    </AuthShell>
  );
}
