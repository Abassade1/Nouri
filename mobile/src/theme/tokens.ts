/**
 * Design tokens. Deep forest green with a fresh leaf-green highlight on cool,
 * soft neutrals; large radii and soft shadows instead of hard borders.
 * Everything visual in the app reads from here; screens never hard-code values.
 */
export const colors = {
  paper: '#F4F5F2', // app background
  surface: '#FFFFFF', // cards, inputs
  sunken: '#ECEEEA', // subtle fills
  line: '#E4E7E2', // hairlines & borders
  lineStrong: '#CDD3CC',
  ink: '#141C18', // primary text
  inkMuted: '#5E6963', // secondary text
  inkFaint: '#9AA39E', // placeholders, disabled
  accent: '#0D3D2E', // deep forest: primary actions, hero panels
  accentPressed: '#082C21',
  accentSoft: '#E2ECE5',
  onAccent: '#FFFFFF',
  /** Leaf green: small moments of energy (active states, badges, highlights). */
  highlight: '#268702',
  highlightSoft: '#E5F2DC',
  /** Text and hairlines on the deep-forest hero. */
  onAccentMuted: 'rgba(255,255,255,0.72)',
  accentLine: 'rgba(255,255,255,0.14)',
  accentFill: 'rgba(255,255,255,0.10)',
  /** Leaf green lifted for legibility on the deep-forest hero. */
  highlightOnAccent: '#7BD453',
  danger: '#A63A2C',
  dangerSoft: '#F7E5E1',
  overlay: 'rgba(13,30,24,0.45)',
  /** Deep-forest wash over hero photos so white text stays readable. */
  heroScrim: 'rgba(9,46,34,0.68)',
} as const;

/** 4pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

/** Soft, diffuse elevation. Spread into a style; Android uses `elevation`. */
export const shadow = {
  card: {
    shadowColor: '#0D3D2E',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0D3D2E',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
} as const;

export const layout = {
  /** Screen side gutter. */
  gutter: 24,
  /** Max readable content width on tablets / web. */
  maxWidth: 560,
  /** Minimum tap target. */
  minTouch: 48,
} as const;

/**
 * Type scale. Sizes are tuned for Poppins; Arabic gets a little more
 * line-height automatically (see Text component) because Arabic glyphs are taller.
 */
export const typeScale = {
  display: { size: 32, line: 40, weight: '600', tracking: -0.6 },
  title: { size: 24, line: 32, weight: '600', tracking: -0.3 },
  heading: { size: 18, line: 26, weight: '600', tracking: -0.1 },
  body: { size: 15, line: 23, weight: '400', tracking: 0 },
  bodyStrong: { size: 15, line: 23, weight: '500', tracking: 0 },
  caption: { size: 13, line: 19, weight: '400', tracking: 0 },
  /** Small uppercase label. Never uppercased in Arabic. */
  overline: { size: 11, line: 16, weight: '600', tracking: 1.6 },
} as const;

export type TypeVariant = keyof typeof typeScale;
export type ColorToken = keyof typeof colors;

export const motion = {
  fast: 160,
  base: 280,
  slow: 420,
} as const;
