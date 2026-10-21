/** @module The launch video's scenes, each a section title followed by an animated example. */
import { Fragment, type ReactNode } from 'react'
import {
  AbsoluteFill,
  Easing,
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Logo } from './Logo.js'
import { Highlighted, Mark, Panel } from './Code.js'
import { Rule, useDraw } from './Frame.js'
import {
  Badge,
  Browser,
  Button,
  Canvas,
  Cursor,
  geist,
  Phone,
} from './Geist.js'
import { type Brand, BrandIcon } from './Brands.js'
import {
  baseUiSteps,
  beat,
  beats,
  benchSteps,
  cssSteps,
  frame as box,
  heroSteps,
  ink,
  mono,
  nativeSteps,
  promptSteps,
  sans,
  tailwindSteps,
  tokenSteps,
  variantSteps,
} from './Theme.js'

const fade = (frame: number, at: number, length = 8) =>
  interpolate(frame, [at, at + length], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

/** Types `segments` from `at`, keeping untyped characters in layout so wrapping never shifts. */
function Typed(props: {
  at: number
  perFrame?: number
  segments: readonly { color: string; text: string }[]
}) {
  const frame = useCurrentFrame()
  const typed = Math.max(0, (frame - props.at) * (props.perFrame ?? 1.6))
  const total = props.segments.reduce((n, s) => n + s.text.length, 0)
  const typing = frame >= props.at && typed < total + 6
  const cursor = (
    <span
      style={{
        background: ink.blueFill,
        display: 'inline-block',
        height: '0.95em',
        marginLeft: 4,
        marginRight: -4 - 0.08 * 16,
        verticalAlign: '-0.12em',
        width: '0.08em',
      }}
    />
  )
  let used = 0
  let placed = false
  return (
    <>
      {props.segments.map((segment, i) => {
        const visible = Math.max(
          0,
          Math.min(segment.text.length, Math.floor(typed - used)),
        )
        used += segment.text.length
        // The cursor follows the last typed character, before the hidden remainder.
        const here =
          typing &&
          !placed &&
          (visible < segment.text.length || i === props.segments.length - 1)
        if (here) placed = true
        return (
          <span key={i}>
            <span style={{ color: segment.color }}>
              {segment.text.slice(0, visible)}
            </span>
            {here && cursor}
            <span style={{ color: 'transparent' }}>
              {segment.text.slice(visible)}
            </span>
          </span>
        )
      })}
    </>
  )
}

export function Hero() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        fontFamily: sans,
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: ink.gray,
          fontFamily: geist.sans,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          opacity: fade(frame, beats(0.5)),
        }}
      >
        Introducing
      </div>
      <div style={{ marginTop: 34 }}>
        <Logo
          delay={beats(1)}
          fill={ink.white}
          stagger={beat / 4}
          width={380}
        />
      </div>
      <div
        style={{
          color: ink.white,
          fontSize: 60,
          fontWeight: 500,
          letterSpacing: '-0.03em',
          lineHeight: 1.4,
          marginTop: 48,
        }}
      >
        <Typed
          at={heroSteps.tagline}
          perFrame={1.6}
          segments={[
            { color: ink.white, text: 'CSS with design rules that ' },
            { color: ink.blue, text: 'agents can check' },
            { color: ink.white, text: '.' },
          ]}
        />
      </div>
      <div
        style={{
          marginTop: 56,
          opacity: fade(frame, heroSteps.install),
          transform: `translateY(${(1 - fade(frame, heroSteps.install)) * 12}px)`,
        }}
      >
        <CodeBlock size={46}>
          <span style={{ color: ink.label }}>npm i </span>zyzz
        </CodeBlock>
      </div>
    </AbsoluteFill>
  )
}

/** Bordered code block for a shell command. */
function CodeBlock(props: { children: ReactNode; size: number }) {
  return (
    <span
      style={{
        background: geist.bg,
        border: `1px solid ${geist.border}`,
        borderRadius: 14,
        color: ink.white,
        display: 'inline-block',
        fontFamily: mono,
        fontSize: props.size,
        padding: `${props.size * 0.45}px ${props.size}px`,
      }}
    >
      {props.children}
    </span>
  )
}

/** Inline code chip inside prose. */
function InlineCode(props: { children: string }) {
  return (
    <span
      style={{
        background: 'rgba(255, 255, 255, 0.08)',
        border: `1px solid ${geist.border}`,
        borderRadius: 8,
        color: ink.white,
        fontFamily: mono,
        fontSize: '0.88em',
        padding: '2px 10px',
      }}
    >
      {props.children}
    </span>
  )
}

/** Brand mark beside its name, for title-card illustrations. */
function Tool(props: { color: string; label: string; name: Brand }) {
  return (
    <span
      style={{
        alignItems: 'center',
        color: ink.white,
        display: 'flex',
        fontFamily: sans,
        fontSize: 34,
        fontWeight: 500,
        gap: 16,
      }}
    >
      <BrandIcon color={props.color} name={props.name} size={44} />
      {props.label}
    </span>
  )
}

const titleSize = 76
const captionSize = 28

/**
 * Section opener: a full-screen title and subtitle that, after a beat, shrinks
 * into the caption band while the example builds underneath.
 */
