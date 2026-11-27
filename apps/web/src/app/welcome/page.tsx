import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell, StepHeading } from "@/components/shell";
import { requireUser } from "@/lib/auth/current";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "Your name" };

export default async function WelcomePage() {
  const user = await requireUser({ allowNameless: true });
  if (user.name) redirect("/");
  return (
    <AuthShell>
      <StepHeading title="What’s your name?">
        <p>People you work with will see it, and your agent will go by it.</p>
      </StepHeading>
      <NameForm />
    </AuthShell>
  );
}
