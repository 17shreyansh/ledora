/**
 * Ledora design tokens. Every colour, size and timing used by the theme comes from here,
 * so the visual language can be tuned in one place.
 *
 * Brand colours are taken from the logo (`/ledora-logo.svg`).
 */

export const brand = {
  purple: '#7C3AED',
  deepPurple: '#5B2BE0',
  blue: '#2563EB',
  navy: '#071225',
  white: '#FFFFFF',
} as const;

/** Tints/shades of the brand purple used for hover, subtle backgrounds and focus. */
export const purple = {
  50: '#F5F2FE',
  100: '#ECE6FD',
  200: '#D9CCFB',
  300: '#BBA4F7',
  500: brand.purple,
  600: brand.deepPurple,
  700: '#4A20C2',
  800: '#3B1A9A',
} as const;

export const blue = {
  50: '#EFF5FF',
  100: '#DBE7FE',
  600: brand.blue,
  700: '#1D4FD8',
  800: '#1E40AF',
} as const;

/** Navy ramp for the sidebar and other dark surfaces. */
export const navy = {
  950: brand.navy,
  900: '#0C1A33',
  850: '#111F3B',
  800: '#172846',
  700: '#22355A',
  600: '#33496F',
} as const;

/** Cool slate neutrals for text, borders and surfaces. */
export const slate = {
  0: '#FFFFFF',
  25: '#FBFBFD',
  50: '#F6F7FB',
  100: '#EEF0F6',
  150: '#E5E7EF',
  200: '#D8DBE6',
  300: '#BCC1D1',
  400: '#9097AD',
  500: '#646B82',
  600: '#4B5168',
  700: '#363B50',
  800: '#22263A',
  900: '#121526',
} as const;

export const status = {
  success: { main: '#0E7A4F', bg: '#ECF8F2', border: '#BFE6D2' },
  warning: { main: '#9A5B00', bg: '#FFF7E8', border: '#F5D9A6' },
  error: { main: '#C4253B', bg: '#FDF0F2', border: '#F4C4CC' },
  info: { main: blue[700], bg: blue[50], border: '#C9DAFC' },
} as const;

export const colors = {
  background: slate[50],
  surface: slate[0],
  surfaceMuted: slate[25],
  border: slate[150],
  borderStrong: slate[200],
  textPrimary: slate[900],
  textSecondary: slate[500],
  textMuted: slate[400],
  heading: brand.navy,
  link: brand.blue,
  primary: brand.deepPurple,
  primaryHover: purple[700],
  accent: brand.purple,
} as const;

export const fontFamily =
  '"Inter Variable", Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const typography = {
  fontFamily,
  fontSize: 14,
  weights: { regular: 400, medium: 500, semibold: 600, bold: 650 },
  scale: {
    display: { size: 30, line: 36, tracking: '-0.025em', weight: 650 },
    h1: { size: 24, line: 32, tracking: '-0.022em', weight: 650 },
    h2: { size: 20, line: 28, tracking: '-0.018em', weight: 600 },
    h3: { size: 16, line: 24, tracking: '-0.012em', weight: 600 },
    h4: { size: 15, line: 22, tracking: '-0.008em', weight: 600 },
    body: { size: 14, line: 21 },
    bodySmall: { size: 13, line: 19 },
    caption: { size: 12, line: 16 },
    overline: { size: 11, line: 16, tracking: '0.06em' },
  },
} as const;

/** 4px base grid. MUI `theme.spacing(n)` = n * 4px. */
export const spacingUnit = 4;

export const radii = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  full: 999,
} as const;

export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(7, 18, 37, 0.05)',
  sm: '0 1px 3px rgba(7, 18, 37, 0.06), 0 1px 2px rgba(7, 18, 37, 0.04)',
  md: '0 6px 16px -4px rgba(7, 18, 37, 0.10), 0 2px 4px -2px rgba(7, 18, 37, 0.06)',
  lg: '0 18px 40px -12px rgba(7, 18, 37, 0.22), 0 4px 10px -4px rgba(7, 18, 37, 0.08)',
} as const;

export const zIndex = {
  appBar: 1100,
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
} as const;

export const transitions = {
  fast: 120,
  base: 180,
  slow: 260,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const focusRing = {
  color: brand.purple,
  outline: `2px solid ${brand.purple}`,
  offset: '2px',
  /** Used on inputs, where an outline would collide with the border. */
  shadow: '0 0 0 3px rgba(124, 58, 237, 0.22)',
} as const;

export const layout = {
  sidebarWidth: 248,
  contentMaxWidth: 1120,
  appBarHeight: 56,
} as const;

/**
 * Chart chrome and marks. Charts use the "emphasis" form: the current period in the brand's deep
 * purple, the comparison in a recessive slate (always dashed and legend-labelled, and every value is
 * also in the chart's data table, since slate 400 sits just under 3:1 on white).
 */
export const chart = {
  series: brand.deepPurple,
  seriesFillOpacity: 0.1,
  comparison: slate[400],
  grid: slate[150],
  axis: slate[200],
  tick: slate[500],
  /** Track behind share bars and meters: the lightest step of the series ramp. */
  track: purple[50],
  good: status.success.main,
  bad: status.error.main,
} as const;
