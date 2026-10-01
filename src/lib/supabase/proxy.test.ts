import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { beforeEach, expect, test, vi } from "vitest";

import { proxy } from "@/proxy";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const getClaims = vi.fn();
const getSession = vi.fn();
let adapter: CookieMethodsServer;

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
  getClaims.mockReset().mockResolvedValue({ data: null, error: null });
  getSession.mockReset();
  vi.mocked(createServerClient).mockImplementation((_url, _key, options) => {
    adapter = options.cookies;
    return { auth: { getClaims, getSession } } as unknown as ReturnType<
      typeof createServerClient
    >;
  });
});

test.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"])(
  "passes through without a Supabase client when %s is absent",
  async (name) => {
    vi.stubEnv(name, "");
    const response = await proxy(new NextRequest("http://127.0.0.1/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.getAll()).toEqual([]);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getClaims).not.toHaveBeenCalled();
  },
);

test("preserves request/response cookies and anti-cache headers across successive writes", async () => {
  const request = new NextRequest("http://127.0.0.1/", {
    headers: { cookie: "existing=original" },
  });
  const cacheHeaders = {
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
  };
  getClaims.mockImplementation(async () => {
    expect(await adapter.getAll()).toEqual([
      { name: "existing", value: "original" },
    ]);
    await adapter.setAll?.(
      [
        {
          name: "sb-token",
          value: "refreshed",
          options: { path: "/", httpOnly: true, sameSite: "lax" },
        },
      ],
      cacheHeaders,
    );
    await adapter.setAll?.(
      [{ name: "obsolete", value: "", options: { path: "/", maxAge: 0 } }],
      {},
    );
    return { data: null, error: null };
  });

  const response = await proxy(request);

  expect(createServerClient).toHaveBeenCalledWith(
    "http://127.0.0.1:54321",
    "test-publishable-key",
    expect.any(Object),
  );
  expect(getClaims).toHaveBeenCalledOnce();
  expect(getSession).not.toHaveBeenCalled();
  expect(request.cookies.get("sb-token")?.value).toBe("refreshed");
  expect(response.headers.get("x-middleware-request-cookie")).toContain(
    "sb-token=refreshed",
  );
  expect(response.cookies.get("sb-token")).toMatchObject({
    value: "refreshed",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  expect(response.cookies.get("obsolete")).toMatchObject({
    value: "",
    maxAge: 0,
  });
  for (const [name, value] of Object.entries(cacheHeaders)) {
    expect(response.headers.get(name)).toBe(value);
  }
  expect(response.headers.get("location")).toBeNull();
});
