/** Renders the landing page and introductory styling example. @module */
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { style } from 'zyzz/default'

/** Renders the landing page. */
export const Route = createFileRoute('/')({
  // Keep the style namespace with the component; the route splitter drops it.
  codeSplitGroupings: [],
  component: Index,
})

const docsUrl =
  'https://github.com/wevm/zyzz/blob/main/docs/introduction/getting-started.md'
const example = `import { Config } from 'zyzz'

const { style } = Config.create({
  vars: {
    color: {
      brand: '#0072f5',
      white: '#fff',
    },
    spacing: {
      sm: '8px',
      md: '16px',
    },
  },
})

namespace styles {
  export const button = style({
    backgroundColor: 'brand',
    borderRadius: '8px',
    color: 'white',
    paddingBlock: 'sm',
    paddingInline: 'md',
  })
}

const Button = (
  <button {...styles.button()}>Get started</button>
)`
const installCommands = {
  npm: 'npm install zyzz',
  pnpm: 'pnpm add zyzz',
  bun: 'bun add zyzz',
} as const

function Index() {
  const [manager, setManager] = useState<keyof typeof installCommands>('npm')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )

  return (
    <div {...styles.page()}>
      <header {...styles.header()}>
        <a aria-label="Zyzz home" href="/" {...styles.brand()}>
          zyzz
        </a>
        <a href="https://wevm.dev" {...styles.byline()}>
          by Wevm
        </a>
        <a href={docsUrl} {...styles.headerLink()}>
          Docs <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main {...styles.main()}>
        <section aria-labelledby="heading" {...styles.intro()}>
          <h1 id="heading" {...styles.heading()}>
            Style with
            <br />
            TypeScript.
          </h1>
          <p {...styles.description()}>
            Write type-safe styles, variables, and themes. Compile to static
            CSS. Keep your styles close to your code.
          </p>
          <div {...styles.actions()}>
            <a href={docsUrl} {...styles.primaryLink()}>
              Read the docs <span aria-hidden="true">↗</span>
            </a>
            <a href="https://github.com/wevm/zyzz" {...styles.secondaryLink()}>
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div {...styles.install()}>
            <div
              aria-label="Package manager"
              role="group"
              {...styles.installHeader()}
            >
              {(
                Object.keys(installCommands) as (keyof typeof installCommands)[]
              ).map((value) => (
                <button
                  aria-pressed={manager === value}
                  key={value}
                  onClick={() => {
                    setManager(value)
                    setCopyState('idle')
                  }}
                  type="button"
                  {...styles.manager()}
                >
                  {value}
                </button>
              ))}
            </div>
            <div {...styles.commandRow()}>
              <code {...styles.command()}>{installCommands[manager]}</code>
              <button
                aria-label="Copy install command"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      installCommands[manager],
                    )
                    setCopyState('copied')
                  } catch {
                    setCopyState('failed')
                  }
                }}
                type="button"
                {...styles.copy()}
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <rect
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="14"
                    x="8"
                    y="8"
                  />
                  <path
                    d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
            </div>
          </div>
          <p aria-live="polite" {...styles.copyStatus()}>
            {copyState === 'copied' && 'Copied to clipboard.'}
            {copyState === 'failed' &&
              'Could not copy. Select the command to copy it manually.'}
          </p>
        </section>
        <section aria-label="Zyzz code example" {...styles.example()}>
          <div {...styles.exampleHeader()}>
            <span {...styles.fileMarker()} aria-hidden="true" />
            index.tsx
          </div>
          <pre tabIndex={0} {...styles.code()}>
            <code>{example}</code>
          </pre>
        </section>
      </main>
    </div>
  )
}

