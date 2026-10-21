/** @module Renders the sound effects, timed to the video's scenes, into `public/sfx.wav` with headless Chromium. */
import * as Fs from 'node:fs'
import * as Http from 'node:http'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import {
  baseUiSteps,
  beat,
  benchSteps,
  cssSteps,
  heroSteps,
  nativeSteps,
  promptSteps,
  scenes,
  tailwindSteps,
  tokenSteps,
  total,
  variantSteps,
} from '../src/Theme.ts'

type Kind = 'error' | 'plink' | 'pop' | 'typing'

type Cue = {
  at: number
  kind: Kind
  length?: number | undefined
  note?: number | undefined
}

/** Browser globals that `sfx.html` defines. */
type Renderer = {
  encode: () => string
  render: (
    events: readonly (Cue & { time: number })[],
    seconds: number,
  ) => Promise<void>
}

/** Typing cue lasting as long as `text` takes to type at `perFrame` characters per frame. */
const typed = (at: number, text: string, perFrame: number): Cue => ({
  at,
  kind: 'typing',
  length: text.length / perFrame / 30,
})

/** Rising pops for chart bars that start half a beat apart. */
const bars = (at: number, from: number): Cue[] =>
  Array.from({ length: 5 }, (_, i) => ({
    at: at + Math.round((i * beat) / 2),
    kind: 'pop' as const,
    note: from + i,
  }))

// Frames within each scene. Sounds mark annotations, the install command, chart bars, and typed text.
const cues: Partial<Record<keyof typeof scenes, readonly Cue[]>> = {
  baseUi: [
    { at: baseUiSteps.highlighted, kind: 'pop', note: 0 },
    { at: baseUiSteps.selected, kind: 'pop', note: 2 },
    { at: baseUiSteps.disabled, kind: 'pop', note: 4 },
    { at: baseUiSteps.summary, kind: 'plink' },
    typed(baseUiSteps.summary, 'Every state checked against Base UI.', 2.4),
  ],
  bench: [
    ...bars(benchSteps.buildBars, 0),
    ...bars(benchSteps.deliveryBars, 2),
    { at: benchSteps.build, kind: 'plink' },
    typed(benchSteps.build, 'Fastest compiled output', 2.4),
    { at: benchSteps.delivery, kind: 'plink' },
    typed(benchSteps.delivery, 'Smallest CSS + JS bundle', 2.4),
  ],
  css: [
    { at: cssSteps.bg, kind: 'pop', note: 0 },
    { at: cssSteps.radius, kind: 'pop', note: 1 },
    { at: cssSteps.hover, kind: 'pop', note: 2 },
    { at: cssSteps.media, kind: 'pop', note: 3 },
    { at: cssSteps.summary, kind: 'plink' },
    typed(cssSteps.summary, 'All standard CSS. No bespoke API to learn.', 2.4),
  ],
  hero: [
    typed(
      heroSteps.tagline,
      'CSS with design rules that agents can check.',
      1.6,
    ),
    { at: heroSteps.install, kind: 'pop', note: 4 },
  ],
  native: [
    { at: nativeSteps.web, kind: 'pop', note: 2 },
    { at: nativeSteps.native, kind: 'pop', note: 4 },
  ],
  prompt: [
    typed(
      promptSteps.quote,
      '“Read zyzz.style and help me build my project with Zyzz.”',
      1.5,
    ),
  ],
  tailwind: tailwindSteps.rows.map((at, i) => ({
    at,
    kind: 'pop' as const,
    note: i + 1,
  })),
  tokens: [
    { at: tokenSteps.ok, kind: 'plink' },
    { at: tokenSteps.off, kind: 'error' },
    { at: tokenSteps.lint, kind: 'error' },
  ],
  variants: [
    { at: variantSteps.ok, kind: 'plink' },
    { at: variantSteps.error, kind: 'error' },
  ],
}

const events = Object.entries(cues)
  .flatMap(([name, list]) =>
    (list ?? []).map((cue) => ({
      ...cue,
      time: (scenes[name as keyof typeof scenes].from + cue.at) / 30,
    })),
  )
  .sort((a, b) => a.time - b.time)

const root = Path.resolve(import.meta.dirname, '..')

const server = Http.createServer((request, response) => {
  const file = Path.join(import.meta.dirname, 'sfx.html')
  if (new URL(request.url ?? '/', 'http://localhost').pathname !== '/')
    return void response.writeHead(404).end()
  response
    .writeHead(200, { 'content-type': 'text/html' })
    .end(Fs.readFileSync(file))
})
await new Promise<void>((resolve) => server.listen(0, resolve))
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 0

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {},
)
const page = await browser.newPage()
page.on('pageerror', (error) => console.error(error.message))
await page.goto(`http://localhost:${port}/`)
await page.waitForFunction(() => 'render' in globalThis)
await page.evaluate(
  (input) =>
    (globalThis as unknown as Renderer).render(input.events, input.seconds),
  { events, seconds: Math.ceil(total / 30) + 1 },
)
const wav = await page.evaluate(() =>
  (globalThis as unknown as Renderer).encode(),
)

Fs.mkdirSync(Path.join(root, 'public'), { recursive: true })
Fs.writeFileSync(Path.join(root, 'public/sfx.wav'), Buffer.from(wav, 'base64'))
console.log(`Rendered ${events.length} sound cues to public/sfx.wav`)

await browser.close()
server.close()
