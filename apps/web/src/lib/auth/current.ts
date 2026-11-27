import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { readSession } from "./session";
import { sessionToken } from "./http";

/** The signed-in user for this request, or null. Read once per request. */
export const currentUser = cache(async () => {
  const jar = await cookies();
  const found = await readSession(getDb(), sessionToken(jar));
  return found?.user ?? null;
});

/** The signed-in user, or a redirect to sign in. Sends a nameless user to the name step. */
export async function requireUser(opts: { allowNameless?: boolean } = {}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!user.name && !opts.allowNameless) redirect("/welcome");
  return user;
}