function Title(props: {
  extra?: ReactNode
  hold?: number
  index: number
  sub: ReactNode
  title: readonly { blue?: boolean; text: string }[]
}) {
  const hold = props.hold ?? 2
  const frame = useCurrentFrame()
  const enter = fade(frame, 0, 10)
  const t = interpolate(frame, [beats(hold), beats(hold + 1)], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const scale = 1 - (1 - captionSize / titleSize) * t
  const top = 420
  const target = box.top / 2 - (captionSize * 1.2) / 2
  return (
    <>
      <div
        style={{
          fontFamily: sans,
          fontSize: titleSize,
          fontWeight: 600,
          left: box.left + 72,
          letterSpacing: '-0.04em',
          lineHeight: 1.2,
          opacity: enter,
          position: 'absolute',
          top,
          transform: `translateY(${(target - top) * t + (1 - enter) * 16}px) scale(${scale})`,
          transformOrigin: 'left top',
          whiteSpace: 'nowrap',
        }}
      >
        {props.title.map((part, i) => (
          <span key={i} style={{ color: part.blue ? ink.blue : ink.white }}>
            {part.text}
          </span>
        ))}
      </div>
      <div
        style={{
          color: ink.gray,
          fontFamily: sans,
          fontSize: 36,
          left: box.left + 72,
          opacity: enter * (1 - t),
          position: 'absolute',
          top: top + titleSize * 1.2 + 26,
          transform: `translateY(${-t * 40}px)`,
        }}
      >
        {props.sub}
        {props.extra && (
          <div style={{ display: 'flex', gap: 40, marginTop: 40 }}>
            {props.extra}
          </div>
        )}
      </div>
    </>
  )
}

const inset = 72

/** Eases a property between two values once `frame` passes `at`. */
const step = (
  frame: number,
  at: number,
  from: number,
  to: number,
  length = 12,
) =>
  interpolate(frame, [at, at + length], [from, to], {
    easing: Easing.inOut(Easing.cubic),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

const specs = {
  bg: {
    css: 'background-color',
    property: 'backgroundColor',
    spec: 'CSS Color 4',
  },
  hover: { css: ':hover', property: ':hover', spec: 'Selectors 4' },
  media: { css: '@media', property: '@media md', spec: 'Media Queries 4' },
  radius: {
    css: 'border-radius',
    property: 'borderRadius',
    spec: 'Backgrounds & Borders 3',
  },
} as const

export function Css() {
  const frame = useCurrentFrame()
  const at = cssSteps
  const split = 900
  const bg = interpolateColors(
    frame,
    [at.bg, at.bg + beats(1)],
    ['rgba(0,113,246,0)', geist.blue],
  )
  const border = interpolateColors(
    frame,
    [at.bg, at.bg + beats(1)],
    ['rgba(255,255,255,0.45)', geist.blue],
  )
  const radius = step(frame, at.radius, 0, 22, beats(1))
  const point = step(frame, at.hover - beats(1), 0, 1, beats(1))
  const hovered = step(frame, at.hover, 1, 0.75, 6)
  const grow = step(frame, at.media, 0, 1, beats(1))
  const viewport = step(frame, at.media - beats(1), 0, 1, beats(1))
  const steps = (['bg', 'radius', 'hover', 'media'] as const).map((key) => ({
    at: at[key],
    ...specs[key],
  }))
  const current = [...steps].reverse().find((s) => frame >= s.at)
  const summary = fade(frame, at.summary, 6)
  return (
    <AbsoluteFill>
      <Title
        extra={
          <>
            <Tool color={ink.white} label="MDN Web Docs" name="mdn" />
            <Tool color="#3D8FD6" label="W3C" name="w3c" />
          </>
        }
        hold={4}
        index={2}
        sub="Agents reference MDN and the W3C spec, not a bespoke API."
        title={[
          { text: 'If you know CSS, you know ' },
          { blue: true, text: 'Zyzz' },
          { text: '.' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(5))}
        to={box.bottom}
      />
      <Panel
        at={beats(5)}
        lines={[
          { text: 'const button = style({' },
          { text: "  color: 'white'," },
          { text: '  padding: 3,' },
          { highlight: { at: at.bg }, text: "  backgroundColor: 'blue.700'," },
          { highlight: { at: at.radius }, text: "  borderRadius: 'lg'," },
          {
            highlight: { at: at.hover },
            text: "  ':hover': { opacity: 0.75 },",
          },
          {
            highlight: { at: at.media },
            text: "  '@media md': { padding: 6 },",
          },
          { text: '})' },
        ]}
        size={36}
        stagger={beat / 4}
        title="button.ts"
        top={160}
        width={split - box.left}
        x={box.left}
      />
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          fontFamily: sans,
          fontSize: 30,
          height: 76,
          left: box.left + inset,
          position: 'absolute',
          top: 820,
          width: split - box.left - inset * 2,
        }}
      >
        <div
          style={{
            background: ink.successBg,
            bottom: 0,
            left: -inset,
            opacity: summary,
            position: 'absolute',
            right: -inset,
            top: 0,
          }}
        />
        <span
          style={{ display: 'flex', marginRight: 20, position: 'relative' }}
        >
          <Mark at={at.summary} frame={frame} ok size={34} />
        </span>
        <span style={{ position: 'relative' }}>
          <Typed
            at={at.summary}
            perFrame={2.4}
            segments={[
              {
                color: ink.successText,
                text: 'All standard CSS. No bespoke API to learn.',
              },
            ]}
          />
        </span>
      </div>
      <Canvas
        at={beats(6)}
        style={{
          height: 800,
          left: split + 48,
          top: 150,
          width: box.right - split - 96,
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            height: 500,
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <div
            style={{
              border: `2px dashed ${ink.blue}`,
              borderRadius: 18,
              height: 330,
              opacity: viewport * 0.7,
              position: 'absolute',
              width: 380 + viewport * 380,
            }}
          >
            <span
              style={{
                background: geist.bg,
                color: ink.blue,
                fontFamily: sans,
                fontSize: 26,
                left: 20,
                padding: '0 10px',
                position: 'absolute',
                top: -16,
              }}
            >
              viewport ≥ md
            </span>
          </div>
          <div
            style={{
              background: bg,
              border: `2px solid ${border}`,
              borderRadius: radius,
              color: '#fff',
              fontFamily: geist.sans,
              fontSize: 40 + grow * 6,
              fontWeight: 550,
              opacity: hovered,
              padding: `${12 + grow * 14}px ${24 + grow * 36}px`,
              position: 'relative',
            }}
          >
            Deploy
            <Cursor
              style={{
                left: `${72 + (1 - point) * 220}%`,
                opacity: point > 0 ? 1 : 0,
                top: `${58 + (1 - point) * 120}%`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            height: 300,
            left: 40,
            position: 'absolute',
            right: 40,
            top: 480,
          }}
        >
          {steps.map((s) => {
            const t = fade(frame, s.at, 10)
            return current === s ? (
              <SpecCard
                css={s.css}
                key={s.property}
                opacity={t}
                property={s.property}
                spec={s.spec}
              />
            ) : null
          })}
        </div>
      </Canvas>
    </AbsoluteFill>
  )
}

/** Reference card for the CSS feature a step uses: MDN entry plus the W3C spec that defines it. */
function SpecCard(props: {
  css: string
  opacity: number
  property: string
  spec: string
}) {
  return (
    <div
      style={{
        background: geist.surface,
        border: `1px solid ${geist.border}`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: sans,
        gap: 18,
        opacity: props.opacity,
        padding: '30px 36px',
        transform: `translateY(${(1 - props.opacity) * 14}px)`,
      }}
    >
      <span
        style={{
          alignItems: 'center',
          color: geist.muted,
          display: 'flex',
          fontSize: 24,
          gap: 12,
        }}
      >
        <BrandIcon color={ink.white} name="mdn" size={28} />
        MDN Web Docs
        <span
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 10,
            marginLeft: 'auto',
          }}
        >
          <BrandIcon color="#3D8FD6" name="w3c" size={28} />
          {props.spec}
        </span>
      </span>
      <span style={{ color: ink.blue, fontFamily: mono, fontSize: 44 }}>
        {props.css}
      </span>
      <span style={{ color: ink.label, fontSize: 22 }}>
        developer.mozilla.org/docs/Web/CSS/{props.css.replace(/^[:@]/, '')}
      </span>
    </div>
  )
}

export function Tokens() {
  const frame = useCurrentFrame()
  const split = 960
  const at = tokenSteps
  const rejected = step(frame, at.off + beats(1), 0, 1, beats(1))
  return (
    <AbsoluteFill>
      <Title
        extra={
          <>
            <Tool color="#3178C6" label="TypeScript" name="typescript" />
            <Tool color={ink.white} label="Oxlint" name="oxlint" />
          </>
        }
        hold={4}
        index={3}
        sub="The type checker and the linter flag off-brand values before review."
        title={[
          { text: 'Off-system gets ' },
          { blue: true, text: 'caught' },
          { text: '.' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(5))}
        to={box.bottom}
      />
      <Panel
        at={beats(5)}
        errorSize={22}
        lines={[
          { text: 'const save = style({' },
          {
            mark: { at: at.ok, ok: true },
            text: "  backgroundColor: 'brand',",
          },
          { text: '})' },
          { text: '' },
          { at: beats(6), text: 'const cancel = style({' },
          {
            at: beats(6.25),
            error: {
              at: at.off + 2,
              source: 'typescript',
              text: `Type '"#8b5cf6"' is not assignable to '"brand"'.`,
            },
            mark: { at: at.off, ok: false },
            squiggle: { at: at.off - beats(0.5), match: 'backgroundColor' },
            text: "  backgroundColor: '#8b5cf6',",
          },
          {
            at: beats(6.5),
            error: {
              at: at.lint + 2,
              source: 'oxlint',
              text: `zyzz(use-logical-properties): Use a CSS logical property instead of 'marginLeft', such as 'marginInlineStart'.`,
            },
            mark: { at: at.lint, ok: false },
            squiggle: { at: at.lint - beats(0.5), match: 'marginLeft' },
            text: "  marginLeft: 'md',",
          },
          { at: beats(6.75), text: '})' },
        ]}
        size={34}
        title="button.ts"
        top={130}
        width={split - box.left}
        x={box.left}
      />
      <Canvas
        at={beats(6)}
        style={{
          height: 800,
          left: split + 48,
          top: 150,
          width: box.right - split - 96,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 72,
            padding: '140px 56px 0',
          }}
        >
          <Example
            at={at.ok - beats(0.5)}
            badge={<Badge color={geist.green}>on-brand</Badge>}
          >
            <Button style={{ fontSize: 34, height: 84 }} variant="brand">
              Save
            </Button>
          </Example>
          <Example
            at={at.off - beats(1.5)}
            badge={
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <span style={{ opacity: fade(frame, at.off, 8) }}>
                  <Badge color={geist.red}>
                    <BrandIcon color="#3178C6" name="typescript" size={22} />{' '}
                    #8b5cf6 · not a token
                  </Badge>
                </span>
                <span style={{ opacity: fade(frame, at.lint, 8) }}>
                  <Badge color={geist.red}>
                    <BrandIcon color={ink.white} name="oxlint" size={22} />{' '}
                    marginLeft · not logical
                  </Badge>
                </span>
              </div>
            }
          >
            <div style={{ display: 'flex' }}>
              <Button
                style={{
                  background: '#8B5CF6',
                  borderColor: '#8B5CF6',
                  color: '#fff',
                  fontSize: 34,
                  height: 84,
                  opacity: 1 - rejected * 0.55,
                }}
              >
                Cancel
              </Button>
            </div>
          </Example>
          <div
            style={{
              color: geist.muted,
              fontFamily: geist.sans,
              fontSize: 28,
              lineHeight: 1.45,
              opacity: fade(frame, at.lint + beats(2), 12),
            }}
          >
            Need an exception?{' '}
            <span style={{ color: geist.fg, fontFamily: mono }}>
              '#8b5cf6 !custom'
            </span>{' '}
            makes it explicit and searchable.
          </div>
        </div>
      </Canvas>
    </AbsoluteFill>
  )
}

function Example(props: { at: number; badge: ReactNode; children: ReactNode }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = spring({ config: { damping: 18 }, fps, frame: frame - props.at })
  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: 32,
        opacity: Math.min(1, t * 1.5),
        transform: `scale(${0.92 + t * 0.08})`,
        transformOrigin: 'left center',
      }}
    >
      {props.children}
      {props.badge}
    </div>
  )
}

