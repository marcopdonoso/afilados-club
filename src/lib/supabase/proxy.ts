import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseConfig } from "./env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return response;

  const pendingCookies = new Map<
    string,
    Parameters<SetAllCookies>[0][number]
  >();
  const pendingHeaders = new Headers();

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pendingCookies.set(cookie.name, cookie);
        }
        for (const [name, value] of Object.entries(headers)) {
          pendingHeaders.set(name, value);
        }

        // Later writes omit cache headers: retain all earlier writes when rebuilding.
        response = NextResponse.next({ request });
        for (const { name, value, options } of pendingCookies.values()) {
          response.cookies.set(name, value, options);
        }
        pendingHeaders.forEach((value, name) =>
          response.headers.set(name, value),
        );
      },
    },
  });

  // Verify identity and refresh early; cookie contents alone are not trusted.
  // There are deliberately no guards, redirects, or authentication flows here.
  await supabase.auth.getClaims();

  return response;
}
