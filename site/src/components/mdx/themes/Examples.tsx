/** Renders the Themes & Tokens guide's compiled examples. @module */
import { useState } from 'react'
import { defineConfig, defineVars, extendVars } from 'zyzz'
import { style as ui, vars as defaultVars } from 'zyzz/default'
import output from './Compiled.json'

const base = defineVars({
  color: {
    accent: '#2563eb',
    foreground: { light: '#171717', dark: '#fafafa' },
    surface: { light: '#ffffff', dark: '#171717' },
  },
  spacing: { page: '1.5rem' },
})
const alternate = extendVars(base, {
  color: { accent: '#9333ea' },
  spacing: { page: '2rem' },
})
const { style, vars } = defineConfig({
  defaultVars: 'base',
  vars: { base, alternate },
})
const palette = defineVars(
  { color: { palette: { ink: '#171717', paper: '#fafafa' } } },
  (values) => ({
    color: {
      foreground: {
        light: values.color.palette.ink,
        dark: values.color.palette.paper,
      },
    },
  }),
)
const bluePalette = extendVars(palette, {
  color: { palette: { ink: '#2563eb' } },
})
const { style: semanticStyle, vars: semanticVars } = defineConfig({
  defaultVars: 'base',
  vars: { base: palette, alternate: bluePalette },
})
const { style: mappedStyle, vars: mappedVars } = defineConfig({
  mappings: {
    surface: ['backgroundColor'],
    spacing: ['gap', 'padding', 'paddingLeft', 'paddingRight'],
  },
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  vars: { surface: { panel: '#fff' }, spacing: { page: '1rem' } },
})
const { style: responsiveStyle, vars: responsiveVars } = defineConfig({
  vars: {
    spacing: {
      page: {
        default: '1rem',
        '@media (min-width: 48rem)': '2rem',
        '@media (min-width: 72rem)': '3rem',
      },
    },
  },
})
const { style: queryStyle } = defineConfig({
  vars: {
    breakpoint: { tablet: '48rem' },
    container: { card: '20rem' },
    containerNames: ['preview'],
  },
})

/** Displays the bundled surface, typography, and spacing tokens. */
export function Bundled() {
  return (
    <div {...styles.example()}>
      <section {...defaultVars({ colorScheme: 'light dark' })}>
        <article {...styles.defaultCard()}>
          <h2 {...styles.defaultTitle()}>Account</h2>
          <p {...styles.defaultBody()}>Manage account preferences.</p>
        </article>
      </section>
    </div>
  )
}

/** Displays output compiled from the guide's compile.ts snippet in an isolated frame. */
export function Compiled() {
  return (
    <div {...styles.example()}>
      <iframe
        title="Standalone compiled Account text"
        {...styles.frame()}
        srcDoc={`<!doctype html><html><head><style>${output.css}</style></head><body><section class="${output.vars.base}"><article class="${output.classes.card}">Account</article></section></body></html>`}
      />
    </div>
  )
}

/** Shows the mapped background, horizontal padding, and explicit width. */
export function Mappings() {
  return (
    <div {...styles.example()}>
      <section {...mappedVars()}>
        <div {...styles.mappingTrack()}>
          <div
            aria-label="Panel with 1rem width and horizontal padding"
            {...styles.mappedPanel()}
          />
        </div>
      </section>
      <span {...styles.caption()}>1rem width + 1rem padding on each side</span>
    </div>
  )
}

/** Previews preference selections locally without changing the docs root. */
export function Preferences() {
  const [dark, setDark] = useState(false)

  return (
    <div {...styles.example()}>
      <button
        type="button"
        aria-pressed={dark}
        onClick={() => setDark(!dark)}
        {...styles.control()}
      >
        {dark ? 'Use base light colors' : 'Use alternate dark colors'}
      </button>
      <section
        {...vars({
          set: dark ? 'alternate' : 'base',
          colorScheme: dark ? 'dark' : 'light',
        })}
      >
        <Card />
      </section>
      <span {...styles.caption()}>
        This preview selects a local scope. The application code saves and
        restores the document root preference.
      </span>
    </div>
  )
}

/** Changes a named container's width to show its compiled query. */
export function Queries() {
  const [wide, setWide] = useState(false)

  return (
    <div {...styles.example()}>
      <button
        type="button"
        aria-pressed={wide}
        onClick={() => setWide(!wide)}
        {...styles.control()}
      >
        {wide ? 'Use narrow container' : 'Use wide container'}
      </button>
      <section
        {...styles.queryContainer()}
        style={{ width: wide ? '24rem' : '16rem', maxWidth: '100%' }}
      >
        <div {...styles.queryCard()}>
          <span>Account</span>
          <span>Preferences</span>
        </div>
      </section>
      <span {...styles.caption()}>
        At 20rem, the container query switches the contents to a grid.
      </span>
    </div>
  )
}

