import { useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

/**
 * Signs the user out after `timeoutMs` of no activity. Switching to another
 * browser tab (or minimizing, or just walking away) counts toward this,
 * since no activity events fire while the tab isn't focused/interacted with.
 */
export default function useIdleLogout(timeoutMs = 5 * 60 * 1000) {
  const timerRef = useRef(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        signOut(auth).catch((err) => console.error("Auto-logout failed:", err));
      }, timeoutMs);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [timeoutMs]);
}