import type { ReactNode } from "react";

import { requireClubMember } from "@/lib/auth/member";

export default async function ClubLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireClubMember();
  return children;
}
