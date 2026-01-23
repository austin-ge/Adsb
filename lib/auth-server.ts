import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const getServerSession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
});

export async function requireAuth() {
  const session = await getServerSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
