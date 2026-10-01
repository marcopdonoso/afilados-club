import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { createRouteClient } from "./route";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
let adapter: CookieMethodsServer;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    adapter = options.cookies;
    return {} as ReturnType<typeof createServerClient>;
  });
});

test("request-scoped writable view preserves chunks, deletion and first headers on final redirect", async () => {
  const request = new NextRequest("http://localhost:3000/auth/callback", {
    headers: { cookie: "old=original; unchanged=keep" },
  });
  const { finish } = createRouteClient(request);
  expect(await adapter.getAll()).toContainEqual({
    name: "old",
    value: "original",
  });
  await adapter.setAll?.(
    [
      {
        name: "token.0",
        value: "first",
        options: { path: "/", httpOnly: true, sameSite: "lax" },
      },
      { name: "token.1", value: "second", options: { path: "/" } },
    ],
    { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" },
  );
  await adapter.setAll?.(
    [
      { name: "old", value: "", options: { path: "/", maxAge: 0 } },
      {
        name: "token.0",
        value: "newest",
        options: { path: "/", httpOnly: true },
      },
    ],
    {},
  );
  expect(await adapter.getAll()).toEqual([
    { name: "unchanged", value: "keep" },
    { name: "token.0", value: "newest" },
    { name: "token.1", value: "second" },
  ]);
  const response = finish(NextResponse.redirect("http://localhost:3000/"));
  expect(response.headers.get("location")).toBe("http://localhost:3000/");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Pragma")).toBe("no-cache");
  expect(response.headers.get("Expires")).toBe("0");
  expect(response.cookies.get("old")).toMatchObject({ value: "", maxAge: 0 });
  expect(response.cookies.get("token.0")).toMatchObject({
    value: "newest",
    httpOnly: true,
  });
  expect(response.cookies.get("token.1")?.value).toBe("second");
});

test("separate clients never share pending cookies", async () => {
  const first = createRouteClient(
    new NextRequest("http://localhost:3000/auth/google"),
  );
  await adapter.setAll?.(
    [{ name: "first", value: "only", options: { path: "/" } }],
    {},
  );
  const second = createRouteClient(
    new NextRequest("http://localhost:3000/auth/google"),
  );
  expect(await adapter.getAll()).toEqual([]);
  expect(second.finish(new NextResponse()).cookies.getAll()).toEqual([]);
  expect(first.finish(new NextResponse()).cookies.get("first")?.value).toBe(
    "only",
  );
});

test("missing public config has no client and still marks redirects noncacheable", () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const { client, finish } = createRouteClient(
    new NextRequest("http://localhost:3000/auth/google"),
  );
  expect(client).toBeNull();
  expect(createServerClient).not.toHaveBeenCalled();
  expect(finish(new NextResponse()).headers.get("Cache-Control")).toContain(
    "no-store",
  );
});

test("invalid configured clients fail closed without discarding response headers", () => {
  vi.mocked(createServerClient).mockImplementationOnce(() => {
    throw new Error("invalid config");
  });
  const { client, finish } = createRouteClient(
    new NextRequest("http://localhost:3000/auth/google"),
  );
  expect(client).toBeNull();
  expect(finish(new NextResponse()).headers.get("Cache-Control")).toContain(
    "no-store",
  );
});

test("installed SSR client really persists a PKCE verifier through this adapter without network", async () => {
  const actual =
    await vi.importActual<typeof import("@supabase/ssr")>("@supabase/ssr");
  vi.mocked(createServerClient).mockImplementationOnce(
    actual.createServerClient,
  );
  const fetch = vi.fn(() => {
    throw new Error("Unexpected network request");
  });
  vi.stubGlobal("fetch", fetch);
  try {
    const { client, finish } = createRouteClient(
      new NextRequest("http://localhost:3000/auth/google"),
    );
    const { data, error } = await client!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback" },
    });
    expect(error).toBeNull();
    expect(new URL(data.url!).searchParams.get("code_challenge_method")).toBe(
      "s256",
    );
    const response = finish(NextResponse.redirect(data.url!));
    expect(
      response.cookies
        .getAll()
        .some(
          (cookie) =>
            cookie.name.endsWith("code-verifier") && cookie.value.length > 0,
        ),
    ).toBe(true);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
