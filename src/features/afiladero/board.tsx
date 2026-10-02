import Link from "next/link";
import { ArrowUpRight, Shapes } from "lucide-react";

import { ClubHeader } from "@/components/club-header";
import { formatSeasonDate, season } from "@/features/season/model";

import {
  categories,
  sortIdeas,
  type BoardActions,
  type BoardIdea,
  type IdeaOrder,
  type RosterMember,
} from "./model";
import { IdeaFormDialog } from "./idea-form";
import { DeleteControl } from "./delete-control";
import { VoteControls } from "./vote-controls";

export function AfiladeroBoard({
  ideas,
  member,
  isAdmin,
  memberCount,
  order,
  actions,
}: {
  ideas: BoardIdea[];
  member: RosterMember;
  isAdmin: boolean;
  memberCount: number;
  order: IdeaOrder;
  actions: BoardActions;
}) {
  const totalVotes = ideas.reduce(
    (total, { counts }) => total + counts.in + counts.maybe + counts.pass,
    0,
  );
  return (
    <div className="season-home afiladero-page">
      <ClubHeader member={member} returnHome />
      <main className="page-width afiladero-main">
        <section className="afiladero-hero" aria-labelledby="afiladero-title">
          <p className="technical afiladero-kicker">
            TEMPORADA {season.year} · MESA DE OPERACIONES
          </p>
          <div className="afiladero-hero-line">
            <h1 id="afiladero-title">EL AFILADERO</h1>
            <ArrowUpRight
              className="afiladero-hero-arrow"
              aria-hidden="true"
              strokeWidth={1}
            />
          </div>
          <div className="afiladero-intro">
            <p>
              Aquí nacen los planes. Después veremos cuáles sobreviven al grupo.
            </p>
            <IdeaFormDialog actions={actions} />
          </div>
        </section>
        <dl className="afiladero-stats" aria-label="Datos del Afiladero">
          {[
            ["IDEAS", ideas.length],
            ["VOTOS", totalVotes],
            ["MIEMBROS", memberCount],
          ].map(([label, count]) => (
            <div key={label}>
              <dt className="technical">{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <section className="afiladero-feed" aria-labelledby="ideas-heading">
          <div className="afiladero-feed-heading">
            <h2 id="ideas-heading" className="technical">
              PLANES SOBRE LA MESA
            </h2>
            <nav
              aria-label="Orden de las ideas"
              className="idea-order technical"
            >
              <Link
                href="/afiladero"
                aria-current={order === "most" ? "page" : undefined}
              >
                MÁS AFILADAS
              </Link>
              <Link
                href="/afiladero?order=newest"
                aria-current={order === "newest" ? "page" : undefined}
              >
                NUEVAS
              </Link>
            </nav>
          </div>
          {ideas.length === 0 ? (
            <div className="afiladero-empty">
              <Shapes size={56} strokeWidth={1} aria-hidden="true" />
              <p className="technical">EXPEDIENTE 000 / SIN PROPUESTAS</p>
              <h3>TODAVÍA NO HAY NADA QUE DISCUTIR.</h3>
              <p>Eso debería preocuparnos.</p>
              <IdeaFormDialog
                actions={actions}
                label="PROPONER LA PRIMERA IDEA"
              />
            </div>
          ) : (
            <div className="idea-grid">
              {sortIdeas(ideas, order).map((idea, index) => {
                const category = categories[idea.category];
                const Icon = category.icon;
                const own = idea.proposed_by === member.id;
                return (
                  <article
                    className="idea-card"
                    key={idea.id}
                    aria-labelledby={`idea-${idea.id}`}
                  >
                    <div className="idea-topline technical">
                      <span>
                        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                        {category.label}
                      </span>
                      <span className="idea-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 id={`idea-${idea.id}`}>{idea.title}</h3>
                    {idea.description && (
                      <p className="idea-description">{idea.description}</p>
                    )}
                    <p className="idea-attribution technical">
                      <span>POR {idea.author}</span>
                      <time dateTime={idea.created_at}>
                        {formatSeasonDate(Date.parse(idea.created_at))}
                      </time>
                    </p>
                    <VoteControls idea={idea} actions={actions} />
                    {(own || isAdmin) && (
                      <div className="idea-management">
                        {own && (
                          <IdeaFormDialog idea={idea} actions={actions} />
                        )}
                        <DeleteControl
                          ideaId={idea.id}
                          action={actions.delete}
                        />
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
      <footer className="page-width afiladero-footer technical">
        <span>NINGÚN PLAN SOBREVIVE INTACTO AL GRUPO.</span>
        <span>AFILADOS CLUB · {season.year}</span>
      </footer>
    </div>
  );
}
