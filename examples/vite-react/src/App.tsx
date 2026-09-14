/** Presents small, independent examples under a selectable theme scope. @module */
import { useState } from 'react'
import { global } from 'zyzz/web'
import { Advanced } from './Advanced.js'
import { Dynamic } from './Dynamic.js'
import { Motion } from './Motion.js'
import { Queries } from './Queries.js'
import { Relationships } from './Relationships.js'
import { Stylesheets } from './Stylesheets.js'
import { Styling } from './Styling.js'
import { appearance, css, themes } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    // The default scheme follows the system; a selected scheme class on <html> overrides it.
    html: { colorScheme: 'light dark' },
    button: { cursor: 'pointer' },
    'button, input, select': { font: 'inherit' },
    'button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible':
      {
        outline: '2px solid currentColor',
        outlineOffset: '4px',
      },
    h1: { fontSize: '1.5rem' },
    h2: { fontSize: '1.125rem', marginBottom: '1rem' },
    p: { lineHeight: 1.5 },
  },
})

namespace styles {
  export const button = css({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = css({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: 0,
      paddingTop: 'md',
    },
  })

  export const nested = css({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    color: 'text',
    marginTop: 'sm',
    padding: 'md',
  })

  export const sample = css({ color: 'accent' })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const page = css({
    backgroundColor: 'surface',
    color: 'text',
    minHeight: '100vh',
    padding: 'md',
  })

  export const content = css({ marginInline: 'auto', maxWidth: '48rem' })

  export const grid = css({
    display: 'grid',
    gap: 'md',
    marginTop: 'section',
  })
}

/** The root selection lives on <html>; nested scopes inherit without a provider or listener. */
export function App() {
  const [selection, setSelection] = useState(appearance.get)

  function select(next: Parameters<typeof appearance.set>[0]) {
    appearance.set(next)
    setSelection(appearance.get())
  }

  return (
    <main {...styles.page()}>
      <div {...styles.content()}>
        <header>
          <h1>Zyzz examples</h1>
          <p>React + Vite</p>
          <div {...styles.row()}>
            <button
              {...styles.button()}
              aria-pressed={selection.theme === 'indigo'}
              onClick={() => select({ theme: 'indigo' })}
            >
              Indigo
            </button>
            <button
              {...styles.button()}
              aria-pressed={selection.theme === 'mint'}
              onClick={() => select({ theme: 'mint' })}
            >
              Mint
            </button>
            <label>
              Color scheme{' '}
              <select
                aria-label="Color scheme"
                value={selection.colorScheme ?? 'light dark'}
                onChange={(event) => {
                  const value = event.target.value
                  if (
                    value === 'light' ||
                    value === 'dark' ||
                    value === 'light dark'
                  )
                    select({ colorScheme: value })
                }}
              >
                <option value="light dark">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </div>
        </header>
        <div {...styles.grid()}>
          <Styling />
          <Dynamic />
          <Relationships />
          <Queries />
          <Motion />
          <Stylesheets />
          <section {...styles.section()}>
            <h2>Nested theme</h2>
            <p {...styles.muted()}>
              Tap the parent button. The nested theme stays mint and dark.
            </p>
            <div {...styles.nested()} data-testid="parent-theme">
              <button
                {...styles.sample()}
                onClick={() =>
                  select({
                    theme: selection.theme === 'indigo' ? 'mint' : 'indigo',
                  })
                }
              >
                Parent: {selection.theme}
              </button>
              <div {...themes({ theme: 'mint', colorScheme: 'dark' })}>
                <div {...styles.nested()} data-testid="nested-theme">
                  <button {...styles.sample()}>Always mint + dark</button>
                </div>
              </div>
            </div>
          </section>
          <Advanced />
        </div>
      </div>
    </main>
  )
}
