import { redirect } from "next/navigation";

import { ClubEntry, type EntryError } from "@/features/auth/club-entry";
import { getCurrentClubAccess } from "@/lib/auth/member";

export default async function EntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: input } = await searchParams;
  const error: EntryError | undefined =
    input === "access" || input === "oauth" || input === "logout"
      ? input
      : undefined;
  const { member, hasIdentity } = await getCurrentClubAccess();
  if (member && error !== "logout") redirect("/");
  return (
    <ClubEntry
      error={error ?? (hasIdentity && !member ? "access" : undefined)}
      hasIdentity={hasIdentity}
    />
  );
}
