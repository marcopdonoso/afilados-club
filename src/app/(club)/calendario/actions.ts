"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { idSchema } from "@/features/afiladero/model";
import {
  activityCreateSchema,
  activityEditSchema,
  type CalendarResult,
} from "@/features/calendario/model";
import { season } from "@/features/season/model";
import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";

const saveError = "NO SE PUDO GUARDAR LA ACTIVIDAD. Inténtalo otra vez.";
const deleteError = "NO SE PUDO ELIMINAR LA ACTIVIDAD. Inténtalo otra vez.";
const failure = (error: string): CalendarResult => ({ ok: false, error });
function success(): CalendarResult {
  for (const path of ["/calendario", "/afiladero", "/"]) revalidatePath(path);
  return { ok: true };
}
type SessionClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;
async function canManage(client: SessionClient, id: string, memberId: string) {
  const { data: activity, error } = await client
    .from("season_activities")
    .select("id,created_by")
    .eq("id", id)
    .eq("season_year", season.year)
    .maybeSingle();
  if (error || !activity) return false;
  if (activity.created_by === memberId) return true;
  const { data: own, error: roleError } = await client
    .from("club_members")
    .select("role")
    .eq("id", memberId)
    .eq("is_active", true)
    .maybeSingle();
  return !roleError && own?.role === "admin";
}

export async function createActivity(input: unknown): Promise<CalendarResult> {
  await requireClubMember();
  const parsed = activityCreateSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "REVISA LA ACTIVIDAD ANTES DE AGENDARLA.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    const client = await createClient();
    if (!client) return failure(saveError);
    if (parsed.data.source_idea_id) {
      const { data, error } = await client
        .from("activity_ideas")
        .select("id")
        .eq("id", parsed.data.source_idea_id)
        .eq("season_year", season.year)
        .maybeSingle();
      if (error || !data)
        return failure("ESA IDEA YA NO ESTÁ DISPONIBLE PARA ESTA TEMPORADA.");
    }
    const { data, error } = await client
      .from("season_activities")
      .insert(parsed.data)
      .select("id");
    if (parsed.data.source_idea_id && error?.code === "23505")
      return failure(
        "ESTA IDEA YA ESTÁ EN EL CALENDARIO. Actualiza la página para ver el plan.",
      );
    return error || data?.length !== 1 ? failure(saveError) : success();
  } catch {
    return failure(saveError);
  }
}
export async function editActivity(input: unknown): Promise<CalendarResult> {
  const member = await requireClubMember();
  const parsed = activityEditSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "REVISA LOS CAMBIOS DE LA ACTIVIDAD.",
      fields: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    const client = await createClient();
    const { id, ...content } = parsed.data;
    if (!client || !(await canManage(client, id, member.id)))
      return failure(saveError);
    const { data, error } = await client
      .from("season_activities")
      .update(content)
      .eq("id", id)
      .eq("season_year", season.year)
      .select("id");
    return error || data?.length !== 1 ? failure(saveError) : success();
  } catch {
    return failure(saveError);
  }
}
export async function deleteActivity(input: unknown): Promise<CalendarResult> {
  const member = await requireClubMember();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return failure(deleteError);
  try {
    const client = await createClient();
    if (!client || !(await canManage(client, parsed.data, member.id)))
      return failure(deleteError);
    const { data, error } = await client
      .from("season_activities")
      .delete()
      .eq("id", parsed.data)
      .eq("season_year", season.year)
      .select("id");
    return error || data?.length !== 1 ? failure(deleteError) : success();
  } catch {
    return failure(deleteError);
  }
}
