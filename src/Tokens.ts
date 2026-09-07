import * as Geist from './internal/Geist.js'

/** All 92 Geist color steps, with light and dark values. */
export const colors = Geist.colors
/** Geist heading, copy, label, and button metrics. */
export const typography = Geist.typography
/** Preset-specific strong and subtle descendant overrides from Geist. */
export const typographyStrong = Geist.strong
/** Tailwind v4 spacing unit in rem; numeric spacing values multiply this unit. */
export const spacing = 0.25
/** Tailwind v4 border-radius scale, plus zero and a pill radius. */
export const radius = {
  /** Square corners. */ none: '0',
  /** 2px at the default root size. */ xs: '0.125rem',
  /** 4px at the default root size. */ sm: '0.25rem',
  /** 6px at the default root size. */ md: '0.375rem',
  /** 8px at the default root size. */ lg: '0.5rem',
  /** 12px at the default root size. */ xl: '0.75rem',
  /** 16px at the default root size. */ '2xl': '1rem',
  /** 24px at the default root size. */ '3xl': '1.5rem',
  /** 32px at the default root size. */ '4xl': '2rem',
  /** Fully rounded. */ full: 'calc(infinity * 1px)',
} as const
/** Tailwind v4 mobile-first breakpoints in rem. */
export const breakpoints = {
  /** Small viewport. */ sm: '40rem',
  /** Medium viewport. */ md: '48rem',
  /** Large viewport. */ lg: '64rem',
  /** Extra-large viewport. */ xl: '80rem',
  /** Largest default viewport. */ '2xl': '96rem',
} as const
/** Tailwind v4 shadows; scheme-independent geometry and ink. */
export const shadows = {
  /** No shadow. */ none: 'none',
  /** Hairline shadow. */ '2xs': '0 1px rgb(0 0 0 / 0.05)',
  /** Extra-small shadow. */ xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  /** Small shadow. */ sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  /** Medium shadow. */ md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  /** Large shadow. */ lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  /** Extra-large shadow. */ xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  /** Largest shadow. */ '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
} as const
/** Geist font stacks. Font assets are installed separately. */
export const fonts = {
  /** Proportional UI text. */ sans: '"Geist Variable", "Geist", ui-sans-serif, system-ui, sans-serif',
  /** Code and tabular text. */ mono: '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace',
} as const
/** Tailwind v4 easing curves. */
export const easing = {
  /** Constant speed. */ linear: 'linear',
  /** Accelerating motion. */ in: 'cubic-bezier(0.4, 0, 1, 1)',
  /** Decelerating motion. */ out: 'cubic-bezier(0, 0, 0.2, 1)',
  /** Symmetric motion. */ inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const
