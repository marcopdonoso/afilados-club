"use client";

import { useState, useSyncExternalStore } from "react";

function createClock(initialNow: number) {
  let snapshot = initialNow;
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  function tick() {
    // Read absolute time on every tick so suspended tabs do not accumulate drift.
    snapshot = Date.now();
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    // The serialized primitive remains identical during SSR and hydration.
    getServerSnapshot: () => initialNow,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        tick();
        timer = setInterval(tick, 1_000);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}

export function useSeasonClock(initialNow: number): number {
  const [clock] = useState(() => createClock(initialNow));
  return useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );
}
