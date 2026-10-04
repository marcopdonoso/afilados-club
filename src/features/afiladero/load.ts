import { createClient } from "@/lib/supabase/server";
import { requireClubMember } from "@/lib/auth/member";
import { season } from "@/features/season/model";
import {
  composeIdeas,
  type IdeaRow,
  type RosterMember,
  type VoteRow,
} from "./model";

export async function loadAfiladero() {
  const { id: memberId } = await requireClubMember();
  const client = await createClient();
  if (!client) throw new Error("Board unavailable");
  const [ideas, roster, own] = await Promise.all([
    client
      .from("activity_ideas")
      .select(
        "id,season_year,proposed_by,category,title,description,created_at",
      )
      .eq("season_year", season.year),
    client.from("club_members").select("id,display_name").eq("is_active", true),
    client
      .from("club_members")
      .select("role")
      .eq("id", memberId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  if (
    ideas.error ||
    roster.error ||
    own.error ||
    !ideas.data ||
    !roster.data ||
    !own.data
  )
    throw new Error("Board unavailable");
  const rows = ideas.data as IdeaRow[];
  const votes = rows.length
    ? await client
        .from("activity_idea_votes")
        .select("idea_id,member_id,vote")
        .in(
          "idea_id",
          rows.map(({ id }) => id),
        )
    : { data: [], error: null };
  if (votes.error || !votes.data) throw new Error("Board unavailable");
  const scheduled = rows.length
    ? await client
        .from("season_activities")
        .select("id,source_idea_id,start_date,status")
        .eq("season_year", season.year)
        .in(
          "source_idea_id",
          rows.map(({ id }) => id),
        )
    : { data: [], error: null };
  if (scheduled.error || !scheduled.data) throw new Error("Board unavailable");
  const schedules = new Map(
    scheduled.data.map((activity) => [activity.source_idea_id, activity]),
  );
  return {
    ideas: composeIdeas(
      rows,
      votes.data as VoteRow[],
      roster.data as RosterMember[],
      memberId,
    ).map((idea) => ({ ...idea, scheduled: schedules.get(idea.id) ?? null })),
    memberCount: roster.data.length,
    isAdmin: own.data.role === "admin",
  };
}
