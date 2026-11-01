/**
 * Derives a full color palette from the restaurant's theme config.
 * primary   = main brand color (header, footer, banner)
 * secondary = complementary color (section headers, bold rows)
 * accent    = optional light color for text on primary bg (defaults to derived)
 */
export function buildTheme({ primary, secondary, accent }) {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const W = [255, 255, 255];

  return {
    // --- PDF (jsPDF RGB arrays) ---
    primary,
    primaryDark:    mix(primary, [0, 0, 0], 0.28),
    primaryAccent:  accent ?? mix(primary, W, 0.72),
    primaryLight:   mix(primary, W, 0.87),
    primaryBorder:  mix(primary, [150, 150, 150], 0.5),
    secondary,
    secondaryVariants: [
      secondary,
      mix(secondary, W, 0.08),
      mix(secondary, W, 0.14),
      mix(secondary, W, 0.10),
      secondary,
    ],
    rowBoldBg:       accent ? mix(accent, W, 0.55) : mix(primary, W, 0.87),
    rowBoldText:     [30, 30, 30],            // black font on light bg
    onlineBox:       mix(secondary, W, 0.93),
    onlineBorder:    mix(secondary, W, 0.55),
    onlineTotal:     mix(secondary, W, 0.87),
    onlineTotalBorder: mix(secondary, W, 0.48),
  };
}

function toHex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function toRgba([r, g, b], a) {
  return `rgba(${[r,g,b].map(v=>Math.max(0,Math.min(255,v))).join(',')},${a})`;
}
function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

/** Injects all CSS custom properties onto :root so every stylesheet picks them up. */
export function applyThemeToDom({ primary, secondary, accent }) {
  const W = [255, 255, 255];
  const accentColor = accent ?? mix(primary, W, 0.72);

  const vars = {
    '--brand':          toHex(primary),
    '--brand-dark':     toHex(mix(primary, [0, 0, 0], 0.18)),
    '--brand-deep':     toHex(mix(primary, [0, 0, 0], 0.42)),     // dark text, labels
    '--brand-glow':     toRgba(primary, 0.12),
    '--brand-accent':   toHex(accentColor),                        // text on colored bg
    '--brand-border':   toHex(mix(primary, W, 0.47)),              // input borders
    '--brand-tint':     toHex(mix(primary, W, 0.93)),              // subtle hover/bg
    '--brand-tint2':    toHex(mix(primary, W, 0.97)),              // page/card bg
    '--brand-light':    toHex(mix(primary, W, 0.78)),              // calendar cells
    '--brand-divider':  toHex(mix(primary, W, 0.70)),              // dividers
    '--brand-bg':       toHex(mix(primary, W, 0.96)),              // page background
    '--brand-secondary':toHex(secondary),                          // audit header, etc.
  };

  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}