namespace styles {
  export const actions = style({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginTop: '36px',
  })
  export const brand = style({
    color: '#fafafa',
    fontSize: '40px',
    fontWeight: 800,
    letterSpacing: '-2px',
    lineHeight: 1,
    textDecoration: 'none',
  })
  export const byline = style({
    color: '#888',
    fontSize: '16px',
    marginLeft: '20px',
    textDecoration: 'none',
    ':hover': { color: '#ddd' },
  })
  export const code = style({
    color: '#d4d4d4',
    fontFamily: 'mono',
    fontSize: '13px',
    lineHeight: 1.8,
    margin: 0,
    overflowX: 'auto',
    padding: '28px 30px 32px',
    tabSize: 2,
    ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '-2px' },
    '@media (max-width: 600px)': { fontSize: '12px', padding: '22px 20px' },
  })
  export const command = style({
    color: '#d4d4d4',
    fontFamily: 'mono',
    fontSize: '15px',
  })
  export const commandRow = style({
    alignItems: 'center',
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
    padding: '20px 22px',
  })
  export const copy = style({
    alignItems: 'center',
    borderRadius: '4px',
    color: '#999',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '32px',
    minWidth: '32px',
    ':hover': { color: '#fff' },
    ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '3px' },
  })
  export const copyStatus = style({
    color: '#a3a3a3',
    fontSize: '13px',
    minHeight: '24px',
    paddingTop: '8px',
  })
  export const description = style({
    color: '#a3a3a3',
    fontSize: '20px',
    lineHeight: 1.7,
    marginTop: '28px',
    maxWidth: '440px',
  })
  export const example = style({
    alignSelf: 'center',
    backgroundColor: '#0d0d0d',
    border: '1px solid #262626',
    borderRadius: '10px',
    minWidth: 0,
    overflow: 'hidden',
  })
  export const exampleHeader = style({
    alignItems: 'center',
    borderBottom: '1px solid #222',
    color: '#eee',
    display: 'flex',
    fontSize: '14px',
    fontWeight: 500,
    gap: '12px',
    padding: '20px 30px',
  })
  export const fileMarker = style({
    backgroundColor: '#b3c7ff',
    borderRadius: '2px',
    height: '16px',
    transform: 'rotate(-15deg)',
    width: '4px',
  })
  export const header = style({
    alignItems: 'center',
    display: 'flex',
    margin: '0 auto',
    maxWidth: '1320px',
    padding: '42px 48px',
    '@media (max-width: 600px)': { padding: '28px 24px' },
  })
  export const headerLink = style({
    color: '#a3a3a3',
    fontSize: '16px',
    marginLeft: 'auto',
    textDecoration: 'none',
    ':hover': { color: '#fff' },
  })
  export const heading = style({
    fontSize: 'clamp(48px, 5.2vw, 76px)',
    fontWeight: 650,
    letterSpacing: '-0.055em',
    lineHeight: 1.06,
  })
  export const install = style({
    backgroundColor: '#181818',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    marginTop: '40px',
    maxWidth: '440px',
    overflow: 'hidden',
  })
  export const installHeader = style({
    borderBottom: '1px solid #2a2a2a',
    display: 'flex',
    gap: '8px',
    paddingInline: '12px',
  })
  export const intro = style({
    alignSelf: 'center',
    minWidth: 0,
    paddingBlock: '32px',
  })
  export const main = style({
    display: 'grid',
    gap: 'clamp(40px, 6vw, 88px)',
    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    margin: '0 auto',
    maxWidth: '1320px',
    padding: '44px 48px 80px',
    '@media (max-width: 900px)': {
      gap: '28px',
      gridTemplateColumns: 'minmax(0, 1fr)',
      maxWidth: '720px',
      paddingTop: '12px',
    },
    '@media (max-width: 600px)': { padding: '12px 24px 40px' },
  })
  export const manager = style({
    borderBottom: '2px solid transparent',
    color: '#999',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '13px 12px',
    '&[aria-pressed="true"]': { borderBottomColor: '#eee', color: '#eee' },
    ':hover': { color: '#fff' },
    ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '-4px' },
  })
  export const page = style({
    backgroundColor: '#121212',
    color: '#fafafa',
    minHeight: '100svh',
  })
  export const primaryLink = style({
    alignItems: 'center',
    backgroundColor: '#fafafa',
    border: '1px solid #fafafa',
    borderRadius: '7px',
    color: '#111',
    display: 'inline-flex',
    fontSize: '15px',
    fontWeight: 600,
    gap: '24px',
    padding: '15px 22px',
    textDecoration: 'none',
    ':hover': { backgroundColor: '#ddd' },
    ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '4px' },
  })
  export const secondaryLink = style({
    alignItems: 'center',
    backgroundColor: '#191919',
    border: '1px solid #303030',
    borderRadius: '7px',
    color: '#eee',
    display: 'inline-flex',
    fontSize: '15px',
    fontWeight: 500,
    gap: '24px',
    padding: '15px 22px',
    textDecoration: 'none',
    ':hover': { backgroundColor: '#252525' },
    ':focus-visible': { outline: '2px solid #b3c7ff', outlineOffset: '4px' },
  })
}
