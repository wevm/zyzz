/** Presents small, independent examples under a selectable theme scope. @module */
import { useState } from 'react'
import { Advanced } from './Advanced.js'
import { Dynamic } from './Dynamic.js'
import { Motion } from './Motion.js'
import { Queries } from './Queries.js'
import { Relationships } from './Relationships.js'
import { styles as shared } from './Styles.js'
import { Stylesheets } from './Stylesheets.js'
import { Styling } from './Styling.js'
import { css, themes } from './zyzz.config.js'

namespace styles {
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
            <p {...shared.muted()}>ZYZZ / REACT + VITE</p>
            <h1>Small calls. Real CSS.</h1>
            <p>
              One config, ordinary React props, and a few styles beside each
              component.
            </p>
            <div {...shared.row()}>
              <button
                {...shared.button()}
                aria-pressed={appearance === 'indigo'}
                onClick={() => setAppearance('indigo')}
              >
                Indigo
              </button>
              <button
                {...shared.button()}
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
              <div {...shared.card()}>
                <h2>Nested theme</h2>
                <button {...shared.button()}>Always mint + dark</button>
                <p {...shared.muted()}>
                  The same imported styles inherit an independent scope.
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
