/** Presents small, independent examples under a selectable theme scope. @module */
'use client'
import { useEffect, useState } from 'react'
import { global } from 'zyzz/web'
import { Dynamic } from './Dynamic'
import { Motion } from './Motion'
import { Relationships } from './Relationships'
import { Styling } from './Styling'
import { appearance, style, vars } from './zyzz.config'

global({
  '@layer base': {
    body: { fontFamily: 'system-ui, sans-serif', margin: 0 },
    // The default scheme follows the system; a selected scheme class on <html> overrides it.
    html: { colorScheme: 'light dark' },
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
  export const button = style({
    ':hover': { color: 'accent' },
    '&[aria-pressed="true"]': { fontWeight: 700 },
  })

  export const section = style({
    '@layer components': {
      borderTop: '1px solid',
      borderColor: 'line',
      minWidth: '[0]',
      paddingTop: 'md',
    },
  })

  export const nested = style({
    backgroundColor: 'surface',
    border: '1px solid',
    borderColor: 'line',
    color: 'text',
    marginTop: 'sm',
    padding: 'md',
  })

  export const sample = style({ color: 'accent' })

  export const muted = style({ color: 'subtle', fontSize: '0.875rem' })

  export const row = style({
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'sm',
  })

  export const page = style({
    backgroundColor: 'surface',
    color: 'text',
    minHeight: '100vh',
    padding: 'md',
  })

  export const content = style({ marginInline: 'auto', maxWidth: '48rem' })

  export const grid = style({
    display: 'grid',
    gap: 'md',
    marginTop: 'section',
  })
}

/** The root selection lives on <html>; nested scopes inherit without a provider or listener. */
export function App() {
  // Prerendering has no document, so the applied selection is read after hydration.
  const [selection, setSelection] = useState<ReturnType<typeof appearance.get>>(
    { set: 'indigo' },
  )

  useEffect(() => setSelection(appearance.get()), [])

  function select(next: Parameters<typeof appearance.set>[0]) {
    appearance.set(next)
    setSelection(appearance.get())
  }

  return (
    <main {...styles.page()}>
      <div {...styles.content()}>
        <header>
          <h1>Zyzz examples</h1>
          <p>React + Next.js</p>
          <p {...styles.muted()}>
            <code>zyzz(nextConfig)</code> from <code>zyzz/next</code> compiles
            these modules inside the Next.js build; the root layout inlines{' '}
            <code>script()</code> so a saved selection applies before paint.
          </p>
          <div {...styles.row()}>
            <button
              {...styles.button()}
              aria-pressed={selection.set === 'indigo'}
              onClick={() => select({ set: 'indigo' })}
            >
              Indigo
            </button>
            <button
              {...styles.button()}
              aria-pressed={selection.set === 'mint'}
              onClick={() => select({ set: 'mint' })}
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
                  select({
                    set: selection.set === 'indigo' ? 'mint' : 'indigo',
                  })
                }
              >
                Parent: {selection.set}
              </button>
              <div {...vars({ set: 'mint', colorScheme: 'dark' })}>
                <div {...styles.nested()} data-testid="nested-theme">
                  <button {...styles.sample()}>Always mint + dark</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
