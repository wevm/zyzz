/** @module Dark blueprint palette, frame geometry, and the scene timeline on the soundtrack's beat grid. */

// Accent colors are Geist dark-theme tokens (vercel.com/geist/colors): 700 for fills, 900 for text on black.
export const ink = {
  bg: '#000000',
  blue: '#50A8FF',
  blueFill: '#0071F6',
  comment: '#6E7177',
  errorBg: '#330A11',
  errorBorder: '#6F101B',
  errorText: '#FF5E63',
  gray: '#8B8D92',
  green: '#00CA52',
  highlight: '#06193A',
  label: '#6F7277',
  lavender: '#C472FB',
  line: 'rgba(255, 255, 255, 0.14)',
  // Success summaries: a green-200 tint with text leaning toward green-1000.
  successBg: '#00290D',
  successText: '#B8F5CC',
  red: '#FF5E63',
  white: '#F2F2F3',
}

export const mono = '"Geist Mono", ui-monospace, monospace'

export const sans = '"Geist", -apple-system, system-ui, sans-serif'

// Frame lines, in canvas pixels.
export const frame = { bottom: 990, left: 90, right: 1830, top: 90 }

// The soundtrack ("Find Yourself" instrumental, from four bars before the first chorus) runs at 136.08 BPM, and frame 0 is a downbeat.
export const beat = (60 / 136.08) * 30

/** Frame of the `n`th beat, rounded to the nearest frame. */
export const beats = (n: number) => Math.round(n * beat)

const bars = {
  baseUi: 5,
  bench: 4,
  css: 5,
  hero: 3,
  native: 3,
  prompt: 4,
  tailwind: 3,
  tokens: 5,
  variants: 4,
}

const order = [
  'hero',
  'css',
  'tokens',
  'variants',
  'baseUi',
  'native',
  'bench',
  'tailwind',
  'prompt',
] as const

// Scenes start on bar lines of the soundtrack.
export const scenes = (() => {
  const out = {} as Record<
    (typeof order)[number],
    { duration: number; from: number }
  >
  let bar = 0
  for (const name of order) {
    const from = beats(bar * 4)
    bar += bars[name]
    out[name] = { duration: beats(bar * 4) - from, from }
  }
  return out
})()

export const total = beats(order.reduce((n, name) => n + bars[name], 0) * 4)

// Annotation frames within their scenes, each on a beat, shared by the animations and the sound cues.
export const cssSteps = {
  bg: beats(7),
  hover: beats(13),
  media: beats(16),
  radius: beats(10),
  summary: beats(17),
}

export const tokenSteps = { lint: beats(14), off: beats(11), ok: beats(8) }

export const variantSteps = { error: beats(11), ok: beats(9) }

export const baseUiSteps = {
  disabled: beats(13),
  highlighted: beats(7),
  selected: beats(10),
  summary: beats(16),
}

export const benchSteps = {
  build: beats(10),
  buildBars: beats(5),
  delivery: beats(11),
  deliveryBars: beats(7.5),
}

export const nativeSteps = { native: beats(8), web: beats(7) }

export const tailwindSteps = { rows: [4, 5, 6, 7].map(beats) }

export const heroSteps = { install: beats(6), tagline: beats(3) }

export const promptSteps = { quote: beats(4) }