const mapping = [
  ['rounded-lg', "borderRadius: 'lg'"],
  ['shadow-sm', "boxShadow: 'sm'"],
  ['p-4', 'padding: 4'],
  ['text-sm', "fontSize: 'sm'"],
] as const

export function Tailwind() {
  const frame = useCurrentFrame()
  const split = 1000
  const rowAt = (i: number) => tailwindSteps.rows[i] ?? 0
  const radius = step(frame, rowAt(0), 0, 16)
  const shadow = step(frame, rowAt(1), 0, 1)
  const pad = step(frame, rowAt(2), 10, 32)
  const text = step(frame, rowAt(3), 30, 24)
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Title
        index={7}
        sub={
          <>
            <InlineCode>zyzz/default</InlineCode> ships Tailwind's scales under
            the same names.
          </>
        }
        title={[
          { text: 'Coming from ' },
          { blue: true, text: 'Tailwind' },
          { text: '?' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(3))}
        to={box.bottom}
      />
      <div
        style={{
          color: ink.label,
          display: 'flex',
          fontSize: 26,
          left: box.left + inset,
          opacity: fade(frame, beats(3)),
          position: 'absolute',
          top: 170,
        }}
      >
        <span style={{ width: 350 }}>Tailwind</span>
        <span>
          <InlineCode>zyzz/default</InlineCode>
        </span>
      </div>
      {mapping.map(([from, to], i) => {
        const t = fade(frame, rowAt(i) - beats(0.5))
        const right = fade(frame, rowAt(i))
        return (
          <div
            key={from}
            style={{
              alignItems: 'center',
              borderBottom: `1px solid ${ink.line}`,
              display: 'flex',
              fontFamily: mono,
              fontSize: 40,
              height: 120,
              left: box.left,
              opacity: t,
              paddingLeft: inset,
              position: 'absolute',
              top: 240 + i * 120,
              width: split - box.left,
            }}
          >
            <span style={{ color: ink.white, width: 290 }}>{from}</span>
            <span style={{ color: ink.label, opacity: right, width: 60 }}>
              →
            </span>
            <span
              style={{
                opacity: right,
                transform: `translateX(${(1 - right) * -16}px)`,
                whiteSpace: 'pre',
              }}
            >
              <Highlighted text={to} />
            </span>
          </div>
        )
      })}
      <Canvas
        at={beats(3)}
        style={{
          height: 800,
          left: split + 48,
          top: 150,
          width: box.right - split - 96,
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            height: '100%',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: geist.bg,
              border: `1px solid ${geist.border}`,
              borderRadius: radius,
              boxShadow: `0 ${10 * shadow}px ${30 * shadow}px rgba(0,0,0,${0.6 * shadow}), 0 0 0 ${shadow}px rgba(255,255,255,0.04)`,
              fontFamily: geist.sans,
              opacity: fade(frame, rowAt(0)),
              padding: pad,
              width: 600,
            }}
          >
            <div style={{ alignItems: 'center', display: 'flex', gap: 18 }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #0071F6, #C472FB)',
                  borderRadius: 99,
                  height: 52,
                  width: 52,
                }}
              />
              <div>
                <div
                  style={{
                    color: geist.fg,
                    fontSize: text + 4,
                    fontWeight: 600,
                  }}
                >
                  zyzz-docs
                </div>
                <div style={{ color: geist.muted, fontSize: text - 2 }}>
                  zyzz.style
                </div>
              </div>
              <span style={{ marginLeft: 'auto' }}>
                <Badge color={geist.green}>Ready</Badge>
              </span>
            </div>
            <div
              style={{
                borderTop: `1px solid ${geist.border}`,
                margin: `${pad * 0.8}px 0`,
              }}
            />
            <div style={{ color: geist.muted, fontSize: text - 4 }}>
              main · feat: add docs playground
            </div>
            <div
              style={{ color: geist.muted, fontSize: text - 4, marginTop: 8 }}
            >
              2m ago by jxom
            </div>
          </div>
        </div>
      </Canvas>
    </AbsoluteFill>
  )
}

