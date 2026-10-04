import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarBoard } from "@/features/calendario/board";
import {
  type Activity,
  type CalendarActions,
  type CalendarResult,
} from "@/features/calendario/model";
import { AfiladeroBoard } from "@/features/afiladero/board";
import { composeIdeas } from "@/features/afiladero/model";

// Isolated synthetic component state: no Auth clients, DB, seeds or route bypass.
const member = {
  id: "00000000-0000-4000-8000-000000000011",
  display_name: "Integrante de prueba",
};
const ideaId = "00000000-0000-4000-8000-000000000021";
const source = {
  id: ideaId,
  season_year: 2026,
  proposed_by: "other",
  category: "camping" as const,
  title: "Camping en Toro Toro",
  description: "Una noche y cero señal.",
  created_at: "2026-10-01T12:00:00Z",
};
const base: Activity = {
  id: "00000000-0000-4000-8000-000000000001",
  season_year: 2026,
  created_by: member.id,
  creator: member.display_name,
  source_idea_id: ideaId,
  category: "camping",
  title: "Camping en Toro Toro",
  description: "Una noche. La organización sigue siendo una hipótesis.",
  status: "confirmed",
  start_date: "2026-12-05",
  end_date: "2026-12-06",
  start_time: "22:00",
  end_time: "02:00",
  created_at: "2026-10-02T12:00:00Z",
};
const initial: Activity[] = [
  base,
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000002",
    title: "Parrillada inaugural",
    category: "parrillada",
    status: "tentative",
    source_idea_id: null,
    start_date: "2026-11-28",
    end_date: "2026-11-28",
    start_time: null,
    end_time: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000003",
    title: "Reunión que no sobrevivió al grupo",
    category: "cuestionable",
    status: "cancelled",
    source_idea_id: null,
    start_date: "2026-12-07",
    end_date: "2026-12-07",
    start_time: "18:00",
    end_time: null,
  },
  {
    ...base,
    id: "00000000-0000-4000-8000-000000000004",
    title: "Última noche de la expedición",
    category: "bar",
    source_idea_id: null,
    start_date: "2026-12-20",
    end_date: "2026-12-21",
    start_time: "22:00",
    end_time: "07:25",
  },
];
function Fixture() {
  const params = new URLSearchParams(window.location.search);
  const [activities, setActivities] = useState(
    params.has("empty") || params.has("ideas") ? [] : initial,
  );
  async function settle(): Promise<CalendarResult> {
    await new Promise((resolve) =>
      setTimeout(resolve, params.has("pending") ? 800 : 30),
    );
    return params.has("error")
      ? {
          ok: false,
          error: "NO SE PUDO GUARDAR LA ACTIVIDAD. Inténtalo otra vez.",
        }
      : { ok: true };
  }
  const actions: CalendarActions = {
    create: async (input) => {
      const result = await settle();
      if (result.ok)
        setActivities((rows) => [
          ...rows,
          {
            ...input,
            id: crypto.randomUUID(),
            season_year: 2026,
            created_by: member.id,
            creator: member.display_name,
            created_at: "2026-10-03T12:00:00Z",
          },
        ]);
      return result;
    },
    edit: async ({ id, ...input }) => {
      const result = await settle();
      if (result.ok)
        setActivities((rows) =>
          rows.map((row) => (row.id === id ? { ...row, ...input } : row)),
        );
      return result;
    },
    delete: async (id) => {
      const result = await settle();
      if (result.ok)
        setActivities((rows) => rows.filter((row) => row.id !== id));
      return result;
    },
  };
  if (params.has("ideas")) {
    const ideas = composeIdeas([source], [], [member], member.id).map(
      (idea) => ({
        ...idea,
        scheduled:
          activities.find(({ source_idea_id }) => source_idea_id === idea.id) ??
          null,
      }),
    );
    const noMutation = async () => ({ ok: true as const });
    return (
      <AfiladeroBoard
        ideas={ideas}
        member={member}
        isAdmin={false}
        memberCount={1}
        order="most"
        calendarActions={actions}
        actions={{
          create: noMutation,
          edit: noMutation,
          delete: noMutation,
          vote: noMutation,
          removeVote: noMutation,
        }}
      />
    );
  }
  return (
    <CalendarBoard
      activities={activities}
      member={member}
      isAdmin={params.has("admin")}
      initialNow={Date.parse("2026-12-05T12:00:00-04:00")}
      actions={actions}
    />
  );
}
createRoot(document.getElementById("fixture")!).render(<Fixture />);
