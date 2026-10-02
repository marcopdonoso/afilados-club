import { NextResponse, type NextRequest } from "next/server";

import { getTrustedOrigin } from "@/lib/auth/origin";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const origin = getTrustedOrigin(request.url);
  if (!origin) return new NextResponse("Solicitud no válida.", { status: 400 });
  const { client, finish } = createRouteClient(request);
  const failure = () =>
    finish(NextResponse.redirect(new URL("/entrar?error=oauth", origin)));
  if (!client) return failure();

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error || !data.url) return failure();
    const destination = new URL(data.url);
    const issuer = new URL(getSupabaseConfig()!.url);
    if (
      destination.username ||
      destination.password ||
      destination.origin !== issuer.origin ||
      destination.pathname !== "/auth/v1/authorize" ||
      destination.searchParams.get("provider") !== "google"
    )
      return failure();
    return finish(NextResponse.redirect(destination));
  } catch {
    return failure();
  }
}