export function Variants() {
  const frame = useCurrentFrame()
  const split = 900
  const at = variantSteps
  const grid = [
    { at: beats(5.5), size: 'sm', tone: 'primary' },
    { at: beats(6), size: 'sm', tone: 'quiet' },
    { at: beats(6.5), size: 'md', tone: 'primary' },
    { at: beats(7), size: 'md', tone: 'quiet' },
  ] as const
  return (
    <AbsoluteFill>
      <Title
        index={4}
        sub="Agents can only pick choices that exist."
        title={[
          { text: 'Variants, ' },
          { blue: true, text: 'built in' },
          { text: '.' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(3))}
        to={box.bottom}
      />
      <Panel
        at={beats(3)}
        lines={[
          { text: 'const button = variants({' },
          { text: '  variants: {' },
          { text: '    size: {' },
          { text: '      sm: { padding: 2 },' },
          { text: '      md: { padding: 4 },' },
          { text: '    },' },
          { text: '    tone: {' },
          { text: "      primary: { color: 'black' }," },
          { text: "      quiet: { color: 'white' }," },
          { text: '    },' },
          { text: '  },' },
          { text: '})' },
        ]}
        size={34}
        stagger={beat / 4}
        title="button.ts"
        top={150}
        width={split - box.left}
        x={box.left}
      />
      <Canvas
        at={beats(5)}
        style={{
          height: 440,
          left: split + 48,
          top: 150,
          width: box.right - split - 96,
        }}
      >
        <div
          style={{
            display: 'grid',
            fontFamily: sans,
            gap: '30px 40px',
            gridTemplateColumns: '70px 1fr 1fr',
            padding: '80px 40px 0',
          }}
        >
          <span />
          <span
            style={{
              color: ink.label,
              fontSize: 22,
              opacity: fade(frame, beats(5.5)),
            }}
          >
            primary
          </span>
          <span
            style={{
              color: ink.label,
              fontSize: 22,
              opacity: fade(frame, beats(5.5)),
            }}
          >
            quiet
          </span>
          {(['sm', 'md'] as const).map((size) => (
            <Fragment key={size}>
              <span
                style={{
                  alignSelf: 'center',
                  color: ink.label,
                  fontSize: 22,
                  opacity: fade(frame, beats(5.5)),
                }}
              >
                {size}
              </span>
              {grid
                .filter((cell) => cell.size === size)
                .map((cell) => {
                  const t = spring({
                    config: { damping: 16 },
                    fps: 30,
                    frame: frame - cell.at,
                  })
                  const chosen =
                    size === 'md' && cell.tone === 'primary'
                      ? fade(frame, at.ok, 8)
                      : 0
                  return (
                    <div
                      key={cell.tone}
                      style={{
                        opacity: Math.min(1, t * 1.5),
                        transform: `scale(${0.9 + t * 0.1})`,
                        transformOrigin: 'left center',
                      }}
                    >
                      <Button
                        size={size}
                        style={{
                          boxShadow: `0 0 0 ${chosen * 3}px ${ink.bg}, 0 0 0 ${chosen * 6}px ${geist.blue}`,
                        }}
                        variant={
                          cell.tone === 'primary' ? 'primary' : 'secondary'
                        }
                      >
                        Save changes
                      </Button>
                    </div>
                  )
                })}
            </Fragment>
          ))}
        </div>
      </Canvas>
      <Panel
        at={at.ok - beats(0.5)}
        errorSize={24}
        lines={[
          {
            mark: { at: at.ok, ok: true },
            text: '<Button size="md" tone="primary" />',
          },
          {
            at: at.ok + beats(1),
            error: {
              at: at.error + 2,
              text: `Type '"huge"' is not assignable to '"sm" | "md"'.`,
            },
            mark: { at: at.error, ok: false },
            squiggle: { at: at.error - beats(0.5), match: 'size' },
            text: '<Button size="huge" />',
          },
        ]}
        pad={72}
        size={32}
        title="App.tsx"
        top={630}
        width={box.right - split}
        x={split}
      />
    </AbsoluteFill>
  )
}

// State descriptions are quoted from Base UI's documented Select.Item data attributes.
const baseUiStates = [
  {
    attribute: 'data-highlighted',
    description: 'Present when the select item is highlighted.',
    key: 'highlighted',
  },
  {
    attribute: 'data-selected',
    description: 'Present when the select item is selected.',
    key: 'selected',
  },
  {
    attribute: 'data-disabled',
    description: 'Present when the select item is disabled.',
    key: 'disabled',
  },
] as const

const fruits = ['Apple', 'Banana', 'Cherry'] as const

export function BaseUi() {
  const frame = useCurrentFrame()
  const at = baseUiSteps
  const split = 1020
  const highlight = step(frame, at.highlighted, 0, 1, beats(0.5))
  const point = step(frame, at.highlighted - beats(1), 0, 1, beats(1))
  const selected = step(frame, at.selected, 0, 1, beats(0.5))
  const disabled = step(frame, at.disabled, 0, 1, beats(0.5))
  const steps = baseUiStates.map((state) => ({ ...state, at: at[state.key] }))
  const current = [...steps].reverse().find((state) => frame >= state.at)
  const summary = fade(frame, at.summary, 6)
  return (
    <AbsoluteFill>
      <Title
        extra={<Tool color="#007FFF" label="Base UI" name="mui" />}
        index={0}
        sub="Style each part by its documented states, checked against Base UI's data attributes."
        title={[
          { text: 'Built for ' },
          { blue: true, text: 'Base UI' },
          { text: '.' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(3))}
        to={box.bottom}
      />
      <Panel
        at={beats(3)}
        lines={[
          { text: "import { Select } from '@base-ui/react/select'" },
          { text: "import { style } from 'zyzz/base-ui/react'" },
          { text: '' },
          { text: 'const item = style(Select.Item, {' },
          { text: '  states: {' },
          {
            highlight: { at: at.highlighted },
            text: "    highlighted: { background: '#0071f6' },",
          },
          {
            highlight: { at: at.selected },
            text: '    selected: { fontWeight: 700 },',
          },
          {
            highlight: { at: at.disabled },
            text: '    disabled: { opacity: 0.5 },',
          },
          { text: '  },' },
          { text: '})' },
        ]}
        size={28}
        stagger={beat / 4}
        title="Select.tsx"
        top={160}
        width={split - box.left}
        x={box.left}
      />
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          fontFamily: sans,
          fontSize: 30,
          height: 76,
          left: box.left + inset,
          position: 'absolute',
          top: 800,
          width: split - box.left - inset * 2,
        }}
      >
        <div
          style={{
            background: ink.successBg,
            bottom: 0,
            left: -inset,
            opacity: summary,
            position: 'absolute',
            right: -inset,
            top: 0,
          }}
        />
        <span
          style={{ display: 'flex', marginRight: 20, position: 'relative' }}
        >
          <Mark at={at.summary} frame={frame} ok size={34} />
        </span>
        <span style={{ position: 'relative' }}>
          <Typed
            at={at.summary}
            perFrame={2.4}
            segments={[
              {
                color: ink.successText,
                text: 'Every state checked against Base UI.',
              },
            ]}
          />
        </span>
      </div>
      <Canvas
        at={beats(4)}
        style={{
          height: 800,
          left: split + 48,
          top: 150,
          width: box.right - split - 96,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontFamily: geist.sans,
            gap: 14,
            left: 110,
            position: 'absolute',
            top: 90,
            width: 400,
          }}
        >
          <div
            style={{
              alignItems: 'center',
              background: geist.surface,
              border: `1px solid ${geist.border}`,
              borderRadius: 12,
              color: geist.fg,
              display: 'flex',
              fontSize: 28,
              justifyContent: 'space-between',
              padding: '16px 22px',
            }}
          >
            Apple
            <span style={{ color: geist.muted, fontSize: 22 }}>▾</span>
          </div>
          <div
            style={{
              background: geist.surface,
              border: `1px solid ${geist.border}`,
              borderRadius: 14,
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: 8,
              position: 'relative',
            }}
          >
            {fruits.map((fruit) => {
              const lit = fruit === 'Banana' ? highlight : 0
              const chosen = fruit === 'Apple' ? selected : 0
              const off = fruit === 'Cherry' ? disabled : 0
              return (
                <div
                  key={fruit}
                  style={{
                    alignItems: 'center',
                    background: lit
                      ? `rgba(0, 113, 246, ${lit})`
                      : 'transparent',
                    borderRadius: 8,
                    color: lit > 0.5 ? '#fff' : geist.fg,
                    display: 'flex',
                    fontSize: 28,
                    fontWeight: 400 + chosen * 300,
                    gap: 14,
                    opacity: 1 - off * 0.5,
                    padding: '14px 18px',
                  }}
                >
                  <span
                    style={{ color: ink.green, opacity: chosen, width: 22 }}
                  >
                    ✓
                  </span>
                  {fruit}
                </div>
              )
            })}
            <Cursor
              style={{
                left: `${62 + (1 - point) * 60}%`,
                opacity: point > 0 ? 1 : 0,
                top: `${48 + (1 - point) * 70}%`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            height: 240,
            left: 40,
            position: 'absolute',
            right: 40,
            top: 520,
          }}
        >
          {steps.map((state) =>
            current === state ? (
              <StateCard
                attribute={state.attribute}
                description={state.description}
                key={state.key}
                opacity={fade(frame, state.at, 10)}
              />
            ) : null,
          )}
        </div>
      </Canvas>
    </AbsoluteFill>
  )
}

