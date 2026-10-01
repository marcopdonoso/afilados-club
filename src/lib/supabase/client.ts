"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./env";

export function createClient() {
  const config = getSupabaseConfig();
  if (!config) return null;

  return createBrowserClient(config.url, config.publishableKey);
}
