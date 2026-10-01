/** Renders the Themes & Tokens guide's compiled examples. @module */
import { useState } from 'react'
import { defineConfig, defineVars, extendVars } from 'zyzz'
import { style as ui, vars as defaultVars } from 'zyzz/default'

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

  export const scope = ui({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginTop: 4,
    padding: 3,
  })

  export const title = style({
    color: 'accent',
    margin: '0px !custom',
    fontSize: '1rem',
    fontWeight: 600,
    lineHeight: 1.5,
  })
}
