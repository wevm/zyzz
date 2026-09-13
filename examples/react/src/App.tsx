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
import { css, themes } from './zyzz.config.js'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    button: { cursor: 'pointer' },
    'button, input, select': { font: 'inherit' },
    'button:focus-visible, input:focus-visible, select:focus-visible, summary:focus-visible':
      {
        outline: '2px solid currentColor',
        outlineOffset: '4px',
      },
    h1: { fontSize: 'clamp(2rem, 5vw, 3.5rem)', letterSpacing: '-0.05em' },
    h2: { fontSize: '1.125rem', marginBottom: '1rem' },
    p: { lineHeight: 1.6 },
  },
})

namespace styles {
  export const button = css({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    borderRadius: '0.5rem',
    color: 'accent',
    padding: 'sm',
    px: 'md',
    ':hover': { borderColor: 'accent' },
    ':disabled': { cursor: 'not-allowed', opacity: 0.45 },
    '&[aria-pressed="true"]': { backgroundColor: 'accent', color: 'surface' },
  })

  export const card = css({
    '@layer components': {
      backgroundColor: 'surface',
      border: '1px solid',
      borderColor: 'line',
      color: 'text',
      borderRadius: 'card',
      minWidth: 0,
      padding: 'card',
    },
  })

  export const muted = css({ color: 'subtle', fontSize: '0.875rem' })

  export const row = css({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const page = css({
    backgroundColor: 'backdrop',
    color: 'text',
    minHeight: '100vh',
    padding: 'lg',
  })

  export const content = css({ marginInline: 'auto', maxWidth: '68rem' })

  export const grid = css({
    display: 'grid',
    gap: 'md',
    marginTop: 'section',
    '@media wide': { gridTemplateColumns: '1fr 1fr' },
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
            <p {...styles.muted()}>ZYZZ / REACT + VITE</p>
            <h1>Small calls. Real CSS.</h1>
            <p>
              One config, ordinary React props, and a few styles beside each
              component.
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
            <Queries />
            <Motion />
            <Stylesheets />
            <section {...themes({ theme: 'mint', colorScheme: 'dark' })}>
              <div {...styles.card()}>
                <h2>Nested theme</h2>
                <button {...styles.button()}>Always mint + dark</button>
                <p {...styles.muted()}>
                  The same styles inherit an independent scope.
                </p>
              </div>
            </section>
            <Advanced />
          </div>
        </div>
      </main>
    </div>
  )
}
