/** Renders the Themes & Tokens guide's compiled examples. @module */
import { useState } from 'react'
import { defineConfig, defineVars, extendVars } from 'zyzz'
import { style as ui, vars as defaultVars } from 'zyzz/default'
import output from './Compiled.json'

const base = defineVars({
  color: {
    accent: { light: '#2563eb', dark: '#60a5fa' },
    foreground: { light: '#171717', dark: '#fafafa' },
    surface: { light: '#ffffff', dark: '#171717' },
  },
  spacing: { page: '1.5rem' },
})
const alternate = extendVars(base, {
  color: { accent: { light: '#9333ea', dark: '#c084fc' } },
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
  vars: {
    surface: { panel: { light: '#fff', dark: '#171717' } },
    spacing: { page: '1rem' },
  },
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
      <section {...defaultVars()}>
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
        srcDoc={`<!doctype html><html><head><style>:root{color-scheme:light dark}body{font-family:system-ui;margin:0;padding:24px;background:light-dark(#fff,#171717)}article{font-size:16px;font-weight:600}${output.css}</style></head><body><section class="${output.vars.base}"><article class="${output.classes.card}">Account</article></section></body></html>`}
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
        {dark ? 'Use page colors' : 'Use alternate dark colors'}
      </button>
      <section
        {...vars({
          set: dark ? 'alternate' : 'base',
          colorScheme: dark ? 'dark' : undefined,
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
  const [scheme, setScheme] = useState<'page' | 'light' | 'dark'>('page')

  return (
    <div {...styles.example()}>
      <div
        role="group"
        aria-label="Preview color scheme"
        {...styles.controls()}
      >
        {(['page', 'light', 'dark'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={scheme === value}
            onClick={() => setScheme(value)}
            {...styles.control()}
          >
            {value === 'page'
              ? 'Page scheme'
              : value === 'light'
                ? 'Light'
                : 'Dark'}
          </button>
        ))}
      </div>
      <section
        {...vars({
          set: 'alternate',
          colorScheme: scheme === 'page' ? undefined : scheme,
        })}
      >
        <Card />
      </section>
    </div>
  )
}

/** Shows the same card inside default, alternate, and nested base scopes. */
export function Scopes() {
  return (
    <div {...styles.example()}>
      <main {...vars()}>
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
      <div {...styles.row()}>
        {(['base', 'alternate'] as const).map((set) => (
          <section key={set} {...semanticVars({ set })}>
            <article {...styles.semanticCard()}>
              <span {...styles.caption()}>{set}</span>
              <p>Account</p>
            </article>
          </section>
        ))}
      </div>
      <span {...styles.caption()}>
        The alternate palette changes the light foreground. Both sets share the
        dark foreground.
      </span>
    </div>
  )
}

/** Shows the shared card in the default scope. */
export function Tokens() {
  return (
    <div {...styles.example()}>
      <section {...vars()}>
        <Card />
      </section>
      <span {...styles.caption()}>Base · blue accent · 1.5rem padding</span>
    </div>
  )
}

function Card() {
  return (
    <article data-theme-card="" {...styles.card()}>
      <h2 {...styles.title()}>Account</h2>
      <p>Manage account preferences.</p>
    </article>
  )
}

namespace styles {
  export const caption = ui({
    color: '#a1a1a1 !custom',
    typography: 'copy.13',
    display: 'block',
    marginBottom: 0,
  })

  export const card = style({
    backgroundColor: 'surface',
    color: 'foreground',
    padding: 'page',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem !custom',
    '& p': { margin: '0px !custom' },
    borderRadius: '10px',
    border: '1px solid light-dark(#e5e5e5, #333)',
  })

  export const control = ui({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'foreground',
    cursor: 'pointer',
    typography: 'label.13',
    '&[aria-pressed="true"]': {
      backgroundColor: 'gray.200',
      borderColor: 'gray.700',
    },
    paddingBlock: 2,
    paddingInline: 3,
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '2px',
    },
  })

  export const controls = ui({ display: 'flex', flexWrap: 'wrap', gap: 2 })

  export const defaultBody = ui({
    typography: 'copy.14',
    fontWeight: 'medium',
    margin: 0,
  })

  export const defaultCard = ui({
    backgroundColor: 'background.surface',
    borderRadius: 'md',
    color: 'foreground',
    padding: 6,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    border: '1px solid',
    borderColor: 'gray.400',
  })

  export const defaultTitle = ui({
    typography: 'heading.24',
    margin: '0px !custom !important',
  })

  export const example = ui({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
    backgroundColor: 'transparent !custom',
    '& section, & main': { minWidth: '0px !custom' },
    '& [data-theme-card] h2': {
      fontSize: '16px !custom !important',
      lineHeight: '24px !custom !important',
      margin: '0px !custom !important',
    },

    '& p': {
      color: 'inherit !custom !important',
      typography: 'copy.14',
      margin: '0px !custom !important',
    },
    '@media (max-width: 640px)': { padding: 4 },
  })

  export const frame = ui({
    backgroundColor: 'background.primary',
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

  export const mappingTrack = ui({
    backgroundColor: 'blue.100',
    borderRadius: 'md',
    border: '1px solid',
    borderColor: 'blue.400',
    padding: 4,
  })

  export const queryCard = queryStyle({
    '@media >=tablet': { padding: '2rem' },
    '@container preview card': { display: 'grid' },
    backgroundColor: 'light-dark(#fff, #171717)',
    color: 'light-dark(#171717, #fafafa)',
    border: '1px solid light-dark(#e5e5e5, #333)',
    borderRadius: '10px',
    padding: '1rem',
    gap: '0.75rem',
  })

  export const queryContainer = queryStyle({
    containerName: 'preview',
    containerType: 'inline-size',
  })

  export const responsivePage = responsiveStyle({
    padding: 'page',
    backgroundColor: 'light-dark(#eff6ff, #10223d)',
    borderRadius: '10px',
    border: '1px solid light-dark(#bfdbfe, #254773)',
  })

  export const row = ui({
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 3,
    '@media (max-width: 480px)': { gridTemplateColumns: '1fr' },
  })

  export const scope = ui({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginTop: 4,
    padding: 3,
  })

  export const semanticCard = semanticStyle({
    color: 'foreground',
    padding: '1.5rem',
    backgroundColor: 'light-dark(#fff, #171717) !custom',
    border: '1px solid light-dark(#e5e5e5, #333)',
    borderRadius: '10px',
    '& p': { fontSize: '1.125rem', fontWeight: 600 },
  })

  export const title = style({
    color: 'accent',
    margin: '0px !custom',
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  })
}
