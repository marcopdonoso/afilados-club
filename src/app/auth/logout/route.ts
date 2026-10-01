import { NextResponse, type NextRequest } from "next/server";

import { getTrustedOrigin } from "@/lib/auth/origin";
import { createRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const origin = getTrustedOrigin(request.url);
  if (!origin || request.headers.get("origin") !== origin) {
    return new NextResponse("Solicitud no válida.", { status: 403 });
  }
  const { client, finish } = createRouteClient(request);
  const redirect = (path: string) =>
    finish(NextResponse.redirect(new URL(path, origin), 303));
  if (!client) return redirect("/entrar?error=logout");
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    return redirect(error ? "/entrar?error=logout" : "/entrar");
  } catch {
    return redirect("/entrar?error=logout");
  }
}
