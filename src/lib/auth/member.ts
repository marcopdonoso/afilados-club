import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type ClubMember = { id: string; display_name: string };
export type ClubAccess = { member: ClubMember | null; hasIdentity: boolean };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const anonymous: ClubAccess = { member: null, hasIdentity: false };

// Claims verify identity; the caller's RLS query independently authorizes membership.
export async function readClubAccess(
  client: SupabaseClient | null,
): Promise<ClubAccess> {
  if (!client) return anonymous;
  let hasIdentity = false;
  try {
    const { data: identity, error: claimsError } =
      await client.auth.getClaims();
    const subject = identity?.claims.sub;
    if (claimsError || typeof subject !== "string" || !uuid.test(subject)) {
      return anonymous;
    }
    hasIdentity = true;
    const { data, error } = await client
      .from("club_members")
      .select("id,display_name,auth_user_id,is_active")
      .eq("auth_user_id", subject)
      .eq("is_active", true)
      .maybeSingle();

    if (
      error ||
      !data ||
      data.auth_user_id !== subject ||
      data.is_active !== true ||
      typeof data.id !== "string" ||
      !uuid.test(data.id) ||
      typeof data.display_name !== "string" ||
      data.display_name !== data.display_name.trim() ||
      data.display_name.length < 1 ||
      data.display_name.length > 40
    ) {
      return { member: null, hasIdentity };
    }

    return {
      member: { id: data.id, display_name: data.display_name },
      hasIdentity,
    };
  } catch {
    return { member: null, hasIdentity };
  }
}

// React cache deduplicates only this render pass, never across requests/users.
export const getCurrentClubAccess = cache(async (): Promise<ClubAccess> => {
  try {
    return await readClubAccess(await createClient());
  } catch {
    return anonymous;
  }
});

export async function getCurrentClubMember() {
  return (await getCurrentClubAccess()).member;
}

export async function requireClubMember() {
  const { member, hasIdentity } = await getCurrentClubAccess();
  if (!member) redirect(hasIdentity ? "/entrar?error=access" : "/entrar");
  return member;
}
