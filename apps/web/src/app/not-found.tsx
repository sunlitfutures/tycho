import Link from "next/link";
import { AuthShell, StepHeading } from "@/components/shell";

export default function NotFound() {
  return (
    <AuthShell>
      <StepHeading title="Page not found">
        <p>There is nothing at this address.</p>
      </StepHeading>
      <Link href="/" className="text-[15px] text-ink underline decoration-ink/30 underline-offset-[3px]">
        Go to Tycho
      </Link>
    </AuthShell>
  );
}
