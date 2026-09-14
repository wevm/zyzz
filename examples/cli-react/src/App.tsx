/** Presents small, independent examples under a selectable theme scope. @module */
import { useState } from 'react'
import { global } from 'zyzz/web'
import { Dynamic } from './Dynamic.js'
import { Motion } from './Motion.js'
import { Relationships } from './Relationships.js'
import { Styling } from './Styling.js'
import { css, themes } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    button: { cursor: 'pointer' },
    'button, input, select': { font: 'inherit' },
    'button:focus-visible, input:focus-visible, select:focus-visible': {
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

/** Theme changes inherit naturally without a provider or preference listener. */
export function App() {
  const [appearance, setAppearance] = useState<'indigo' | 'mint'>('indigo')
  const [scheme, setScheme] = useState<'light' | 'dark' | 'light dark'>(
    'light dark',
  )

  return (
    <div {...themes({ theme: appearance, colorScheme: scheme })}>
      <main {...styles.page()}>
        <div {...styles.content()}>
          <header>
            <h1>Zyzz examples</h1>
            <p>React + Zyzz CLI</p>
            <p {...styles.muted()}>
              The <code>zyzz</code> command compiled this source tree into{' '}
              <code>.zyzz</code>; Vite bundles the compiled modules and their
              stylesheets without a Zyzz plugin.
            </p>
            <div {...styles.row()}>
              <button
                {...styles.button()}
                aria-pressed={appearance === 'indigo'}
                onClick={() => setAppearance('indigo')}
              >
                Indigo
              </button>
              <button
                {...styles.button()}
                aria-pressed={appearance === 'mint'}
                onClick={() => setAppearance('mint')}
              >
                Mint
              </button>
              <label>
                Color scheme{' '}
                <select
                  aria-label="Color scheme"
                  value={scheme}
                  onChange={(event) => {
                    const value = event.target.value
                    if (
                      value === 'light' ||
                      value === 'dark' ||
                      value === 'light dark'
                    )
                      setScheme(value)
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
            <Motion />
            <section {...styles.section()}>
              <h2>Nested theme</h2>
              <p {...styles.muted()}>
                Tap the parent button. The nested theme stays mint and dark.
              </p>
              <div {...styles.nested()} data-testid="parent-theme">
                <button
                  {...styles.sample()}
                  onClick={() =>
                    setAppearance(appearance === 'indigo' ? 'mint' : 'indigo')
                  }
                >
                  Parent: {appearance}
                </button>
                <div {...themes({ theme: 'mint', colorScheme: 'dark' })}>
                  <div {...styles.nested()} data-testid="nested-theme">
                    <button {...styles.sample()}>Always mint + dark</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
