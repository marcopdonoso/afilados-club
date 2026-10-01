import { connection } from "next/server";

import { SeasonHome } from "@/features/season/season-home";

async function getRequestTimestamp() {
  // Request data is read after the prerender boundary, not during JSX composition.
  await connection();
  return Date.now();
}

export default async function Home() {
  const initialNow = await getRequestTimestamp();
  return <SeasonHome initialNow={initialNow} />;
}
