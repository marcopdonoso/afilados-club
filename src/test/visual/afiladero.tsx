import { useState } from "react";
import { createRoot } from "react-dom/client";

import { AfiladeroBoard } from "@/features/afiladero/board";
import {
  composeIdeas,
  type ActionResult,
  type BoardActions,
  type IdeaRow,
  type VoteRow,
} from "@/features/afiladero/model";
import { season } from "@/features/season/model";

// Isolated component state only. No Auth clients, DB writes, or private-route bypass.
const member = {
  id: "00000000-0000-4000-8000-000000000011",
  display_name: "Integrante de prueba",
};
const other = {
  id: "00000000-0000-4000-8000-000000000012",
  display_name: "Otra integrante",
};
const initialIdeas: IdeaRow[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    season_year: season.year,
    proposed_by: member.id,
    category: "camping",
    title: "Camping en Toro Toro",
    description: "Una noche, parrilla, cero señal y decisiones cuestionables.",
    created_at: "2026-10-02T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    season_year: season.year,
    proposed_by: other.id,
    category: "cuestionable",
    title: "Reunión extraordinaria para no decidir nada",
    description:
      "Llevar una propuesta. Aceptar que el grupo tenga otras catorce.",
    created_at: "2026-10-03T12:00:00Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    season_year: season.year,
    proposed_by: other.id,
    category: "restaurante",
    title: "Una mesa suficientemente larga para toda esta expedición",
    description: null,
    created_at: "2026-10-04T12:00:00Z",
  },
];
const initialVotes: VoteRow[] = [
  { idea_id: initialIdeas[0].id, member_id: member.id, vote: "in" },
  { idea_id: initialIdeas[0].id, member_id: other.id, vote: "maybe" },
];

function Fixture() {
  const params = new URLSearchParams(window.location.search);
  const [ideas, setIdeas] = useState(params.has("empty") ? [] : initialIdeas);
  const [votes, setVotes] = useState(params.has("empty") ? [] : initialVotes);
  async function settle(): Promise<ActionResult> {
    await new Promise((resolve) =>
      setTimeout(resolve, params.has("pending") ? 1500 : 80),
    );
    return params.has("error")
      ? { ok: false, error: "ESE VOTO NO ENTRÓ. Inténtalo nuevamente." }
      : { ok: true };
  }
  const actions: BoardActions = {
    create: async (input) => {
      const result = await settle();
      if (result.ok)
        setIdeas((rows) => [
          ...rows,
          {
            ...input,
            id: crypto.randomUUID(),
            proposed_by: member.id,
            season_year: season.year,
            created_at: new Date().toISOString(),
          },
        ]);
      return result;
    },
    edit: async ({ id, ...input }) => {
      const result = await settle();
      if (result.ok)
        setIdeas((rows) =>
          rows.map((row) => (row.id === id ? { ...row, ...input } : row)),
        );
      return result;
    },
    delete: async (id) => {
      const result = await settle();
      if (result.ok) {
        setIdeas((rows) => rows.filter((row) => row.id !== id));
        setVotes((rows) => rows.filter((row) => row.idea_id !== id));
      }
      return result;
    },
    vote: async ({ ideaId, vote }) => {
      const result = await settle();
      if (result.ok)
        setVotes((rows) => [
          ...rows.filter(
            (row) => row.idea_id !== ideaId || row.member_id !== member.id,
          ),
          { idea_id: ideaId, member_id: member.id, vote },
        ]);
      return result;
    },
    removeVote: async (id) => {
      const result = await settle();
      if (result.ok)
        setVotes((rows) =>
          rows.filter(
            (row) => row.idea_id !== id || row.member_id !== member.id,
          ),
        );
      return result;
    },
  };
  return (
    <AfiladeroBoard
      ideas={composeIdeas(ideas, votes, [member, other], member.id)}
      member={member}
      isAdmin={params.has("admin")}
      memberCount={2}
      order="most"
      actions={actions}
    />
  );
}

createRoot(document.getElementById("fixture")!).render(<Fixture />);
