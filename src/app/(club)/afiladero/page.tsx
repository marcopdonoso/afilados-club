import Link from "next/link";

import { ClubHeader } from "@/components/club-header";
import { AfiladeroBoard } from "@/features/afiladero/board";
import { loadAfiladero } from "@/features/afiladero/load";
import { requireClubMember } from "@/lib/auth/member";
import {
  createActivity,
  editActivity,
  deleteActivity,
} from "../calendario/actions";

import {
  createIdea,
  deleteIdea,
  editIdea,
  removeVote,
  voteIdea,
} from "./actions";

export default async function AfiladeroPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const member = await requireClubMember();
  const order = (await searchParams).order === "newest" ? "newest" : "most";
  let board;
  try {
    board = await loadAfiladero();
  } catch {
    return (
      <div className="season-home afiladero-page">
        <ClubHeader member={member} returnHome />
        <main className="page-width afiladero-load-error">
          <div role="alert">
            <h1>NO SE PUDO ABRIR EL AFILADERO.</h1>
            <p>La mesa sigue aquí. Inténtalo otra vez.</p>
          </div>
          <Link className="afiladero-primary technical" href="/afiladero">
            INTENTAR DE NUEVO
          </Link>
        </main>
      </div>
    );
  }
  return (
    <AfiladeroBoard
      {...board}
      member={member}
      order={order}
      calendarActions={{
        create: createActivity,
        edit: editActivity,
        delete: deleteActivity,
      }}
      actions={{
        create: createIdea,
        edit: editIdea,
        delete: deleteIdea,
        vote: voteIdea,
        removeVote,
      }}
    />
  );
}
