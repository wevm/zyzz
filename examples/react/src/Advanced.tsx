/** Collects optional browser features without complicating the basic examples. @module */
import { useState } from 'react'
import {
  colorProfile,
  cssFunction,
  customMedia,
  fontFeatureValues,
  fontPaletteValues,
  importCss,
  layers,
  namespace,
  positionTry,
  property,
} from 'zyzz/web'
import { css } from './zyzz.config.js'

const double = cssFunction({
  body: { result: 'calc(var(--size) * 2)' },
  parameters: [{ name: '--size', syntax: '<length>' }],
  returns: '<length>',
})
const palette = fontPaletteValues({
  basePalette: 'light',
  fontFamily: 'Playground Color',
  overrideColors: '0 #4338ca',
})
const profile = colorProfile({ src: 'url("./srgb.icc")' })
const roomy = customMedia('(min-width: 60rem)')
const above = positionTry({ marginBottom: '0.5rem', positionArea: 'top' })

fontFeatureValues({
  families: ['Playground Mono'],
  features: { '@styleset': { alternate: 1 } },
})
importCss({ layer: 'base', url: './print.css' })
layers(['reset', 'base', 'components'])
namespace({ prefix: 'svg', uri: 'http://www.w3.org/2000/svg' })
property({
  inherits: false,
  initialValue: '0deg',
  name: '--playground-angle',
  syntax: '<angle>',
})

namespace styles {
  export const section = css({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const graphic = css({ '& svg|svg': { color: '#047857' } })

  export const profileFallback = css({ color: '#4338ca' })

  export const sample = css({
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    marginTop: 'md',
    padding: 'md',
    [roomy]: { borderStyle: 'dashed' },
  })

  export const functionValue = css({ marginLeft: double('8px') })

  export const profileColor = css({
    color: `color(${profile} 0.26 0.22 0.79)`,
  })

  export const typography = css({
    fontFamily: '"Playground Color", "Playground Mono", monospace',
    fontPalette: palette,
    fontVariantAlternates: 'styleset(alternate)',
  })

  export const anchor = css({ anchorName: '--playground-anchor' })

  export const popover = css({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    color: 'text',
    padding: 'md',
    positionAnchor: '--playground-anchor',
    positionArea: 'bottom',
    positionTryFallbacks: above,
  })

  export const rotate = css((values: { angle: `${number}deg` }) => ({
    '--playground-angle': values.angle,
    display: 'inline-block',
    transform: 'rotate(var(--playground-angle))',
  }))
}

/** Native controls exercise progressive features with usable fallback values. */
export function Advanced() {
  const [angle, setAngle] = useState(0)

  return (
    <details {...styles.section()}>
      <summary>Advanced stylesheet features</summary>
      <p {...styles.muted()}>
        Rendering follows browser and installed-font support. OpenType sets and
        palettes require a matching font. Unsupported color profiles retain a
        plain-color fallback; unsupported CSS functions leave the inset at its
        default.
      </p>
      <div {...styles.sample()}>
        <p {...styles.functionValue()}>CSS function: double an 8px inset.</p>
        <p {...styles.profileFallback()}>
          <span {...styles.profileColor()}>
            ICC color profile with a plain-color fallback.
          </span>
        </p>
        <p {...styles.typography()}>
          Named font palette and OpenType feature set.
        </p>
        <span {...styles.graphic()}>
          <svg
            data-example="namespace"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Namespace styled circle"
          >
            <circle cx="12" cy="12" r="10" fill="currentColor" />
          </svg>
        </span>
        <p>A custom media query makes this border dashed on wide screens.</p>
      </div>
      <p>
        <button {...styles.anchor()} popoverTarget="anchor-preview">
          Open anchored popover
        </button>
      </p>
      <div {...styles.popover()} id="anchor-preview" popover="auto">
        Below the button, with a named fallback above.
      </div>
      <label {...styles.row()}>
        Registered angle{' '}
        <input
          aria-label="Registered angle"
          type="range"
          min="0"
          max="180"
          value={angle}
          onChange={(event) => setAngle(Number(event.target.value))}
        />
        <span {...styles.rotate({ angle: `${angle}deg` })}>↑</span>
      </label>
    </details>
  )
}
