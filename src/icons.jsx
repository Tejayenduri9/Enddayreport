// Line icons for the sign-in / connect screens (inherit the text colour).
const svg = (path) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export const Icons = {
  devices: svg(<><rect x="2.5" y="4" width="14" height="10" rx="1.8" /><path d="M6.5 18h6M9.5 14v4" /><rect x="15.5" y="9" width="6" height="11" rx="1.5" /><path d="M18 17.5h1" /></>),
  lock: svg(<><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3 2" /></>),
  unplug: svg(<><path d="M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0V7Z" /><path d="M12 16v5" /><path d="M3 3l18 18" /></>),
  wifiOff: svg(<><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5-2.7M14.5 10.4A10 10 0 0 1 19 13M2 9.5a15 15 0 0 1 4.5-2.8M10.7 5.1A15 15 0 0 1 22 9.5" /><circle cx="12" cy="20" r="0.6" fill="currentColor" /></>),
  mail: svg(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>),
  check: svg(<path d="m5 12.5 4.5 4.5L19 7.5" />),
};
