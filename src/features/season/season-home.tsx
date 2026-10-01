import { CalendarDays, ChartNoAxesCombined, Dices, Shapes } from "lucide-react";

import { season, seasonDays } from "./model";
import { SeasonStatus } from "./season-status";

const teasers = [
  {
    title: "EL AFILADERO",
    copy: "Ideas, votos y planes que quizá sobrevivan al grupo.",
    icon: Shapes,
  },
  {
    title: "CALENDARIO",
    copy: "El plan oficial de ataque.",
    icon: CalendarDays,
  },
  {
    title: "JUEGOS",
    copy: "Trivia, bingo, predicciones y consecuencias.",
    icon: Dices,
  },
  {
    title: "SEASON RECAP",
    copy: "Las estadísticas que nadie pidió y todos van a discutir.",
    icon: ChartNoAxesCombined,
  },
];

export function SeasonHome({
  initialNow,
  member,
}: {
  initialNow: number;
  member?: { display_name: string };
}) {
  return (
    <div className="season-home">
      <header className="club-header page-width">
        <p className="club-wordmark">
          AFILADOS <span>CLUB</span>
        </p>
        <p className="technical">{season.name.toUpperCase()}</p>
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

      <main className="page-width">
        <SeasonStatus initialNow={initialNow}>
          <div className="hero-composition">
            <div className="hero-title">
              <p className="technical location">
                COCHABAMBA · {season.name.toUpperCase()}
              </p>
              <h1>
                <span>AFILADOS</span> <span>CLUB</span>
              </h1>
            </div>
            <p className="hero-caption">
              {seasonDays} días para hacer todo lo que el resto del año nunca
              coordinamos.
            </p>
            <div className="season-seal" aria-hidden="true">
              <span className="seal-number">{seasonDays}</span>
              <span className="technical">
                DÍAS.
                <br />
                CERO EXCUSAS.
              </span>
            </div>
          </div>
        </SeasonStatus>

        <section className="next-section" aria-labelledby="next-heading">
          <div className="section-heading">
            <h2 id="next-heading">LO QUE SE VIENE.</h2>
            <p className="technical">EL PROGRAMA ESTÁ EN PREPARACIÓN.</p>
          </div>
          <div className="teaser-grid">
            {teasers.map(({ title, copy, icon: Icon }, index) => (
              <article className="teaser" key={title}>
                <div className="teaser-topline technical">
                  <span className="teaser-index">
                    0{index + 1} /{" "}
                    <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  </span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="club-footer page-width">
        <p>
          NO ES UN CALENDARIO.
          <br />
          <span>ES UNA TEMPORADA.</span>
        </p>
        <p className="technical">AFILADOS CLUB · EST. {season.year}</p>
      </footer>
    </div>
  );
}