/** Reference card for a Base UI data attribute, as documented for Select.Item. */
function StateCard(props: {
  attribute: string
  description: string
  opacity: number
}) {
  return (
    <div
      style={{
        background: geist.surface,
        border: `1px solid ${geist.border}`,
        borderRadius: 16,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: sans,
        gap: 16,
        opacity: props.opacity,
        padding: '28px 34px',
        transform: `translateY(${(1 - props.opacity) * 14}px)`,
      }}
    >
      <span
        style={{
          alignItems: 'center',
          color: geist.muted,
          display: 'flex',
          fontSize: 24,
          gap: 12,
        }}
      >
        <BrandIcon color="#007FFF" name="mui" size={28} />
        Base UI · Select.Item
      </span>
      <span style={{ color: ink.blue, fontFamily: mono, fontSize: 40 }}>
        [{props.attribute}]
      </span>
      <span style={{ color: ink.label, fontSize: 24 }}>
        {props.description}
      </span>
    </div>
  )
}

export function Native() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const split = 860
  const web = spring({
    config: { damping: 16 },
    fps,
    frame: frame - nativeSteps.web,
  })
  const native = spring({
    config: { damping: 16 },
    fps,
    frame: frame - nativeSteps.native,
  })
  return (
    <AbsoluteFill>
      <Title
        index={5}
        sub="Static CSS on Web. Native style tables on iOS and Android."
        title={[
          { text: 'Same styles. ' },
          { blue: true, text: 'Web and Native' },
          { text: '.' },
        ]}
      />
      <Rule
        at={split}
        from={box.top}
        progress={useDraw(beats(3))}
        to={box.bottom}
      />
      <Panel
        at={beats(3)}
        lines={[
          { text: 'const button = style({' },
          { text: "  backgroundColor: '#0071f6'," },
          { text: "  borderRadius: '12px'," },
          { text: "  padding: '16px 32px'," },
          { text: '})' },
        ]}
        size={34}
        stagger={3}
        title="styles.ts · shared"
        top={150}
        width={split - box.left}
        x={box.left}
      />
      <Panel
        at={beats(5)}
        lines={[
          { text: '// Web' },
          { text: '<button {...button()} />' },
          { text: '' },
          { at: beats(6), text: '// iOS + Android' },
          { at: beats(6.25), text: '<Pressable {...button()} />' },
        ]}
        size={34}
        stagger={3}
        title="usage"
        top={560}
        width={split - box.left}
        x={box.left}
      />
      <Browser
        style={{
          height: 470,
          left: split + 48,
          opacity: fade(frame, beats(6), 10),
          top: 190,
          width: 560,
        }}
        url="zyzz.style"
      >
        <div
          style={{
            opacity: Math.min(1, web * 1.5),
            transform: `scale(${0.85 + web * 0.15})`,
          }}
        >
          <Button
            style={{
              background: geist.blue,
              borderColor: geist.blue,
              color: '#fff',
            }}
          >
            Save
          </Button>
        </div>
      </Browser>
      <Phone
        style={{
          height: 540,
          left: split + 650,
          opacity: fade(frame, beats(6.5), 10),
          top: 155,
          width: 250,
        }}
      >
        <div
          style={{
            opacity: Math.min(1, native * 1.5),
            transform: `scale(${0.85 + native * 0.15})`,
          }}
        >
          <Button
            style={{
              background: geist.blue,
              borderColor: geist.blue,
              color: '#fff',
            }}
          >
            Save
          </Button>
        </div>
      </Phone>
      <div
        style={{
          color: ink.label,
          display: 'flex',
          fontFamily: sans,
          fontSize: 26,
          left: split + 48,
          opacity: fade(frame, beats(8)),
          position: 'absolute',
          top: 760,
        }}
      >
        <span style={{ width: 602 }}>Web · className</span>
        <span>iOS + Android · style</span>
      </div>
    </AbsoluteFill>
  )
}

