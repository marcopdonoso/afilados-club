"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  editInputSchema,
  idSchema,
  ideaInputSchema,
  voteInputSchema,
  type ActionResult,
} from "@/features/afiladero/model";
import { season } from "@/features/season/model";
import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";

const errors = {
  create: "NO SE PUDO LANZAR LA IDEA. Inténtalo otra vez.",
  edit: "NO SE PUDO MODIFICAR LA IDEA. Inténtalo otra vez.",
  delete: "NO SE PUDO ELIMINAR.",
  vote: "ESE VOTO NO ENTRÓ. Inténtalo nuevamente.",
};
const failure = (error: string): ActionResult => ({ ok: false, error });
const success = (): ActionResult => {
  revalidatePath("/afiladero");
  return { ok: true };
};

export async function createIdea(input: unknown): Promise<ActionResult> {
  await requireClubMember();
  const parsed = ideaInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "REVISA LA IDEA ANTES DE LANZARLA.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    const client = await createClient();
    if (!client) return failure(errors.create);
    const { data, error } = await client
      .from("activity_ideas")
      .insert({ ...parsed.data, season_year: season.year })
      .select("id");
    return error || data?.length !== 1 ? failure(errors.create) : success();
  } catch {
    return failure(errors.create);
  }
}

export async function editIdea(input: unknown): Promise<ActionResult> {
  const member = await requireClubMember();
  const parsed = editInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "REVISA LOS CAMBIOS.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    const client = await createClient();
    if (!client) return failure(errors.edit);
    const { id, ...content } = parsed.data;
    const { data, error } = await client
      .from("activity_ideas")
      .update(content)
      .eq("id", id)
      .eq("season_year", season.year)
      .eq("proposed_by", member.id)
      .select("id");
    return error || data?.length !== 1 ? failure(errors.edit) : success();
  } catch {
    return failure(errors.edit);
  }
}

export async function deleteIdea(input: unknown): Promise<ActionResult> {
  const member = await requireClubMember();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return failure(errors.delete);
  try {
    const client = await createClient();
    if (!client) return failure(errors.delete);
    const { data: idea, error: readError } = await client
      .from("activity_ideas")
      .select("id,proposed_by")
      .eq("id", parsed.data)
      .eq("season_year", season.year)
      .maybeSingle();
    if (readError || !idea) return failure(errors.delete);
    if (idea.proposed_by !== member.id) {
      const { data: own, error } = await client
        .from("club_members")
        .select("role")
        .eq("id", member.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error || own?.role !== "admin") return failure(errors.delete);
    }
    const { data, error } = await client
      .from("activity_ideas")
      .delete()
      .eq("id", parsed.data)
      .eq("season_year", season.year)
      .select("id");
    if (error || data?.length !== 1) return failure(errors.delete);
    revalidatePath("/calendario");
    revalidatePath("/");
    return success();
  } catch {
    return failure(errors.delete);
  }
}

type SessionClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
async function currentSeasonIdea(client: SessionClient, id: string) {
  const { data, error } = await client
    .from("activity_ideas")
    .select("id")
    .eq("id", id)
    .eq("season_year", season.year)
    .maybeSingle();
  return !error && !!data;
}

export async function voteIdea(input: unknown): Promise<ActionResult> {
  const member = await requireClubMember();
  const parsed = voteInputSchema.safeParse(input);
  if (!parsed.success) return failure(errors.vote);
  try {
    const client = await createClient();
    if (!client || !(await currentSeasonIdea(client, parsed.data.ideaId)))
      return failure(errors.vote);
    const { ideaId, vote } = parsed.data;
    const { data: existing, error: readError } = await client
      .from("activity_idea_votes")
      .select("vote")
      .eq("idea_id", ideaId)
      .eq("member_id", member.id)
      .maybeSingle();
    if (readError) return failure(errors.vote);
    const updateOwn = () =>
      client
        .from("activity_idea_votes")
        .update({ vote })
        .eq("idea_id", ideaId)
        .eq("member_id", member.id)
        .select("idea_id");
    // Upsert would require UPDATE on immutable identity columns. Keep grants narrow.
    let result = existing
      ? await updateOwn()
      : await client
          .from("activity_idea_votes")
          .insert({ idea_id: ideaId, vote })
          .select("idea_id");
    // Another tab may have inserted after our read; only update this caller's vote.
    if (!existing && result.error?.code === "23505") result = await updateOwn();
    return result.error || result.data?.length !== 1
      ? failure(errors.vote)
      : success();
  } catch {
    return failure(errors.vote);
  }
}

export async function removeVote(input: unknown): Promise<ActionResult> {
  const member = await requireClubMember();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return failure(errors.vote);
  try {
    const client = await createClient();
    if (!client || !(await currentSeasonIdea(client, parsed.data)))
      return failure(errors.vote);
    const { data, error } = await client
      .from("activity_idea_votes")
      .delete()
      .eq("idea_id", parsed.data)
      .eq("member_id", member.id)
      .select("idea_id");
    return error || data?.length !== 1 ? failure(errors.vote) : success();
  } catch {
    return failure(errors.vote);
  }
}
