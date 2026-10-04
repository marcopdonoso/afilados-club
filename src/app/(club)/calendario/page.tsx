import Link from "next/link";
import { connection } from "next/server";
import { ClubHeader } from "@/components/club-header";
import { requireClubMember } from "@/lib/auth/member";
import { CalendarBoard } from "@/features/calendario/board";
import { loadCalendar } from "@/features/calendario/load";
import { createActivity, deleteActivity, editActivity } from "./actions";

async function getRequestTimestamp() {
  await connection();
  return Date.now();
}

export default async function CalendarPage() {
  const member = await requireClubMember();
  let board;
  try {
    board = await loadCalendar();
  } catch {
    return (
      <div className="season-home calendario-page">
        <ClubHeader member={member} returnHome />
        <main className="page-width afiladero-load-error">
          <div role="alert">
            <h1>NO SE PUDO ABRIR EL CALENDARIO.</h1>
            <p>Los planes no desaparecieron. Inténtalo otra vez.</p>
          </div>
          <Link href="/calendario" className="afiladero-primary technical">
            INTENTAR DE NUEVO
          </Link>
        </main>
      </div>
    );
  }
  const initialNow = await getRequestTimestamp();
  return (
    <CalendarBoard
      {...board}
      member={member}
      initialNow={initialNow}
      actions={{
        create: createActivity,
        edit: editActivity,
        delete: deleteActivity,
      }}
    />
  );
}