type Row = { label: string; value: number }

// Snapshot from benchmark run 34204628141 (2026-09-08), workload "1,000 Components: Repeated Styles".
const build: readonly Row[] = [
  { label: 'zyzz', value: 5.861 },
  { label: 'Tailwind', value: 7.464 },
  { label: 'vanilla-extract', value: 68.711 },
  { label: 'Panda CSS', value: 257.7 },
  { label: 'StyleX', value: 291.716 },
]

const delivery: readonly Row[] = [
  { label: 'zyzz', value: 473 },
  { label: 'StyleX', value: 844 },
  { label: 'Tailwind', value: 1276 },
  { label: 'vanilla-extract', value: 4543 },
  { label: 'Panda CSS', value: 6914 },
]

export function Bench() {
  const draw = useDraw(beats(4))
  const split = 960
  return (
    <AbsoluteFill
      style={{ fontFamily: sans, fontVariantNumeric: 'tabular-nums' }}
    >
      <Title
        extra={<Tool color="#F74C00" label="Built with Rust" name="rust" />}
        hold={3}
        index={6}
        sub="A Rust compiler, measured against Panda CSS, StyleX, Tailwind, and vanilla-extract."
        title={[
          { text: 'Fast builds. ' },
          { blue: true, text: 'Small output' },
          { text: '.' },
        ]}
      />
      <Rule at={split} from={box.top} progress={draw} to={box.bottom} />
      <Chart
        at={benchSteps.buildBars}
        format={(v) => `${v.toFixed(1)} ms`}
        rows={build}
        summary="Fastest compiled output"
        summaryAt={benchSteps.build}
        title="build time · ms"
        x={box.left}
      />
      <Chart
        at={benchSteps.deliveryBars}
        format={(v) => `${Math.round(v).toLocaleString('en-US')} B`}
        rows={delivery}
        summary="Smallest CSS + JS bundle"
        summaryAt={benchSteps.delivery}
        title="delivery · CSS + JS gzip"
        x={split}
      />
      <Footnote />
    </AbsoluteFill>
  )
}

