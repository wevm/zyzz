/** @module Frame lines, crosshairs, dividers, and scene exits shared by every scene. */
import type { ReactNode } from 'react'
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion'
import { beat, frame as box, ink } from './Theme.js'

const ease = {
  easing: Easing.out(Easing.cubic),
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const

/** Decaying pulse on every beat of the soundtrack, strongest on each bar's downbeat. */
function usePulse() {
  const frame = useCurrentFrame()
  const position = frame / beat
  const index = Math.floor(position + 1e-6)
  const since = (position - index) * beat
  return {
    downbeat: index % 4 === 0 ? Math.exp(-since / 5) : 0,
    pulse: Math.exp(-since / 4) * (index % 4 === 0 ? 1 : 0.45),
  }
}

/** Full-bleed frame lines and corner crosshairs that draw in once, then pulse with the music. */
export function Frame() {
  const frame = useCurrentFrame()
  const draw = interpolate(frame, [0, 20], [0, 1], ease)
  const cross = interpolate(frame, [10, 24], [0, 1], ease)
  const { downbeat, pulse } = usePulse()
  const glow = downbeat * 0.12
  return (
    <AbsoluteFill>
      <Rule glow={glow} horizontal at={box.top} progress={draw} />
      <Rule glow={glow} horizontal at={box.bottom} progress={draw} reverse />
      <Rule glow={glow} at={box.left} progress={draw} />
      <Rule glow={glow} at={box.right} progress={draw} reverse />
      <Cross opacity={cross} pulse={pulse} x={box.left} y={box.top} />
      <Cross opacity={cross} pulse={pulse} x={box.right} y={box.bottom} />
    </AbsoluteFill>
  )
}

/** A hairline across the canvas (or a span of it), drawn from one end. */
export function Rule(props: {
  at: number
  from?: number
  glow?: number
  horizontal?: boolean
  progress: number
  reverse?: boolean
  to?: number
}) {
  const from = props.from ?? 0
  const to = props.to ?? (props.horizontal ? 1920 : 1080)
  const length = (to - from) * props.progress
  const start = props.reverse ? to - length : from
  return (
    <div
      style={{
        background: props.glow
          ? `rgba(255, 255, 255, ${0.14 + props.glow})`
          : ink.line,
        position: 'absolute',
        ...(props.horizontal
          ? { height: 1, left: start, top: props.at, width: length }
          : { height: length, left: props.at, top: start, width: 1 }),
      }}
    />
  )
}

function Cross(props: {
  opacity: number
  pulse: number
  x: number
  y: number
}) {
  const arm = 30
  return (
    <div
      style={{
        height: arm * 2,
        left: props.x - arm,
        opacity: props.opacity * (0.55 + 0.45 * props.pulse),
        position: 'absolute',
        top: props.y - arm,
        transform: `scale(${1 + 0.35 * props.pulse}) rotate(${props.pulse * 8}deg)`,
        width: arm * 2,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.7)',
          height: 1.5,
          left: 0,
          position: 'absolute',
          top: arm,
          width: arm * 2,
        }}
      />
      <div
        style={{
          background: 'rgba(255,255,255,0.7)',
          height: arm * 2,
          left: arm,
          position: 'absolute',
          top: 0,
          width: 1.5,
        }}
      />
    </div>
  )
}

/** Fades a scene out over its last frames. */
export function Exit(props: { children: ReactNode; duration: number }) {
  const frame = useCurrentFrame()
  const t = interpolate(frame, [props.duration - 8, props.duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <AbsoluteFill
      style={{ opacity: 1 - t, transform: `translateY(${-t * 10}px)` }}
    >
      {props.children}
    </AbsoluteFill>
  )
}

/** Draw-in progress for a divider that appears at the start of a scene. */
export function useDraw(delay = 0) {
  const frame = useCurrentFrame()
  return interpolate(frame, [delay, delay + 14], [0, 1], ease)
}
