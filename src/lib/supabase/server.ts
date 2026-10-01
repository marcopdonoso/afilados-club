import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "./env";

// Read-only Server Component client. The proxy owns cookie and cache-header writes.
// Do not use this helper for future session-mutating actions or route handlers.
export async function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: { getAll: () => cookieStore.getAll() },
  });
}
