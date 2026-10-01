/** Renders working UI examples for each concept using compiled Zyzz styles. @module */
import { type ReactNode, useState } from 'react'
import { cx, defineConfig, defineVars, extendVars, style, variants } from 'zyzz'
import { style as ui } from 'zyzz/default'
import { global } from 'zyzz/web'
import InfoIcon from '~icons/lucide/info'

const base = defineVars({
  color: {
    accent: { dark: '#8cf', light: '#0066cc' },
    surface: { dark: '#111', light: '#fff' },
  },
  spacing: { md: '1rem' },
})
const alternate = extendVars(base, {
  color: { accent: { dark: '#d8b4fe', light: '#9333ea' } },
})
const { style: scopedStyle, vars } = defineConfig({
  id: 'concepts-example',
  defaultVars: 'base',
  vars: { base, alternate },
})
const { style: layeredStyle } = defineConfig({
  layers: ['concept-base', 'concept-components'],
})

global({
  '@layer concept-base': { '[data-concept-layer]': { borderRadius: '8px' } },
})

/** Renders a documented capability limit as an accessible note. */
export function Note(props: Note.Props) {
  return (
    <aside
      aria-label="Note"
      data-concept-note=""
      {...conceptsExamplesStyles.note()}
    >
      <InfoIcon
        aria-hidden="true"
        width="14"
        height="14"
        {...conceptsExamplesStyles.noteIcon()}
      />
      <div>{props.children}</div>
    </aside>
  )
}

export declare namespace Note {
  /** Properties for a concepts note. */
  type Props = {
    /** The capability limit and any supporting links. */
    children: ReactNode
  }
}

/** A static card applies two compiled style definitions to ordinary elements. */
export function Card() {
  return (
    <div data-concept-example="card" {...conceptsExamplesStyles.example()}>
      <section {...conceptsExamplesStyles.card()}>
        <h3 {...conceptsExamplesStyles.title()}>Account</h3>
        <span {...conceptsExamplesStyles.muted()}>
          A styled section and heading.
        </span>
      </section>
    </div>
  )
}

/** Shows configured token names resolving to shared color and spacing values. */
export function Tokens() {
  return (
    <div data-concept-example="tokens" {...conceptsExamplesStyles.example()}>
      <section
        {...cx(
          conceptsExamplesStyles.card(),
          conceptsExamplesStyles.scopedCard(),
        )}
      >
        <h3 {...conceptsExamplesStyles.title()}>Account</h3>
        <span>Accent color and 1rem padding from the config.</span>
      </section>
      <code {...conceptsExamplesStyles.annotation()}>
        color: 'accent' · padding: 'md'
      </code>
    </div>
  )
}

/** Switches the inherited variable set while the card definitions stay unchanged. */
export function Scopes() {
  const [set, setSet] = useState<'alternate' | 'base'>('base')

  return (
    <div data-concept-example="scopes" {...conceptsExamplesStyles.example()}>
      <div
        role="group"
        aria-label="Variable set"
        {...conceptsExamplesStyles.controls()}
      >
        {(['base', 'alternate'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={set === value}
            onClick={() => setSet(value)}
            {...conceptsExamplesStyles.control()}
          >
            {value}
          </button>
        ))}
      </div>
      <section {...cx(conceptsExamplesStyles.scope(), vars({ set }))}>
        <div
          {...cx(
            conceptsExamplesStyles.card(),
            conceptsExamplesStyles.scopedCard(),
          )}
        >
          Outer card
        </div>
        <section {...cx(conceptsExamplesStyles.scope(), vars({ set: 'base' }))}>
          <div
            {...cx(
              conceptsExamplesStyles.card(),
              conceptsExamplesStyles.scopedCard(),
            )}
          >
            Nested base card
          </div>
        </section>
      </section>
      <code {...conceptsExamplesStyles.annotation()}>
        vars({'{'} set: '{set}' {'}'})
      </code>
    </div>
  )
}

