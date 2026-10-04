/** Renders the Themes & Tokens guide's compiled examples. @module */
import { useState } from 'react'
import { defineConfig, defineVars, extendVars } from 'zyzz'
import { style as ui, vars as defaultVars } from 'zyzz/default'

const base = defineVars({
  color: {
    accent: { dark: '#60a5fa', light: '#2563eb' },
    foreground: { dark: '#fafafa', light: '#171717' },
    surface: { dark: '#111111', light: '#ffffff' },
  },
  spacing: { page: '1.5rem' },
})
const alternate = extendVars(base, {
  color: { accent: { dark: '#c084fc', light: '#9333ea' } },
  spacing: { page: '2rem' },
})
const { style, vars } = defineConfig({
  id: 'themes-example',
  defaultVars: 'base',
  vars: { base, alternate },
})
/** Displays the bundled surface, typography, and spacing tokens. */
export function Bundled() {
  return (
    <div {...styles.example()}>
      <section {...defaultVars()}>
        <article {...styles.defaultCard()}>
          <h2 {...styles.defaultTitle()}>Personal account</h2>
          <p {...styles.defaultBody()}>alex@example.com</p>
          <span {...styles.defaultStatus()}>Active</span>
        </article>
      </section>
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

/** Shows the same card inside default, alternate, and nested light base scopes. */
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
              <div {...vars({ colorScheme: 'light', set: 'base' })}>
                <span {...styles.caption()}>Nested base, light</span>
                <Card />
              </div>
            </section>
          </div>
        </section>
      </main>
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
    color: '#a1a1a1 !custom',
    typography: 'copy.13',
    display: 'block',
    marginBottom: 0,
  })

  export const card = style({
    backgroundColor: 'surface',
    borderRadius: '12px',
    color: 'foreground',
    marginInline: 'auto !custom',
    maxWidth: '28rem !custom',
    padding: 'page',
    '& p': { fontSize: '0.875rem', margin: '0px !custom' },
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

  export const defaultBody = ui({ color: 'gray.900', typography: 'copy.14' })

  export const defaultCard = ui({
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    boxSizing: 'border-box',
    color: 'foreground',
    display: 'grid',
    gap: 2,
    justifyItems: 'start',
    marginInline: 'auto !custom',
    maxWidth: 'md',
    padding: 6,
    width: '100% !custom',
  })

  export const defaultStatus = ui({
    backgroundColor: 'blue.100',
    borderRadius: '9999px !custom',
    color: 'blue.900',
    paddingBlock: 1,
    paddingInline: 3,
    typography: 'label.12',
  })

  export const defaultTitle = ui({ typography: 'heading.20' })

  export const example = ui({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 6,
    backgroundColor: 'transparent !custom',
    '& section, & main': { minWidth: '0px !custom' },
    '& h2': {
      fontSize: '20px !custom !important',
      lineHeight: '28px !custom !important',
      margin: '0px !custom !important',
    },

    '& p': {
      typography: 'copy.14',
      margin: '0px !custom !important',
    },
    // Unstyled paragraphs inherit the scoped card color instead of the article's.
    '& p:not([class])': { color: 'inherit !custom !important' },
    '@media (max-width: 640px)': { padding: 4 },
  })

  export const scope = ui({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginTop: 4,
    padding: 3,
  })

  export const title = style({ color: 'accent', fontSize: '1.25rem' })
}
