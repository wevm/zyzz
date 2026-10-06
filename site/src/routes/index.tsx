/** Renders the landing page and introductory styling example. @module */
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import GitHubIcon from '~icons/simple-icons/github'
import { AgentPrompt } from '../components/AgentPrompt.js'
import { Button } from '../components/Button.js'
import { Install } from '../components/Install.js'
import { Link } from '../components/Link.js'
import { style } from '../zyzz.config.js'

/** Renders the landing page. */
export const Route = createFileRoute('/')({
  // Keep the style namespace with the component; the route splitter drops it.
  codeSplitGroupings: [],
  component: Index,
})

const examples = __EXAMPLE__

const docsUrl = '/docs/introduction/getting-started'

const headingWords = [
  'Universal',
  'React Native',
  'Type-safe',
  'Standard',
  'Composable',
  'Performant',
  'Light',
  'Self-describing',
] as const

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

  const [file, setFile] = useState('example.tsx')
  const [manager, setManager] = useState<Install.Manager>('npm')

  return (
    <div {...styles.page()}>
      <header {...styles.header()}>
        <Link aria-label="Zyzz home" href="/" {...styles.brand()}>
          <svg
            aria-hidden="true"
            width="80"
            height="24"
            viewBox="12 24 233 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256ZM101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88ZM127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687ZM183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z"
              fill="currentColor"
            />
          </svg>
        </Link>
        <span {...styles.byline()}>
          By <a href="https://wevm.dev">Wevm</a>
        </span>
        <Link href={docsUrl} {...styles.headerLink()}>
          Docs
        </Link>
        <Link href="/vars" {...styles.referenceLink()}>
          Variables
        </Link>
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
            Bring structure to your styles and consistency to your interfaces.
            Write type-safe styles in TypeScript, compiled to static CSS.
          </p>
          <div {...styles.actions()}>
            <Button href={docsUrl}>
              Read the docs <span aria-hidden="true">→</span>
            </Button>
            <Button href="https://github.com/wevm/zyzz" variant="secondary">
              <GitHubIcon aria-hidden="true" width="20" height="20" />
              GitHub
            </Button>
          </div>
          <Install manager={manager} onManagerChange={setManager} />
          <AgentPrompt>{`Use Zyzz to style this project. Inspect its framework, build setup, and existing styling before making changes. Preserve unrelated code and conventions.

Install with: ${Install.commands[manager]}

Read the documentation before implementation:
- Getting started: https://zyzz.style/docs/introduction/getting-started.md
- Documentation index: https://zyzz.style/sitemap.xml
- Vite: https://zyzz.style/docs/api/vite.md
- Next.js: https://zyzz.style/docs/api/next.md
- CLI: https://zyzz.style/docs/api/cli.md

Choose the compilation integration that matches the project. Importing styles alone does not emit CSS. Preserve existing framework plugins.

Define shared variables and bound styling helpers with defineConfig in zyzz.config.ts. Import helpers from the authored config, define component styles in a styles namespace, and spread their applied props onto native elements. Use zyzz/default when the default design tokens fit the project.

Implement the requested interface with reusable styles, variables, and themes. Run the project's type checks and build, and verify that compiled CSS renders correctly.`}</AgentPrompt>
        </section>
        <section
          aria-label="Zyzz code example"
          style={{ backgroundColor: examples.bg, color: examples.fg }}
          {...styles.example()}
        >
          <div aria-label="Example files" role="tablist" {...styles.codeTabs()}>
            {examples.files.map((example, index) => (
              <button
                aria-controls={`example-panel-${example.name}`}
                aria-selected={file === example.name}
                id={`example-tab-${example.name}`}
                key={example.name}
                onClick={() => setFile(example.name)}
                onKeyDown={(event) => {
                  const count = examples.files.length
                  const next =
                    event.key === 'ArrowRight'
                      ? (index + 1) % count
                      : event.key === 'ArrowLeft'
                        ? (index + count - 1) % count
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? count - 1
                            : undefined
                  const target =
                    next === undefined ? undefined : examples.files[next]
                  if (!target) return
                  event.preventDefault()
                  setFile(target.name)
                  document.getElementById(`example-tab-${target.name}`)?.focus()
                }}
                role="tab"
                tabIndex={file === example.name ? 0 : -1}
                type="button"
                {...styles.codeTab()}
              >
                {example.name}
              </button>
            ))}
          </div>
          <div {...styles.codePanels()}>
            {examples.files.map((example) => (
              <pre
                aria-labelledby={`example-tab-${example.name}`}
                aria-hidden={file !== example.name}
                data-active={file === example.name}
                inert={file !== example.name}
                id={`example-panel-${example.name}`}
                key={example.name}
                role="tabpanel"
                tabIndex={file === example.name ? 0 : -1}
                {...styles.code()}
              >
                <code>
                  {example.tokens.map((line, lineIndex) => (
                    <Fragment key={lineIndex}>
                      {lineIndex > 0 && '\n'}
                      {line.map((token, tokenIndex) => (
                        <span key={tokenIndex} style={{ color: token.color }}>
                          {token.content}
                        </span>
                      ))}
                    </Fragment>
                  ))}
                </code>
              </pre>
            ))}
          </div>
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
    color: 'foreground',
    display: 'flex',
    textDecoration: 'none',
  })

  export const byline = style({
    typography: 'label.14',
    color: 'gray.900',
    fontWeight: 'medium',
    marginLeft: 3,
    transform: 'translateY(1px)',
    '& a': { color: 'inherit !custom', textDecoration: 'none' },
    '& a:hover': { color: 'foreground' },
  })

  export const code = style({
    typography: 'label.14.mono',
    gridArea: '1 / 1',
    margin: 0,
    minWidth: 0,
    overflowX: 'auto',
    paddingBottom: 8,
    paddingInline: 8,
    paddingTop: 7,
    tabSize: 2,
    visibility: 'hidden',
    '&[data-active="true"]': { visibility: 'visible' },
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

  export const codePanels = style({
    display: 'grid',
    minWidth: 0,
  })

  export const codeTab = style({
    typography: 'label.14',
    borderBottom: '2px solid transparent',
    color: 'gray.900',
    cursor: 'pointer',
    paddingBlock: 3,
    paddingInline: 3,
    '&[aria-selected="true"]': {
      borderBottomColor: 'foreground',
      color: 'foreground',
    },
    ':hover': { color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.600',
      outlineOffset: '-4px',
    },
  })

  export const codeTabs = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 2,
    overflowX: 'auto',
    paddingInline: 3,
  })

  export const description = style({
    typography: 'copy.20',
    color: 'gray.900',
    marginTop: 7,
    maxWidth: 'md',
  })

  export const example = style({
    alignSelf: 'center',
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
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
    fontWeight: 'medium',
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

  export const page = style({
    color: 'foreground',
    minHeight: '100svh !custom',
  })

  export const referenceLink = style({
    typography: 'label.16',
    color: 'gray.900',
    fontWeight: 'medium',
    marginLeft: 6,
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })
}
