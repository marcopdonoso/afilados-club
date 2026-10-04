import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { season } from "@/features/season/model";
import { activityColumns, sortActivities, type ActivityRow } from "./model";
import type { RosterMember } from "@/features/afiladero/model";

export async function loadCalendar() {
  const member = await requireClubMember();
  const client = await createClient();
  if (!client) throw new Error("Calendar unavailable");
  const [activities, roster, own] = await Promise.all([
    client
      .from("season_activities")
      .select(activityColumns)
      .eq("season_year", season.year),
    client.from("club_members").select("id,display_name").eq("is_active", true),
    client
      .from("club_members")
      .select("role")
      .eq("id", member.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (
    activities.error ||
    roster.error ||
    own.error ||
    !activities.data ||
    !roster.data ||
    !own.data
  )
    throw new Error("Calendar unavailable");
  const names = new Map(
    (roster.data as RosterMember[]).map(({ id, display_name }) => [
      id,
      display_name,
    ]),
  );
  return {
    activities: sortActivities(
      (activities.data as ActivityRow[]).map((activity) => ({
        ...activity,
        creator: names.get(activity.created_by) ?? "Miembro de otra expedición",
      })),
    ),
    isAdmin: own.data.role === "admin",
  };
}
