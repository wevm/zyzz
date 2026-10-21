/** @module The launch video timeline: scenes in order over the soundtrack. */
import geistMono from '@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2'
import geist from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Sequence,
  staticFile,
} from 'remotion'
import { Exit, Frame } from './Frame.js'
import {
  BaseUi,
  Bench,
  Css,
  Hero,
  Native,
  Prompt,
  Tailwind,
  Tokens,
  Variants,
} from './Scenes.js'
import { ink, scenes } from './Theme.js'

const handle = delayRender('fonts')
Promise.all([
  new FontFace('Geist', `url(${geist}) format('woff2')`, {
    weight: '100 900',
  }).load(),
  new FontFace('Geist Mono', `url(${geistMono}) format('woff2')`, {
    weight: '100 900',
  }).load(),
]).then((faces) => {
  faces.forEach((face) => document.fonts.add(face))
  continueRender(handle)
})

// Scenes follow the launch thread, with benchmarks and the Tailwind migration near the end.
const order = [
  { ...scenes.hero, node: <Hero /> },
  { ...scenes.css, node: <Css /> },
  { ...scenes.tokens, node: <Tokens /> },
  { ...scenes.variants, node: <Variants /> },
  { ...scenes.baseUi, node: <BaseUi /> },
  { ...scenes.native, node: <Native /> },
  { ...scenes.bench, node: <Bench /> },
  { ...scenes.tailwind, node: <Tailwind /> },
  { ...scenes.prompt, last: true, node: <Prompt /> },
]

/** The launch video: nine sections over the soundtrack's beat grid. */
export function Video() {
  return (
    <AbsoluteFill style={{ background: ink.bg }}>
      {order.map((scene) => (
        <Sequence
          durationInFrames={scene.duration}
          from={scene.from}
          key={scene.from}
        >
          {'last' in scene ? (
            scene.node
          ) : (
            <Exit duration={scene.duration}>{scene.node}</Exit>
          )}
        </Sequence>
      ))}
      <Frame />
      <Audio src={staticFile('soundtrack.wav')} />
    </AbsoluteFill>
  )
}
