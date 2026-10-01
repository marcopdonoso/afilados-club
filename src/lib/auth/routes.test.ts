import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { GET as callback } from "@/app/auth/callback/route";
import { GET as google } from "@/app/auth/google/route";
import { POST as logout } from "@/app/auth/logout/route";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
const subject = "00000000-0000-0000-0000-000000000001";
let adapter: CookieMethodsServer;
const getClaims = vi.fn();
const getSession = vi.fn();
const signInWithOAuth = vi.fn();
const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const cacheHeaders = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:56321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  getClaims
    .mockReset()
    .mockResolvedValue({ data: { claims: { sub: subject } }, error: null });
  maybeSingle.mockReset().mockResolvedValue({
    data: {
      id: subject,
      display_name: "Fixture member",
      auth_user_id: subject,
      is_active: true,
    },
    error: null,
  });
  eq.mockReset().mockReturnValue({ eq, maybeSingle });
  select.mockReset().mockReturnValue({ eq });
  from.mockReset().mockReturnValue({ select });
  exchangeCodeForSession.mockReset().mockImplementation(async () => {
    await adapter.setAll?.(
      [
        {
          name: "session.0",
          value: "test-only-session",
          options: { path: "/" },
        },
      ],
      cacheHeaders,
    );
    await adapter.setAll?.(
      [{ name: "verifier", value: "", options: { path: "/", maxAge: 0 } }],
      {},
    );
    return { error: null };
  });
  signOut.mockReset().mockImplementation(async () => {
    await adapter.setAll?.(
      [{ name: "session.0", value: "", options: { path: "/", maxAge: 0 } }],
      {},
    );
    return { error: null };
  });
  signInWithOAuth.mockReset().mockImplementation(async () => {
    await adapter.setAll?.(
      [{ name: "verifier", value: "test-only-pkce", options: { path: "/" } }],
      cacheHeaders,
    );
    return {
      data: { url: "http://127.0.0.1:56321/auth/v1/authorize?provider=google" },
      error: null,
    };
  });
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    adapter = options.cookies;
    return {
      auth: {
        getClaims,
        getSession,
        signInWithOAuth,
        exchangeCodeForSession,
        signOut,
      },
      from,
    } as unknown as ReturnType<typeof createServerClient>;
  });
});

const request = (path: string) =>
  new NextRequest(`http://localhost:3000${path}`);
const location = (response: Response) =>
  new URL(response.headers.get("location")!).pathname +
  new URL(response.headers.get("location")!).search;

test("Google PKCE uses the approved request origin and preserves verifier/cache headers", async () => {
  const response = await google(
    new NextRequest("http://localhost:3000/auth/google", {
      headers: { "x-forwarded-host": "evil.example" },
    }),
  );
  expect(signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "http://localhost:3000/auth/callback" },
  });
  expect(response.headers.get("location")).toBe(
    "http://127.0.0.1:56321/auth/v1/authorize?provider=google",
  );
  expect(response.cookies.get("verifier")?.value).toBe("test-only-pkce");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

test.each([
  "https://evil.example",
  "javascript:alert(1)",
  "http://127.0.0.1:56321/auth/v1/authorize?provider=github",
])("invalid provider redirect %s is never followed", async (url) => {
  signInWithOAuth.mockResolvedValue({ data: { url }, error: null });
  expect(location(await google(request("/auth/google")))).toBe(
    "/entrar?error=oauth",
  );
});

test("OAuth errors, missing config and thrown requests become generic failures", async () => {
  signInWithOAuth.mockResolvedValueOnce({
    data: { url: null },
    error: new Error("private provider failure"),
  });
  expect(location(await google(request("/auth/google")))).toBe(
    "/entrar?error=oauth",
  );
  signInWithOAuth.mockRejectedValueOnce(new Error("network"));
  expect(location(await google(request("/auth/google")))).toBe(
    "/entrar?error=oauth",
  );
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  expect(location(await google(request("/auth/google")))).toBe(
    "/entrar?error=oauth",
  );
});

test("untrusted request origins reject before OAuth/client creation", async () => {
  expect(
    (await google(new NextRequest("https://evil.example/auth/google"))).status,
  ).toBe(400);
  expect(
    (
      await callback(
        new NextRequest("https://evil.example/auth/callback?code=test"),
      )
    ).status,
  ).toBe(400);
  expect(createServerClient).not.toHaveBeenCalled();
});

