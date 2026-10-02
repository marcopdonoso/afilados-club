import { NextResponse, type NextRequest } from "next/server";

import { readClubAccess } from "@/lib/auth/member";
import { getTrustedOrigin } from "@/lib/auth/origin";
import { createRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const origin = getTrustedOrigin(request.url);
  if (!origin) return new NextResponse("Solicitud no válida.", { status: 400 });
  const { client, finish } = createRouteClient(request);
  const redirect = (path: string) =>
    finish(NextResponse.redirect(new URL(path, origin)));
  const code = request.nextUrl.searchParams.get("code");
  if (!client || !code || request.nextUrl.searchParams.has("error")) {
    return redirect("/entrar?error=oauth");
  }

  try {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) return redirect("/entrar?error=oauth");
    const { member, hasIdentity } = await readClubAccess(client);
    if (member) return redirect("/"); // Deliberately ignore every untrusted next value.
    try {
      const { error: logoutError } = await client.auth.signOut({
        scope: "local",
      });
      if (logoutError) return redirect("/entrar?error=logout");
    } catch {
      return redirect("/entrar?error=logout");
    }
    return redirect(
      hasIdentity ? "/entrar?error=access" : "/entrar?error=oauth",
    );
  } catch {
    return redirect("/entrar?error=oauth");
  }
}
