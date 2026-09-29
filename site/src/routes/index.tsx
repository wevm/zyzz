/** Renders the landing page and introductory styling example. @module */
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import GitHubIcon from '~icons/simple-icons/github'
import { Button } from '../components/Button.js'
import { style } from '../zyzz.config.js'

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
const headingWords = [
  'Universal',
  'Type-safe',
  'Standard',
  'Composable',
  'Performant',
  'Light',
  'Self-describing',
] as const

const installCommands = {
  npm: 'npm install zyzz',
  pnpm: 'pnpm add zyzz',
  bun: 'bun add zyzz',
} as const

function Index() {
  const [word, setWord] = useState(0)
  const wordsRef = useRef<HTMLSpanElement>(null)
  const [offset, setOffset] = useState(0)

  useLayoutEffect(() => {
    const words = wordsRef.current
    const active = words?.children[word]
    if (!words || !active) return

    const measure = () =>
      setOffset(
        active.getBoundingClientRect().width -
          words.getBoundingClientRect().width,
      )
    const observer = new ResizeObserver(measure)
    observer.observe(words)
    observer.observe(active)
    measure()
    return () => observer.disconnect()
  }, [word])

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const interval = window.setInterval(() => {
      if (!motion.matches && document.visibilityState === 'visible')
        setWord((index) => (index + 1) % headingWords.length)
    }, 4000)
    const reset = () => setWord(0)
    motion.addEventListener('change', reset)
    return () => {
      window.clearInterval(interval)
      motion.removeEventListener('change', reset)
    }
  }, [])

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
          <h1
            aria-label="Universal styles for modern interfaces"
            id="heading"
            {...styles.heading()}
          >
            <span aria-hidden="true">
              <span {...styles.headingLine()}>
                <span ref={wordsRef} {...styles.headingWords()}>
                  {headingWords.map((text, index) => (
                    <span
                      data-active={index === word}
                      key={text}
                      {...styles.headingWord()}
                    >
                      {text}
                    </span>
                  ))}
                </span>
                <span
                  {...styles.headingSuffix()}
                  style={{ transform: `translateX(${offset}px)` }}
                >
                  {' '}
                  styles
                </span>
              </span>
              <br />
              for modern interfaces
            </span>
          </h1>
          <p {...styles.description()}>
            Write type-safe styles, variables, and themes. Compile to static
            CSS. Keep your styles close to your code.
          </p>
          <div {...styles.actions()}>
            <Button href={docsUrl}>
              Read the docs <span aria-hidden="true">↗</span>
            </Button>
            <Button href="https://github.com/wevm/zyzz" variant="secondary">
              <GitHubIcon aria-hidden="true" width="20" height="20" />
              GitHub
            </Button>
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
              <Button
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
                variant="ghost"
                size="icon"
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
              </Button>
            </div>
          </div>
          <p aria-live="polite" {...styles.copyStatus()}>
            {copyState === 'copied' && 'Copied to clipboard.'}
            {copyState === 'failed' &&
              'Could not copy. Select the command to copy it manually.'}
          </p>
        </section>
        <section aria-label="Zyzz code example" {...styles.example()}>
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
    gap: 3,
    marginTop: 9,
  })
  export const brand = style({
    typography: 'heading.40',
    color: 'foreground',
    textDecoration: 'none',
  })
  export const byline = style({
    typography: 'label.16',
    color: 'gray.900',
    marginLeft: 5,
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })
  export const code = style({
    typography: 'label.14.mono',
    color: 'foreground',
    margin: 0,
    overflowX: 'auto',
    paddingBottom: 8,
    paddingInline: 8,
    paddingTop: 7,
    tabSize: 2,
    '& code': { font: 'inherit' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'gray.600',
      outlineOffset: '-2px',
    },
    '@media (max-width: 600px)': {
      typography: 'label.12.mono',
      paddingBlock: 5,
      paddingInline: 5,
    },
  })
  export const command = style({
    typography: 'label.14.mono',
    color: 'foreground',
  })
  export const commandRow = style({
    alignItems: 'center',
    display: 'flex',
    gap: 3,
    justifyContent: 'space-between',
    paddingBlock: 5,
    paddingInline: 5,
  })
  export const copyStatus = style({
    typography: 'copy.13',
    color: 'gray.900',
    minHeight: 6,
    paddingTop: 2,
  })
  export const description = style({
    typography: 'copy.20',
    color: 'gray.900',
    marginTop: 7,
    maxWidth: 'md',
  })
  export const example = style({
    alignSelf: 'center',
    backgroundColor: 'background.200',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'xl',
    minWidth: 0,
    overflow: 'hidden',
  })
  export const header = style({
    alignItems: 'center',
    display: 'flex',
    marginInline: 'auto !custom',
    maxWidth: '7xl',
    paddingBlock: 10,
    paddingInline: 12,
    '@media (max-width: 600px)': { paddingBlock: 7, paddingInline: 6 },
  })
  export const headerLink = style({
    typography: 'label.16',
    color: 'gray.900',
    marginLeft: 'auto !custom',
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })
  export const heading = style({
    typography: 'heading.56',
    '@media (max-width: 1200px)': { typography: 'heading.40' },
    '@media (max-width: 1000px)': { typography: 'heading.32' },
    '@media (max-width: 360px)': { typography: 'heading.24' },
  })
  export const headingLine = style({
    whiteSpace: 'nowrap',
  })
  export const headingSuffix = style({
    display: 'inline-block',
    whiteSpace: 'pre',
    transition: 'transform 240ms cubic-bezier(0.23, 1, 0.32, 1)',
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })
  export const headingWord = style({
    filter: 'blur(8px)',
    gridArea: '1 / 1',
    justifySelf: 'start',
    opacity: 0,
    transition:
      'opacity 160ms cubic-bezier(0.23, 1, 0.32, 1), filter 160ms cubic-bezier(0.23, 1, 0.32, 1)',
    selectors: {
      '&[data-active="true"]': {
        filter: 'blur(0)',
        opacity: 1,
        transitionDelay: '80ms',
      },
    },
    '@media (prefers-reduced-motion: reduce)': {
      filter: 'none',
      transition: 'none',
    },
  })
  export const headingWords = style({
    display: 'inline-grid',
  })
  export const install = style({
    backgroundColor: 'gray.100',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    marginTop: 10,
    maxWidth: 'md',
    overflow: 'hidden',
  })
  export const installHeader = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 2,
    paddingInline: 3,
  })
  export const intro = style({
    alignSelf: 'center',
    minWidth: 0,
    paddingBlock: 8,
  })
  export const main = style({
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
    marginInline: 'auto !custom',
    maxWidth: '7xl',
    paddingBottom: 20,
    paddingInline: 12,
    paddingTop: 11,
    '@media (max-width: 900px)': {
      gap: 7,
      gridTemplateColumns: 'minmax(0, 1fr)',
      maxWidth: '3xl',
      paddingTop: 3,
    },
    '@media (max-width: 600px)': {
      paddingBottom: 10,
      paddingInline: 6,
      paddingTop: 3,
    },
  })
  export const manager = style({
    typography: 'button.14',
    borderBottom: '2px solid transparent',
    color: 'gray.900',
    cursor: 'pointer',
    paddingBlock: 3,
    paddingInline: 3,
    '&[aria-pressed="true"]': {
      borderBottomColor: 'foreground',
      color: 'foreground',
    },
    ':hover': { color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'gray.600',
      outlineOffset: '-4px',
    },
  })
  export const page = style({
    backgroundColor: 'background.100',
    color: 'foreground',
    minHeight: '100svh !custom',
  })
}
