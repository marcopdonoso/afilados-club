"use client";

import { Check } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import {
  voteLabels,
  type BoardActions,
  type BoardIdea,
  type Vote,
} from "./model";

export function VoteControls({
  idea,
  actions,
}: {
  idea: BoardIdea;
  actions: BoardActions;
}) {
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  function toggle(vote: Vote) {
    if (lock.current) return;
    lock.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result =
          idea.currentVote === vote
            ? await actions.removeVote(idea.id)
            : await actions.vote({ ideaId: idea.id, vote });
        if (!result.ok) setError(result.error);
      } catch {
        setError("ESE VOTO NO ENTRÓ. Inténtalo nuevamente.");
      } finally {
        lock.current = false;
      }
    });
  }
  return (
    <div className="idea-voting" aria-busy={pending}>
      <div
        className="vote-buttons"
        role="group"
        aria-label={`Votar: ${idea.title}`}
      >
        {(Object.keys(voteLabels) as Vote[]).map((vote) => (
          <button
            key={vote}
            type="button"
            className="vote-button technical"
            aria-pressed={idea.currentVote === vote}
            disabled={pending}
            onClick={() => toggle(vote)}
          >
            <span>
              {voteLabels[vote]} <strong>{idea.counts[vote]}</strong>
            </span>
            {idea.currentVote === vote && (
              <span className="vote-selected">
                <Check size={12} aria-hidden="true" /> TU VOTO
              </span>
            )}
          </button>
        ))}
      </div>
      <p role="status" className="action-status technical">
        {pending ? "REGISTRANDO VOTO…" : ""}
      </p>
      {error && (
        <p role="alert" className="action-error">
          {error}
        </p>
      )}
    </div>
  );
}
