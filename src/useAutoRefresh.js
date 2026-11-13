/* eslint-disable no-undef */
import { useEffect, useRef } from "react";

// Keeps an open tab from running stale code after a new deploy. It polls
// version.json (emitted with a fresh id on every build). When the live id no
// longer matches the one this tab started with, it waits until `isSafe()` says
// it's okay — never mid-data-entry — then reloads to pick up the new version.
//
// isSafe: () => boolean  — return false while there is unsaved input on screen.
export function useAutoRefresh(isSafe, pollMs = 180000) {
  const isSafeRef = useRef(isSafe);
  isSafeRef.current = isSafe;

  useEffect(() => {
    const current = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : null;
    if (!current) return; // dev mode or no build stamp — nothing to compare against

    let pending = false;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.buildId && String(data.buildId) !== String(current)) {
          pending = true;
        }
      } catch {
        // offline or blocked — just try again on the next tick
      }
    };

    const applyIfSafe = () => {
      if (pending && !stopped && isSafeRef.current()) {
        window.location.reload();
      }
    };

    check(); // check once on mount
    const pollTimer = setInterval(check, pollMs);
    const applyTimer = setInterval(applyIfSafe, 5000);

    return () => {
      stopped = true;
      clearInterval(pollTimer);
      clearInterval(applyTimer);
    };
  }, [pollMs]);
}