/** Compares a base style with a composed padding override. */
export function Composition() {
  return (
    <div
      data-concept-example="composition"
      {...conceptsExamplesStyles.example()}
    >
      <div {...conceptsExamplesStyles.controls()}>
        <button type="button" {...conceptsExamplesStyles.button()}>
          Base
        </button>
        <button
          type="button"
          {...cx(
            conceptsExamplesStyles.button(),
            conceptsExamplesStyles.compact(),
          )}
        >
          Compact
        </button>
      </div>
      <span {...conceptsExamplesStyles.muted()}>
        The second button replaces 1rem padding with 0.5rem.
      </span>
    </div>
  )
}

/** Selects finite recipe choices and binds a slider value to a compiled rule. */
export function Values() {
  const [size, setSize] = useState<'md' | 'sm'>('sm')
  const [width, setWidth] = useState(50)

  return (
    <div data-concept-example="values" {...conceptsExamplesStyles.example()}>
      <div
        role="group"
        aria-label="Button size"
        {...conceptsExamplesStyles.controls()}
      >
        {(['sm', 'md'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={size === value}
            onClick={() => setSize(value)}
            {...conceptsExamplesStyles.control()}
          >
            {value}
          </button>
        ))}
      </div>
      <button type="button" {...conceptsExamplesStyles.recipe({ size })}>
        Save
      </button>
      <label {...conceptsExamplesStyles.slider()}>
        Bar width: {width}%
        <input
          type="range"
          min="10"
          max="100"
          value={width}
          onChange={(event) => setWidth(Number(event.currentTarget.value))}
        />
      </label>
      <div {...conceptsExamplesStyles.track()}>
        <div {...conceptsExamplesStyles.bar({ width: `${width}%` })} />
      </div>
    </div>
  )
}

/** Lets the browser apply hover conditions and an ancestor relationship. */
export function Conditions() {
  return (
    <div
      data-concept-example="conditions"
      {...conceptsExamplesStyles.example()}
    >
      <button type="button" {...conceptsExamplesStyles.hoverButton()}>
        Hover or focus this button
      </button>
      <section tabIndex={0} {...conceptsExamplesStyles.relationship()}>
        <span {...conceptsExamplesStyles.label()}>
          Hover or focus this card
        </span>
      </section>
      <span {...conceptsExamplesStyles.muted()}>
        The button dims. The card's label turns blue.
      </span>
    </div>
  )
}

/** Shows a global base layer and a later component layer styling one element. */
export function Layers() {
  return (
    <div data-concept-example="layers" {...conceptsExamplesStyles.example()}>
      <div {...conceptsExamplesStyles.layerRow()}>
        <code>concept-base</code>
        <span>color: gray</span>
      </div>
      <div {...conceptsExamplesStyles.layerRow()}>
        <code>concept-components</code>
        <span>color: blue</span>
      </div>
      <section data-concept-layer="" {...conceptsExamplesStyles.layeredCard()}>
        The component layer wins.
      </section>
      <span {...conceptsExamplesStyles.muted()}>
        The base stylesheet still supplies the rounded corners.
      </span>
    </div>
  )
}

/** Shows the browser result and native output as distinct compilation targets. */
export function Platforms() {
  return (
    <div data-concept-example="platforms" {...conceptsExamplesStyles.example()}>
      <span {...conceptsExamplesStyles.muted()}>
        Web output: CSS applied to an HTML element
      </span>
      <button type="button" {...conceptsExamplesStyles.button()}>
        Save
      </button>
      <span {...conceptsExamplesStyles.muted()}>
        Native output: style tables applied to native elements
      </span>
      <code {...conceptsExamplesStyles.annotation()}>Pressable + Text</code>
      <span {...conceptsExamplesStyles.muted()}>
        Native output is described here, not rendered in this browser.
      </span>
    </div>
  )
}

