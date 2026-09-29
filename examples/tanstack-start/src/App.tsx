/** Presents small, independent examples under a selectable theme scope. @module */
import { useEffect, useState } from 'react'
import { global } from 'zyzz/web'
import { Dynamic } from './Dynamic.js'
import { Motion } from './Motion.js'
import { Relationships } from './Relationships.js'
import { Styling } from './Styling.js'
import { appearance, style, vars } from './zyzz.config.js'

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
      minWidth: '0 !custom',
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
    minHeight: '100vh !custom',
    padding: 'md',
  })

  export const content = style({
    marginInline: 'auto !custom',
    maxWidth: '48rem !custom',
  })

  export const grid = style({
    display: 'grid',
    gap: 'md',
    marginTop: 'section',
  })
}

/** The root selection lives on <html>; nested scopes inherit without a provider or listener. */
export function App() {
  // Server rendering has no document, so the applied selection is read after hydration.
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
          <p>React + TanStack Start</p>
          <p {...styles.muted()}>
            The <code>zyzz()</code> Vite plugin compiles these modules inside
            the TanStack Start build; the root route inlines{' '}
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
