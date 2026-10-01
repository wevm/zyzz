/** Renders the Themes & Tokens guide's compiled examples. @module */
import { useState } from 'react'
import { defineConfig, defineVars, extendVars } from 'zyzz'
import { style as ui, vars as defaultVars } from 'zyzz/default'

const base = defineVars({
  color: {
    accent: { light: '#2563eb', dark: '#60a5fa' },
    foreground: { light: '#171717', dark: '#fafafa' },
    surface: { light: '#ffffff', dark: '#111111' },
  },
  spacing: { page: '1.5rem' },
})
const alternate = extendVars(base, {
  color: { accent: { light: '#9333ea', dark: '#c084fc' } },
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
    <div {...themesExamplesStyles.example()}>
      <section {...defaultVars()}>
        <article {...themesExamplesStyles.defaultCard()}>
          <div {...themesExamplesStyles.details()}>
            <h2 {...themesExamplesStyles.defaultTitle()}>Account</h2>
            <p {...themesExamplesStyles.defaultBody()}>
              Manage account preferences.
            </p>
          </div>
          <div {...themesExamplesStyles.account()}>
            <div {...themesExamplesStyles.details()}>
              <strong>Personal account</strong>
              <p {...themesExamplesStyles.defaultBody()}>alex@example.com</p>
            </div>
            <span {...themesExamplesStyles.defaultStatus()}>Active</span>
          </div>
        </article>
      </section>
    </div>
  )
}

/** Previews preference selections locally without changing the docs root. */
export function Preferences() {
  const [dark, setDark] = useState(false)

  return (
    <div {...themesExamplesStyles.example()}>
      <button
        type="button"
        aria-pressed={dark}
        onClick={() => setDark(!dark)}
        {...themesExamplesStyles.control()}
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
      <span {...themesExamplesStyles.caption()}>
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
    <div {...themesExamplesStyles.example()}>
      <div
        role="group"
        aria-label="Preview color scheme"
        {...themesExamplesStyles.controls()}
      >
        {(['page', 'light', 'dark'] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={scheme === value}
            onClick={() => setScheme(value)}
            {...themesExamplesStyles.control()}
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
    <div {...themesExamplesStyles.example()}>
      <main {...vars()}>
        <span {...themesExamplesStyles.caption()}>Base</span>
        <Card />
        <section {...themesExamplesStyles.scope()}>
          <div {...vars({ set: 'alternate' })}>
            <span {...themesExamplesStyles.caption()}>Alternate</span>
            <Card />
            <section {...themesExamplesStyles.scope()}>
              <div {...vars({ set: 'base' })}>
                <span {...themesExamplesStyles.caption()}>Nested base</span>
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
    <div {...themesExamplesStyles.example()}>
      <section {...vars()}>
        <Card />
      </section>
    </div>
  )
}

function Card() {
  return (
    <article data-theme-card="" {...themesExamplesStyles.card()}>
      <h2>Account</h2>
      <p>Manage account preferences.</p>
    </article>
  )
}

namespace themesExamplesStyles {
  export const account = ui({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    borderTop: '1px solid light-dark(#e5e5e5, #2a2a2a)',
    paddingTop: 4,
    '& strong': { typography: 'label.14', fontWeight: 'medium' },
  })

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
    borderRadius: '12px',
    maxWidth: '28rem !custom',
    marginInline: 'auto !custom',
    '& h2': { color: 'accent', margin: '0px !custom', fontSize: '1.25rem' },
    '& p': { margin: '0px !custom', fontSize: '0.875rem' },
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
    opacity: 0.65,
    margin: 0,
  })

  export const defaultCard = ui({
    backgroundColor: 'background.surface',
    borderRadius: 'md',
    color: 'foreground',
    padding: 6,
    maxWidth: '28rem !custom',
    width: '100% !custom',
    boxSizing: 'border-box',
    marginInline: 'auto !custom',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    border: '1px solid',
    borderColor: 'gray.400',
  })

  export const defaultStatus = ui({
    color: 'blue.900',
    backgroundColor: 'blue.100',
    borderRadius: '999px !custom',
    paddingBlock: 1,
    paddingInline: '10px !custom',
    typography: 'label.12',
  })

  export const defaultTitle = ui({
    typography: 'heading.20',
    margin: '0px !custom !important',
  })

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

  export const details = style({
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem !custom',
  })
}
