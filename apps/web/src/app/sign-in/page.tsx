import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current";
import { AuthShell, StepHeading } from "@/components/shell";
import { EmailForm } from "./email-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (await currentUser()) redirect("/");
  const params = await searchParams;
  return (
    <AuthShell>
      <StepHeading title="Sign in to Tycho">
        <p>We’ll email you a 6-digit code. New here? The same code makes your account.</p>
      </StepHeading>
      <EmailForm signedOut={params["signed-out"] === "1"} />
    </AuthShell>
  );
}