function Chart(props: {
  at: number
  format: (value: number) => string
  rows: readonly Row[]
  summary: string
  summaryAt: number
  title: string
  x: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const max = Math.max(...props.rows.map((row) => row.value))
  const pad = 72
  const summary = fade(frame, props.summaryAt, 6)
  return (
    <div
      style={{
        left: props.x + pad,
        position: 'absolute',
        top: 150,
        width: 870 - pad * 2,
      }}
    >
      <div
        style={{
          color: ink.label,
          display: 'flex',
          fontSize: 25,
          justifyContent: 'space-between',
          opacity: fade(frame, props.at - 4),
        }}
      >
        <span>{props.title}</span>
        <span>lower is better</span>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 26,
          marginTop: 56,
        }}
      >
        {props.rows.map((row, i) => {
          const t = spring({
            config: { damping: 30 },
            durationInFrames: 34,
            fps,
            frame: frame - props.at - Math.round((i * beat) / 2),
          })
          const zyzz = i === 0
          return (
            <div
              key={row.label}
              style={{
                alignItems: 'center',
                display: 'flex',
                fontSize: 32,
                height: 54,
                opacity: Math.min(1, t * 2),
              }}
            >
              <span
                style={{
                  color: zyzz ? ink.white : ink.gray,
                  whiteSpace: 'nowrap',
                  width: 316,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  background: zyzz ? ink.blueFill : '#34363B',
                  flexShrink: 0,
                  height: 24,
                  width: Math.max(6, (row.value / max) * 220) * t,
                }}
              />
              <span
                style={{
                  color: zyzz ? ink.blue : ink.white,
                  marginLeft: 18,
                  whiteSpace: 'nowrap',
                }}
              >
                {props.format(row.value * Math.min(1, t))}
              </span>
            </div>
          )
        })}
      </div>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          fontSize: 30,
          height: 72,
          marginTop: 50,
          position: 'relative',
        }}
      >
        <div
          style={{
            background: ink.successBg,
            bottom: 0,
            left: -pad,
            opacity: summary,
            position: 'absolute',
            right: -pad,
            top: 0,
          }}
        />
        <span
          style={{ display: 'flex', marginRight: 20, position: 'relative' }}
        >
          <Mark at={props.summaryAt} frame={frame} ok size={34} />
        </span>
        <span style={{ position: 'relative' }}>
          <Typed
            at={props.summaryAt}
            perFrame={2.4}
            segments={[{ color: ink.successText, text: props.summary }]}
          />
        </span>
      </div>
      <div
        style={{
          color: ink.label,
          fontSize: 22,
          marginTop: 42,
          opacity: fade(frame, props.at + 20),
        }}
      >
        1,000 components
      </div>
    </div>
  )
}

