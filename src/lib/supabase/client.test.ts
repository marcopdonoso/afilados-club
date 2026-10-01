import { createBrowserClient } from "@supabase/ssr";
import { expect, test, vi } from "vitest";

import { createClient } from "./client";

vi.mock("@supabase/ssr", () => ({ createBrowserClient: vi.fn() }));

test("does not create a browser client without configuration", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  expect(createClient()).toBeNull();
  expect(createBrowserClient).not.toHaveBeenCalled();
});

test("passes only public configuration to the SSR browser factory", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  createClient();
  expect(createBrowserClient).toHaveBeenCalledWith(
    "http://127.0.0.1:54321",
    "test-publishable-key",
  );
});