namespace conceptsExamplesStyles {
  export const annotation = ui({
    typography: 'copy.13.mono',
    color: 'gray.900',
    overflowWrap: 'anywhere',
  })

  export const bar = style((values: { width: `${number}%` }) => ({
    backgroundColor: '#0066cc',
    borderRadius: '4px',
    height: '12px',
    width: values.width,
  }))

  export const button = style({
    backgroundColor: '#0066cc',
    border: '0px',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    padding: '1rem',
    ':focus-visible': { outline: '2px solid #0066cc', outlineOffset: '3px' },
  })

  export const card = ui({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    padding: 4,
  })

  export const compact = style({ padding: '0.5rem' })

  export const control = ui({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'foreground',
    cursor: 'pointer',
    paddingBlock: 2,
    paddingInline: 3,
    '&[aria-pressed="true"]': {
      backgroundColor: 'blue.100',
      borderColor: 'blue.700',
      color: 'blue.900',
    },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '2px',
    },
  })

  export const controls = ui({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 3,
  })

  export const example = ui({
    backgroundColor: 'gray.100',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    marginBlock: 6,
    padding: 6,
    '&[data-concept-example] section': { width: '100% !custom' },
    '&[data-concept-example] h3': { margin: 0 },
    '@media (max-width: 640px)': { padding: 4 },
  })

  export const hoverButton = style({
    backgroundColor: '#0066cc',
    border: '0px',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    padding: '1rem',
    ':hover': { '@media (hover: hover)': { opacity: 0.6 } },
    ':focus-visible': { opacity: 0.6 },
  })

  export const layeredCard = layeredStyle({
    '@layer concept-base': { color: 'gray', padding: '1rem' },
    '@layer concept-components': {
      backgroundColor: '#eaf4ff',
      color: '#0066cc',
    },
  })

  export const layerRow = ui({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    color: 'gray.900',
    typography: 'copy.14',
  })

  export const muted = ui({ color: 'gray.900', typography: 'copy.14' })

  export const note = ui({
    alignItems: 'flex-start',
    backgroundColor: 'blue.100',
    border: '1px solid',
    borderColor: 'blue.400',
    borderRadius: 'md',
    color: 'blue.900',
    display: 'flex',
    gap: 3,
    typography: 'copy.14',
    paddingBlock: 4,
    paddingInline: 5,
    '&[data-concept-note] blockquote': { margin: 0 },
    '&[data-concept-note] blockquote > p:first-child': { display: 'none' },
    '&[data-concept-note] p': {
      margin: 0,
      color: 'blue.900',
      typography: 'copy.14',
    },
  })

  export const noteIcon = ui({
    color: 'blue.900',
    flexShrink: 0,
    marginTop: '3px !custom',
  })

  export const recipe = variants({
    base: {
      backgroundColor: '#0066cc',
      border: '0px',
      borderRadius: '6px',
      color: 'white',
    },
    variants: { size: { md: { padding: '1rem' }, sm: { padding: '0.5rem' } } },
  })

  export const relationship = ui({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    padding: 4,
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '2px',
    },
  })

  export const label = ui({
    selectors: {
      [`${relationship}:hover &`]: { color: 'blue.900' },
      [`${relationship}:focus-visible &`]: { color: 'blue.900' },
    },
  })

  export const scope = ui({
    border: '1px dashed',
    borderColor: 'gray.500',
    borderRadius: 'md',
    display: 'grid',
    gap: 4,
    padding: 4,
  })

  export const scopedCard = scopedStyle({
    backgroundColor: 'surface',
    color: 'accent',
    padding: 'md',
  })

  export const slider = ui({
    color: 'gray.900',
    display: 'grid',
    gap: 2,
    typography: 'copy.14',
    width: '100% !custom',
    '& input': { accentColor: 'blue.700' },
  })

  export const title = ui({ typography: 'heading.20', color: 'foreground' })

  export const track = ui({
    backgroundColor: 'gray.300',
    borderRadius: 'sm',
    width: '100% !custom',
  })
}
