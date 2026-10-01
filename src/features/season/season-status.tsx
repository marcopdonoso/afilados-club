"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

import { useSeasonClock } from "./clock";
import {
  getCountdown,
  getPhase,
  getSeasonDay,
  getWarmupProgress,
  phaseLabels,
  season,
  seasonDates,
  seasonDays,
} from "./model";

const units = [
  ["days", "DÍAS"],
  ["hours", "HORAS"],
  ["minutes", "MINUTOS"],
  ["seconds", "SEGUNDOS"],
] as const;

export function SeasonStatus({
  initialNow,
  children,
}: {
  initialNow: number;
  children: ReactNode;
}) {
  const now = useSeasonClock(initialNow);
  const phase = getPhase(now);
  const countdown = getCountdown(now, season.startsAt);
  const progress = getWarmupProgress(now);
  const reduceMotion = useReducedMotion();

  return (
    <section className="season-stage" aria-label={season.name}>
      <div className="season-poster">
        <div className="poster-topline technical">
          <p
            className="phase-label"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="phase-marker" aria-hidden="true" />
            {phaseLabels[phase]}
          </p>
          <p>
            {seasonDates.opening} — {seasonDates.closing}
          </p>
        </div>

        {children}

        <AnimatePresence initial={false}>
          <motion.div
            className="season-readout"
            key={phase}
            initial={reduceMotion ? false : { opacity: 0.85, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            {phase === "preseason" ? (
              <>
                <p className="technical readout-label">
                  LA APERTURA TIENE FECHA. FALTA:
                </p>
                <dl
                  className="countdown"
                  aria-label="Cuenta regresiva para la apertura"
                >
                  {units.map(([unit, label]) => (
                    <div key={unit}>
                      <dt className="technical">{label}</dt>
                      <dd>
                        <AnimatePresence initial={false}>
                          <motion.span
                            key={countdown[unit]}
                            initial={reduceMotion ? false : { opacity: 0.85 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: reduceMotion ? 0 : 0.18 }}
                          >
                            {String(countdown[unit]).padStart(2, "0")}
                          </motion.span>
                        </AnimatePresence>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : phase === "live" ? (
              <>
                <p className="technical readout-label">
                  SE DECLARA OFICIALMENTE INAUGURADA.
                </p>
                <p className="phase-headline">
                  DÍA <span>{getSeasonDay(now)}</span> DE {seasonDays}
                </p>
                <p className="readout-note">
                  El tiempo es limitado. Las excusas también.
                </p>
              </>
            ) : (
              <>
                <p className="technical readout-label">SE LEVANTA LA SESIÓN.</p>
                <p className="phase-headline">
                  NOS VEMOS EN <span>{seasonDates.nextYear}</span>
                </p>
                <p className="readout-note">
                  La temporada termina. El grupo no.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <dl className="status-board" aria-label="Datos de la temporada">
        <div>
          <dt className="technical">ESTADO</dt>
          <dd className="board-state">{phaseLabels[phase]}</dd>
        </div>
        <div>
          <dt className="technical">APERTURA</dt>
          <dd>
            {seasonDates.opening}
            <small>00:00 · hora de Bolivia</small>
          </dd>
        </div>
        <div>
          <dt className="technical">CIERRE</dt>
          <dd>
            {seasonDates.closing}
            <small>00:00 · último día: {seasonDates.lastDay}</small>
          </dd>
        </div>
        <div>
          <dt className="technical">VENTANA</dt>
          <dd>
            {seasonDays} DÍAS<small>Ni uno más. Ni uno menos.</small>
          </dd>
        </div>
      </dl>

      {phase === "preseason" && (
        <div className="warmup">
          <div className="warmup-heading technical">
            <h2 id="warmup-label">NIVEL DE AFILADO</h2>
            <span>{progress}%</span>
          </div>
          <div
            className="warmup-track"
            role="progressbar"
            aria-labelledby="warmup-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div style={{ width: `${progress}%` }} />
          </div>
          <p>
            Tiempo de preparación transcurrido. No mide actividad del grupo.
          </p>
        </div>
      )}
    </section>
  );
}
