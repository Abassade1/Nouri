/**
 * Design tokens. One accent colour (forest green) on warm neutrals.
 * Everything visual in the app reads from here; screens never hard-code values.
 */
export const colors = {
  paper: '#F7F4EE', // app background
  surface: '#FFFFFF', // cards, inputs
  sunken: '#EFEBE3', // subtle fills
  line: '#E2DDD2', // hairlines & borders
  lineStrong: '#CFC8B9',
  ink: '#1D1C19', // primary text
  inkMuted: '#6B665B', // secondary text
  inkFaint: '#9A9486', // placeholders, disabled
  accent: '#2D4A3E', // the one accent: forest
  accentPressed: '#223a30',
  accentSoft: '#E4EBE6',
  onAccent: '#F7F4EE',
  danger: '#9B3A2E',
  dangerSoft: '#F4E4E0',
  overlay: 'rgba(29,28,25,0.4)',
} as const;

/** 4pt grid. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const layout = {
  /** Screen side gutter. */
  gutter: 24,
  /** Max readable content width on tablets / web. */
  maxWidth: 560,
  /** Minimum tap target. */
  minTouch: 48,
} as const;

/**
 * Type scale. Sizes are tuned for IBM Plex Sans; Arabic gets a little more
 * line-height automatically (see Text component) because Arabic glyphs are taller.
 */
export const typeScale = {
  display: { size: 34, line: 40, weight: '500', tracking: -0.4 },
  title: { size: 24, line: 30, weight: '500', tracking: -0.2 },
  heading: { size: 18, line: 24, weight: '500', tracking: 0 },
  body: { size: 16, line: 24, weight: '400', tracking: 0 },
  bodyStrong: { size: 16, line: 24, weight: '500', tracking: 0 },
  caption: { size: 13, line: 18, weight: '400', tracking: 0.1 },
  /** Small uppercase label - the "fine watch" detail. Never uppercased in Arabic. */
  overline: { size: 11, line: 16, weight: '500', tracking: 1.4 },
} as const;

export type TypeVariant = keyof typeof typeScale;
export type ColorToken = keyof typeof colors;

export const motion = {
  fast: 160,
  base: 280,
  slow: 420,
} as const;