/** Lets media queries change padding as the browser width changes. */
export function Responsive() {
  return (
    <div {...styles.example()}>
      <div {...responsiveVars()}>
        <section {...styles.responsivePage()}>
          <div {...styles.inset()}>
            Resize the browser to change the surrounding padding.
          </div>
        </section>
      </div>
      <span {...styles.caption()}>
        Below 48rem: 1rem · 48rem: 2rem · 72rem: 3rem
      </span>
    </div>
  )
}

/** Compares the alternate card's light and dark scheme values. */
export function Schemes() {
  return (
    <div {...styles.example()}>
      {(['light', 'dark'] as const).map((colorScheme) => (
        <section key={colorScheme} {...vars({ set: 'alternate', colorScheme })}>
          <span {...styles.caption()}>Alternate · {colorScheme}</span>
          <Card />
        </section>
      ))}
    </div>
  )
}

/** Shows the same card inside default, alternate, and nested base scopes. */
export function Scopes() {
  return (
    <div {...styles.example()}>
      <main {...vars({ colorScheme: 'light' })}>
        <span {...styles.caption()}>Base</span>
        <Card />
        <section {...styles.scope()}>
          <div {...vars({ set: 'alternate' })}>
            <span {...styles.caption()}>Alternate</span>
            <Card />
            <section {...styles.scope()}>
              <div {...vars({ set: 'base' })}>
                <span {...styles.caption()}>Nested base</span>
                <Card />
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}

/** Shows semantic foreground references following palette overrides. */
export function Semantic() {
  return (
    <div {...styles.example()}>
      {(['light', 'dark'] as const).map((colorScheme) => (
        <div key={colorScheme} {...styles.row()}>
          {(['base', 'alternate'] as const).map((set) => (
            <section key={set} {...semanticVars({ set, colorScheme })}>
              <article
                {...styles.semanticCard()}
                style={{
                  backgroundColor: colorScheme === 'light' ? '#fff' : '#171717',
                }}
              >
                <span>
                  {set} · {colorScheme}
                </span>
                <p>Account</p>
              </article>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Shows the shared card in the default light scope. */
export function Tokens() {
  return (
    <div {...styles.example()}>
      <section {...vars({ colorScheme: 'light' })}>
        <Card />
      </section>
      <span {...styles.caption()}>Base · blue accent · 1.5rem padding</span>
    </div>
  )
}

function Card() {
  return (
    <article {...styles.card()}>
      <h2 {...styles.title()}>Account</h2>
      <p>Manage account preferences.</p>
    </article>
  )
}

namespace styles {
  export const caption = ui({
    color: 'gray.900',
    typography: 'copy.13',
    display: 'block',
    marginBottom: 2,
  })

  export const card = style({
    backgroundColor: 'surface',
    color: 'foreground',
    padding: 'page',
  })

  export const control = ui({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'foreground',
    cursor: 'pointer',
    paddingBlock: 2,
    paddingInline: 3,
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '2px',
    },
  })

  export const defaultBody = ui({ typography: 'copy.14', fontWeight: 'medium' })

  export const defaultCard = ui({
    backgroundColor: 'background.surface',
    borderRadius: 'md',
    color: 'foreground',
    padding: 6,
  })

  export const defaultTitle = ui({ typography: 'heading.24' })

  export const example = ui({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
    '& h2': { marginTop: 0 },
    '& p': { color: 'inherit !custom !important', marginBlock: 0 },
    '@media (max-width: 640px)': { padding: 4 },
  })

  export const frame = ui({
    backgroundColor: 'white !custom',
    border: '0px',
    height: 16,
    width: '100% !custom',
  })

  export const inset = ui({
    backgroundColor: 'background.primary',
    border: '1px dashed',
    borderColor: 'blue.700',
    color: 'foreground',
    padding: 3,
  })

  export const mappedPanel = mappedStyle({
    backgroundColor: 'panel',
    px: 'page',
    width: mappedVars.spacing.page,
    height: '3rem',
    boxSizing: 'content-box',
  })

  export const mappingTrack = ui({ backgroundColor: 'blue.700', padding: 3 })

  export const queryCard = queryStyle({
    '@media >=tablet': { padding: '2rem' },
    '@container preview card': { display: 'grid' },
    backgroundColor: '#eaf4ff',
    color: '#171717',
  })

  export const queryContainer = queryStyle({
    containerName: 'preview',
    containerType: 'inline-size',
  })

  export const responsivePage = responsiveStyle({
    padding: 'page',
    backgroundColor: '#dbeafe',
  })

  export const row = ui({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 3,
    '@media (max-width: 480px)': { gridTemplateColumns: '1fr' },
  })

  export const scope = ui({
    border: '1px dashed',
    borderColor: 'gray.500',
    marginTop: 4,
    padding: 3,
  })

  export const semanticCard = semanticStyle({
    color: 'foreground',
    padding: '1rem',
  })

  export const title = style({
    color: 'accent',
    marginBottom: vars.spacing.page,
  })

  export const wide = ui({ width: '24rem !custom', maxWidth: '100% !custom' })
}
