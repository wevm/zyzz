/** @module Geist-styled preview components: canvas, buttons, badges, cursor, browser, and phone. */
import type { CSSProperties, ReactNode } from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { ink } from './Theme.js'

/** Geist dark-theme tokens (vercel.com/geist/colors), with sizes scaled up for 1080p video. */
export const geist = {
  bg: '#0A0A0A',
  amber: '#FFB200',
  blue: '#0071F6',
  border: 'rgba(255, 255, 255, 0.14)',
  fg: '#EDEDED',
  green: '#00CA52',
  muted: '#A1A1A1',
  red: '#FF5E63',
  sans: '"Geist", -apple-system, system-ui, sans-serif',
  surface: '#111111',
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

export const fade = (frame: number, at: number, length = 10) =>
  interpolate(frame, [at, at + length], [0, 1], clamp)

/** Dotted canvas that hosts rendered components, labeled like a preview pane. */
export function Canvas(props: {
  at: number
  children: ReactNode
  label?: string
  style?: CSSProperties
}) {
  const frame = useCurrentFrame()
  const t = fade(frame, props.at, 12)
  return (
    <div
      style={{
        backgroundColor: geist.bg,
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.09) 1.2px, transparent 1.2px)',
        backgroundSize: '26px 26px',
        border: `1px solid ${geist.border}`,
        borderRadius: 16,
        opacity: t,
        overflow: 'hidden',
        position: 'absolute',
        transform: `translateY(${(1 - t) * 18}px)`,
        ...props.style,
      }}
    >
      <div
        style={{
          color: ink.label,
          fontFamily: geist.sans,
          fontSize: 24,
          left: 24,
          position: 'absolute',
          top: 18,
        }}
      >
        {props.label ?? 'preview'}
      </div>
      {props.children}
    </div>
  )
}

export type ButtonProps = {
  children: ReactNode
  style?: CSSProperties
  variant?: 'primary' | 'secondary' | 'brand'
  size?: 'sm' | 'md'
}

/** Geist-style button. */
export function Button(props: ButtonProps) {
  const variant = props.variant ?? 'primary'
  const size = props.size ?? 'md'
  const colors = {
    brand: { background: geist.blue, border: geist.blue, color: '#fff' },
    primary: { background: geist.fg, border: geist.fg, color: '#0A0A0A' },
    secondary: { background: geist.bg, border: geist.border, color: geist.fg },
  }[variant]
  return (
    <div
      style={{
        alignItems: 'center',
        background: colors.background,
        border: `1.5px solid ${colors.border}`,
        borderRadius: 12,
        color: colors.color,
        display: 'inline-flex',
        fontFamily: geist.sans,
        fontSize: size === 'sm' ? 24 : 30,
        fontWeight: 550,
        gap: 12,
        height: size === 'sm' ? 56 : 76,
        justifyContent: 'center',
        letterSpacing: '-0.01em',
        padding: size === 'sm' ? '0 22px' : '0 36px',
        whiteSpace: 'nowrap',
        ...props.style,
      }}
    >
      {props.children}
    </div>
  )
}

/** Small status pill with a dot. */
export function Badge(props: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        alignItems: 'center',
        background: `${props.color}22`,
        borderRadius: 99,
        color: props.color,
        display: 'inline-flex',
        fontFamily: geist.sans,
        fontSize: 22,
        fontWeight: 550,
        gap: 10,
        padding: '6px 16px',
      }}
    >
      <span
        style={{
          background: props.color,
          borderRadius: 99,
          height: 10,
          width: 10,
        }}
      />
      {props.children}
    </span>
  )
}

/** Mouse pointer. */
export function Cursor(props: { style?: CSSProperties }) {
  return (
    <svg
      height="44"
      style={{ position: 'absolute', ...props.style }}
      viewBox="0 0 24 24"
      width="44"
    >
      <path
        d="M4 2l15 10.5-6.6 1.2 3.9 7.3-3 1.6-3.9-7.4L4 20z"
        fill="#fff"
        stroke="#000"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

/** Browser window chrome around web content. */
export function Browser(props: {
  children: ReactNode
  style?: CSSProperties
  url: string
}) {
  return (
    <div
      style={{
        background: geist.bg,
        border: `1px solid ${geist.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'absolute',
        ...props.style,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          borderBottom: `1px solid ${geist.border}`,
          display: 'flex',
          gap: 10,
          height: 52,
          padding: '0 20px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              background: '#2A2A2A',
              borderRadius: 99,
              height: 13,
              width: 13,
            }}
          />
        ))}
        <span
          style={{
            background: geist.surface,
            border: `1px solid ${geist.border}`,
            borderRadius: 8,
            color: geist.muted,
            fontFamily: geist.sans,
            fontSize: 19,
            marginLeft: 18,
            padding: '5px 18px',
          }}
        >
          {props.url}
        </span>
      </div>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          height: 'calc(100% - 52px)',
          justifyContent: 'center',
        }}
      >
        {props.children}
      </div>
    </div>
  )
}

/** Phone outline around native content. */
export function Phone(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        background: geist.bg,
        border: '3px solid #2E2E2E',
        borderRadius: 48,
        overflow: 'hidden',
        position: 'absolute',
        ...props.style,
      }}
    >
      <div
        style={{
          background: '#000',
          borderRadius: 99,
          height: 30,
          left: '50%',
          position: 'absolute',
          top: 16,
          transform: 'translateX(-50%)',
          width: 110,
        }}
      />
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
        }}
      >
        {props.children}
      </div>
    </div>
  )
}
