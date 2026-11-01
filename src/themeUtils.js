/**
 * Derives a full color palette from the two base brand colors.
 * primary   = main brand color (header, footer, banner)
 * secondary = complementary color (section headers, bold rows)
 */
export function buildTheme({ primary, secondary, accent }) {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const W = [255, 255, 255];
  const toHex = ([r, g, b]) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
  const toRgba = ([r, g, b], a) =>
    `rgba(${Math.max(0,Math.min(255,r))},${Math.max(0,Math.min(255,g))},${Math.max(0,Math.min(255,b))},${a})`;

  return {
    // --- PDF (jsPDF RGB arrays) ---
    primary,
    primaryDark:    mix(primary, [0, 0, 0], 0.28),
    primaryAccent:  accent ?? mix(primary, W, 0.72), // light text on primary bg (custom or derived)
    primaryLight:   mix(primary, W, 0.87),        // subtle tinted bg
    primaryBorder:  mix(primary, [150, 150, 150], 0.5),
    secondary,
    secondaryVariants: [
      secondary,
      mix(secondary, W, 0.08),
      mix(secondary, W, 0.14),
      mix(secondary, W, 0.10),
      secondary,
    ],
    rowBoldBg:       mix(secondary, W, 0.90),
    rowBoldText:     secondary,
    onlineBox:       mix(secondary, W, 0.93),
    onlineBorder:    mix(secondary, W, 0.55),
    onlineTotal:     mix(secondary, W, 0.87),
    onlineTotalBorder: mix(secondary, W, 0.48),

    // --- CSS (hex / rgba strings) ---
    css: {
      primary:     toHex(primary),
      primaryDark: toHex(mix(primary, [0, 0, 0], 0.18)),
      primaryGlow: toRgba(primary, 0.12),
      secondary:   toHex(secondary),
    },
  };
}

/** Injects CSS custom properties onto :root so every stylesheet picks them up. */
export function applyThemeToDom(theme) {
  const { css } = buildTheme(theme);
  const root = document.documentElement;
  root.style.setProperty('--brand', css.primary);
  root.style.setProperty('--brand-dark', css.primaryDark);
  root.style.setProperty('--brand-glow', css.primaryGlow);
}