function Footnote() {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        color: ink.label,
        fontSize: 20,
        left: box.left + 72,
        opacity: fade(frame, beats(6)),
        position: 'absolute',
        top: box.bottom + 32,
      }}
    >
      Benchmark snapshot 2026-09-08 · zyzz.style/docs/introduction/benchmarks
    </div>
  )
}

export function Prompt() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill style={{ fontFamily: sans }}>
      <Title
        index={8}
        sub="Prompt your agent to build with Zyzz."
        title={[
          { text: 'Built for ' },
          { blue: true, text: 'agents' },
          { text: '.' },
        ]}
      />
      <div style={{ left: box.left + 72, position: 'absolute', top: 300 }}>
        <div
          style={{
            color: ink.label,
            fontSize: 36,
            opacity: fade(frame, beats(3)),
          }}
        >
          agent prompt
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 500,
            letterSpacing: '-0.035em',
            lineHeight: 1.3,
            marginTop: 30,
            width: 1560,
          }}
        >
          <Typed
            at={promptSteps.quote}
            perFrame={1.5}
            segments={[
              { color: ink.white, text: '“Read ' },
              { color: ink.blue, text: 'zyzz.style' },
              {
                color: ink.white,
                text: ' and help me build my project with Zyzz.”',
              },
            ]}
          />
        </div>
      </div>
      <div
        style={{
          alignItems: 'flex-end',
          bottom: 1080 - box.bottom + 56,
          display: 'flex',
          justifyContent: 'space-between',
          left: box.left + 72,
          opacity: fade(frame, beats(8), 12),
          position: 'absolute',
          right: 1920 - box.right + 72,
        }}
      >
        <div
          style={{
            alignItems: 'flex-start',
            color: ink.gray,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 30,
            gap: 20,
          }}
        >
          <CodeBlock size={28}>
            <span style={{ color: ink.label }}>npm i </span>zyzz
          </CodeBlock>
          <div
            style={{
              alignItems: 'center',
              color: ink.white,
              display: 'flex',
              gap: 14,
            }}
          >
            <BrandIcon color={ink.white} name="github" size={34} />
            wevm/zyzz
          </div>
        </div>
        <Logo
          delay={beats(8)}
          fill={ink.white}
          stagger={beat / 4}
          width={190}
        />
      </div>
    </AbsoluteFill>
  )
}
