import {
  Beef,
  Beer,
  Clapperboard,
  Dices,
  Map as MapIcon,
  Music,
  Route,
  Tent,
  TriangleAlert,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";

export const categories = {
  parrillada: { label: "PARRILLADA", icon: Beef },
  bar: { label: "BAR", icon: Beer },
  concierto: { label: "CONCIERTO", icon: Music },
  camping: { label: "CAMPING", icon: Tent },
  juegos: { label: "JUEGOS", icon: Dices },
  excursion: { label: "EXCURSIÓN", icon: MapIcon },
  restaurante: { label: "RESTAURANTE", icon: Utensils },
  road_trip: { label: "ROAD TRIP", icon: Route },
  cine: { label: "CINE", icon: Clapperboard },
  cuestionable: { label: "IDEA CUESTIONABLE", icon: TriangleAlert },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;

export type Category = keyof typeof categories;
export const categoryKeys = Object.keys(categories) as Category[];
export const voteLabels = {
  in: "ME AFILO",
  maybe: "PUEDE SER",
  pass: "PASO",
} as const;
export type Vote = keyof typeof voteLabels;
export type IdeaOrder = "most" | "newest";
export const characterCount = (value: string) => Array.from(value).length;

const titleSchema = z
  .string()
  .trim()
  .refine(
    (value) => characterCount(value) >= 3 && characterCount(value) <= 80,
    "El título debe tener entre 3 y 80 caracteres.",
  );
const descriptionSchema = z
  .string()
  .trim()
  .refine(
    (value) => characterCount(value) <= 400,
    "La descripción admite hasta 400 caracteres.",
  )
  .nullable()
  .optional()
  .transform((value) => value || null);
export const ideaInputSchema = z
  .object({
    category: z.enum(categoryKeys, { error: "Elige una categoría." }),
    title: titleSchema,
    description: descriptionSchema,
  })
  .strict();
export const idSchema = z.uuid();
export const editInputSchema = ideaInputSchema.extend({ id: idSchema });
export const voteInputSchema = z
  .object({ ideaId: idSchema, vote: z.enum(["in", "maybe", "pass"]) })
  .strict();

export type IdeaInput = z.infer<typeof ideaInputSchema>;
export type FieldErrors = Partial<Record<keyof IdeaInput, string[]>>;
export type ActionResult =
  { ok: true } | { ok: false; error: string; fields?: FieldErrors };
export type BoardActions = {
  create: (input: IdeaInput) => Promise<ActionResult>;
  edit: (input: IdeaInput & { id: string }) => Promise<ActionResult>;
  delete: (id: string) => Promise<ActionResult>;
  vote: (input: { ideaId: string; vote: Vote }) => Promise<ActionResult>;
  removeVote: (id: string) => Promise<ActionResult>;
};
export type IdeaRow = {
  id: string;
  season_year: number;
  proposed_by: string;
  category: Category;
  title: string;
  description: string | null;
  created_at: string;
};
export type VoteRow = { idea_id: string; member_id: string; vote: Vote };
export type RosterMember = { id: string; display_name: string };
export type BoardIdea = IdeaRow & {
  author: string;
  counts: Record<Vote, number>;
  currentVote: Vote | null;
};

export function composeIdeas(
  ideas: IdeaRow[],
  votes: VoteRow[],
  roster: RosterMember[],
  memberId: string,
): BoardIdea[] {
  const names = new Map(
    roster.map(({ id, display_name }) => [id, display_name]),
  );
  return ideas.map((idea) => {
    const ownVotes = votes.filter(({ idea_id }) => idea_id === idea.id);
    return {
      ...idea,
      author: names.get(idea.proposed_by) ?? "Miembro de otra expedición",
      counts: {
        in: ownVotes.filter(({ vote }) => vote === "in").length,
        maybe: ownVotes.filter(({ vote }) => vote === "maybe").length,
        pass: ownVotes.filter(({ vote }) => vote === "pass").length,
      },
      currentVote:
        ownVotes.find(({ member_id }) => member_id === memberId)?.vote ?? null,
    };
  });
}

export function sortIdeas(ideas: BoardIdea[], order: IdeaOrder): BoardIdea[] {
  return [...ideas].sort(
    (a, b) =>
      (order === "most"
        ? b.counts.in - a.counts.in || b.counts.maybe - a.counts.maybe
        : 0) || Date.parse(b.created_at) - Date.parse(a.created_at),
  );
}