test.each([
  "https://evil.example",
  "//evil.example",
  "\\evil.example",
  "javascript:alert(1)",
  "%2f%2fevil.example",
  "%5cevil.example",
  "/safe-looking",
])(
  "callback ignores untrusted next %s and always returns approved Home",
  async (next) => {
    const response = await callback(
      request(
        `/auth/callback?code=fixture-code&next=${encodeURIComponent(next)}`,
      ),
    );
    expect(location(response)).toBe("/");
    expect(response.headers.get("location")).toBe("http://localhost:3000/");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("fixture-code");
    expect(getClaims).toHaveBeenCalledOnce();
    expect(getSession).not.toHaveBeenCalled();
    expect(response.cookies.get("session.0")?.value).toBe("test-only-session");
    expect(response.cookies.get("verifier")).toMatchObject({
      value: "",
      maxAge: 0,
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  },
);

test.each([
  "/auth/callback",
  "/auth/callback?error=access_denied&error_description=private",
  "/auth/callback?code=test&error=unexpected",
])("invalid callback %s is safely generic", async (path) => {
  expect(location(await callback(request(path)))).toBe("/entrar?error=oauth");
  expect(exchangeCodeForSession).not.toHaveBeenCalled();
});

test("callback exchange failure preserves pending deletions and never queries membership", async () => {
  exchangeCodeForSession.mockImplementation(async () => {
    await adapter.setAll?.(
      [{ name: "verifier", value: "", options: { maxAge: 0, path: "/" } }],
      cacheHeaders,
    );
    return { error: new Error("bad code") };
  });
  const response = await callback(request("/auth/callback?code=test"));
  expect(location(response)).toBe("/entrar?error=oauth");
  expect(getClaims).not.toHaveBeenCalled();
  expect(response.cookies.get("verifier")?.maxAge).toBe(0);
});

test("valid identity without active membership is signed out and cookies deleted", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null });
  signOut.mockImplementation(async () => {
    expect(await adapter.getAll()).toContainEqual({
      name: "session.0",
      value: "test-only-session",
    });
    await adapter.setAll?.(
      [{ name: "session.0", value: "", options: { path: "/", maxAge: 0 } }],
      {},
    );
    return { error: null };
  });
  const response = await callback(request("/auth/callback?code=test"));
  expect(location(response)).toBe("/entrar?error=access");
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(response.cookies.get("session.0")?.maxAge).toBe(0);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

test("invalid verified claims cannot grant access after exchange", async () => {
  getClaims.mockResolvedValue({ data: null, error: new Error("invalid") });
  expect(location(await callback(request("/auth/callback?code=test")))).toBe(
    "/entrar?error=oauth",
  );
  expect(from).not.toHaveBeenCalled();
  expect(signOut).toHaveBeenCalledOnce();
});

test("callback cleanup failure is reported honestly", async () => {
  maybeSingle.mockResolvedValue({ data: null, error: null });
  signOut.mockResolvedValue({ error: new Error("unavailable") });
  expect(location(await callback(request("/auth/callback?code=test")))).toBe(
    "/entrar?error=logout",
  );
  signOut.mockRejectedValueOnce(new Error("network"));
  expect(location(await callback(request("/auth/callback?code=test")))).toBe(
    "/entrar?error=logout",
  );
});

test("POST logout clears session then redirects with 303 and anti-cache headers", async () => {
  const response = await logout(
    new NextRequest("http://localhost:3000/auth/logout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  expect(response.status).toBe(303);
  expect(location(response)).toBe("/entrar");
  expect(response.cookies.get("session.0")?.maxAge).toBe(0);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

test.each([undefined, "https://evil.example", "null"])(
  "POST logout rejects invalid Origin %s",
  async (origin) => {
    const response = await logout(
      new NextRequest("http://localhost:3000/auth/logout", {
        method: "POST",
        headers: origin ? { origin } : {},
      }),
    );
    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  },
);

test("logout API errors, throws and missing config never pretend success", async () => {
  const makeRequest = () =>
    new NextRequest("http://localhost:3000/auth/logout", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
  signOut.mockResolvedValueOnce({ error: new Error("unavailable") });
  expect(location(await logout(makeRequest()))).toBe("/entrar?error=logout");
  signOut.mockRejectedValueOnce(new Error("network"));
  expect(location(await logout(makeRequest()))).toBe("/entrar?error=logout");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  expect(location(await logout(makeRequest()))).toBe("/entrar?error=logout");
});
