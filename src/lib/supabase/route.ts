import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./env";

export function createRouteClient(request: NextRequest) {
  const config = getSupabaseConfig();
  const cookieView = new Map(
    request.cookies.getAll().map(({ name, value }) => [name, value]),
  );
  const pendingCookies = new Map<
    string,
    Parameters<SetAllCookies>[0][number]
  >();
  const pendingHeaders = new Headers({
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
  });

  let client: ReturnType<typeof createServerClient> | null = null;
  if (config) {
    try {
      client = createServerClient(config.url, config.publishableKey, {
        cookies: {
          getAll: () =>
            Array.from(cookieView, ([name, value]) => ({ name, value })),
          setAll(cookies, headers) {
            for (const cookie of cookies) {
              if (cookie.options.maxAge === 0) cookieView.delete(cookie.name);
              else cookieView.set(cookie.name, cookie.value);
              pendingCookies.set(cookie.name, cookie);
            }
            for (const [name, value] of Object.entries(headers)) {
              pendingHeaders.set(name, value);
            }
          },
        },
      });
    } catch {
      // Invalid configuration must produce a safe auth failure, never a redirect leak.
      client = null;
    }
  }

  function finish(response: NextResponse) {
    for (const { name, value, options } of pendingCookies.values()) {
      response.cookies.set(name, value, options);
    }
    pendingHeaders.forEach((value, name) => response.headers.set(name, value));
    return response;
  }

  return { client, finish };
}
