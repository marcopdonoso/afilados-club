import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { season } from "@/features/season/model";

export function ClubHeader({
  member,
  returnHome = false,
}: {
  member?: { display_name: string };
  returnHome?: boolean;
}) {
  return (
    <header className="club-header page-width">
      <Link href="/" className="club-wordmark">
        AFILADOS <span>CLUB</span>
      </Link>
      {returnHome ? (
        <Link href="/" className="club-return technical">
          <ArrowLeft size={14} aria-hidden="true" /> VOLVER AL INICIO
        </Link>
      ) : (
        <p className="technical">{season.name.toUpperCase()}</p>
      )}
      {member && (
        <div className="club-identity technical">
          <span>{member.display_name}</span>
          <form action="/auth/logout" method="post">
            <button className="club-logout" type="submit">
              SALIR
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
