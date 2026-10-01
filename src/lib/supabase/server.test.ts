import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { beforeEach, expect, test, vi } from "vitest";

import { createClient } from "./server";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
});

test("returns null without environment values or accessing request cookies", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

  expect(await createClient()).toBeNull();
  expect(cookies).not.toHaveBeenCalled();
  expect(createServerClient).not.toHaveBeenCalled();
});

test("creates fresh read-only clients using each request's cookie store", async () => {
  for (const value of ["first-request", "second-request"]) {
    const cookieStore = { getAll: () => [{ name: "sb-token", value }] };
    vi.mocked(cookies).mockResolvedValue(
      cookieStore as Awaited<ReturnType<typeof cookies>>,
    );
    await createClient();
    const options = vi.mocked(createServerClient).mock.lastCall?.[2];

    expect(await options?.cookies.getAll()).toEqual([
      { name: "sb-token", value },
    ]);
    // A read-only render must not silently drop cache headers while writing cookies.
    expect(options?.cookies.setAll).toBeUndefined();
  }
  expect(cookies).toHaveBeenCalledTimes(2);
  expect(createServerClient).toHaveBeenCalledTimes(2);
});
