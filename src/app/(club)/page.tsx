import { connection } from "next/server";

import { SeasonHome } from "@/features/season/season-home";
import { requireClubMember } from "@/lib/auth/member";

async function getRequestTimestamp() {
  // Request data is read after the prerender boundary, not during JSX composition.
  await connection();
  return Date.now();
}

export default async function Home() {
  const member = await requireClubMember();
  const initialNow = await getRequestTimestamp();
  return <SeasonHome initialNow={initialNow} member={member} />;
}
