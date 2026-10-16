/** Defines the playground's editable projects and versioned share links. @module */
import LZString from 'lz-string'

/** Source files supplied to the compiler, keyed by project-relative paths. */
export type Files = Record<string, string>

/** Preview runtimes supported by the browser bundler. */
export type Framework = 'react' | 'vanilla'

/** Source entrypoint mounted by each preview runtime. */
export const entryFiles = { react: 'App.tsx', vanilla: 'App.js' } as const

/** Editable source and presentation state persisted in share links. */
export type State = {
  /** Source insertion order remains independent of tab order and CSS emission. */
  files: Files
  /** Runtime used to mount the entrypoint's default export. */
  framework: Framework
  /** File tabs in their displayed order. */
  order: readonly string[]
}

const config = `import { defineConfig } from 'zyzz'

// Color pairs follow the document's color scheme.
export const { style, variants, vars } = defineConfig({
  vars: {
    color: {
      accent: { dark: '#52a8ff', light: '#0072f5' },
      accentHover: { dark: '#8ec8ff', light: '#0062d1' },
      border: { dark: '#333333', light: '#e5e5e5' },
      canvas: { dark: '#0a0a0a', light: '#ffffff' },
      ink: { dark: '#ededed', light: '#171717' },
      onAccent: { dark: '#171717', light: '#ffffff' },
      paper: { dark: '#111111', light: '#fafafa' },
    },
    spacing: { gap: '16px' },
  },
})
`

/** Starter projects in the order shown by the example picker. */
export const examples: Record<
  string,
  { description: string; files: Files; framework: Framework }
> = {
  Styles: {
    description: 'React · Themes and hover styles',
    framework: 'react',
    files: {
      'App.tsx': `import Logo from './Logo.js'
import { style } from './zyzz.config.js'

const steps = [
  <>Edit the root component in <code>App.tsx</code>.</>,
  <>Add files for more components.</>,
  <>Define tokens in <code>zyzz.config.ts</code>.</>,
  <>Use Share to copy a link to this project.</>,
]

export default function App() {
  return (
    <main {...styles.page()}>
      <article {...styles.card()}>
        <h1 {...styles.title()}>
          <Logo /> <span>playground</span>
        </h1>
        <ul {...styles.steps()}>
          {steps.map((step, index) => (
            <li key={index} {...styles.step()}>
              <span aria-hidden="true" {...styles.check()}>✓</span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
        <nav aria-label="Resources" {...styles.links()}>
          <a {...styles.button()} href="https://zyzz.style/docs/introduction/getting-started" target="_blank" rel="noreferrer">
            See the docs <span aria-hidden="true">↗</span>
          </a>
          <a {...styles.button(styles.secondary())} href="https://github.com/wevm/zyzz" target="_blank" rel="noreferrer">
            View on GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </article>
    </main>
  )
}

namespace styles {
  export const page = style({
    backgroundColor: 'canvas',
    display: 'grid',
    minHeight: '100vh !custom',
    padding: '24px !custom',
    placeItems: 'center',
  })

  export const card = style({
    backgroundColor: 'paper',
    border: '1px solid',
    borderColor: 'border',
    borderRadius: '24px',
    color: 'ink',
    display: 'grid',
    gap: '32px !custom',
    maxWidth: '560px !custom',
    padding: '32px !custom',
    width: '100% !custom',
    '@media (max-width: 480px)': { gap: '24px !custom', padding: '20px !custom' },
  })

  export const title = style({
    alignItems: 'center',
    color: 'accent',
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: 'clamp(24px, 5vw, 32px)',
    fontWeight: 500,
    gap: '12px !custom',
    justifyContent: 'center',
    letterSpacing: '-0.04em',
    margin: '8px 0 !custom',
    '& svg': { color: 'ink', width: '104px !custom', height: '32px !custom' },
  })

  export const steps = style({
    display: 'grid',
    gap: '8px !custom',
    listStyle: 'none',
    margin: '0 !custom',
    padding: '0 !custom',
  })

  export const step = style({
    alignItems: 'center',
    border: '1px solid',
    borderColor: 'border',
    borderRadius: '8px',
    display: 'flex',
    fontSize: '14px',
    gap: '12px !custom',
    lineHeight: 1.6,
    padding: '16px !custom',
    ':first-child': { borderStartStartRadius: '16px', borderStartEndRadius: '16px' },
    ':last-child': { borderEndStartRadius: '16px', borderEndEndRadius: '16px' },
    '@media (max-width: 480px)': { fontSize: '13px', padding: '12px !custom' },
  })

  export const check = style({
    backgroundColor: 'accent',
    borderRadius: '50%',
    color: 'onAccent',
    display: 'grid',
    flexShrink: 0,
    height: '24px !custom',
    placeItems: 'center',
    width: '24px !custom',
  })

  export const links = style({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px !custom',
  })

  // Selectors are emitted as ordinary CSS.
  export const button = style({
    alignItems: 'center',
    backgroundColor: 'accent',
    border: '1px solid transparent',
    borderRadius: '8px',
    color: 'onAccent',
    display: 'flex',
    flex: '1 1 auto',
    fontSize: '14px',
    fontWeight: 600,
    gap: '12px !custom',
    justifyContent: 'space-between',
    padding: '14px 20px !custom',
    textDecoration: 'none',
    ':hover': { backgroundColor: 'accentHover' },
    ':focus-visible': { outline: '2px solid', outlineColor: 'accent', outlineOffset: '3px' },
    '@media (max-width: 480px)': { fontSize: '13px', padding: '12px !custom' },
  })

  export const secondary = style({
    backgroundColor: 'canvas',
    borderColor: 'border',
    color: 'ink',
    ':hover': { backgroundColor: 'border' },
  })
}
`,
      'Logo.tsx': `// The Zyzz wordmark uses the surrounding text color.
export default function Logo() {
  return (
    <svg aria-label="Zyzz" role="img" viewBox="12 24 233 64" fill="currentColor">
      <path d="M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256ZM101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88ZM127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687ZM183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z" />
    </svg>
  )
}
`,
      'zyzz.config.ts': config,
    },
  },
  Variants: {
    description: 'React · Interactive button variants',
    framework: 'react',
    files: {
      'App.tsx': `import { useState } from 'react'
import { style, variants } from './zyzz.config.js'

export default function App() {
  const [active, setActive] = useState(false)
  return (
    <main {...styles.page()}>
      <h1>One definition. Two variants.</h1>
      <button
        {...styles.button({ tone: active ? 'accent' : 'neutral' })}
        onClick={() => setActive(!active)}
      >
        {active ? 'Accent selected' : 'Click to switch'}
      </button>
    </main>
  )
}

namespace styles {
  export const page = style({ padding: '40px !custom' })

  // The runtime selects precompiled styles, without generating CSS.
  export const button = variants({
    base: {
      border: 'none',
      borderRadius: '10px',
      cursor: 'pointer',
      fontSize: '16px',
      padding: '14px 24px !custom',
    },
    variants: {
      tone: {
        accent: { backgroundColor: 'accent', color: 'onAccent' },
        neutral: { backgroundColor: 'border', color: 'ink' },
      },
    },
  })
}
`,
      'zyzz.config.ts': config,
    },
  },
  'Vanilla JS': {
    description: 'DOM · No framework required',
    framework: 'vanilla',
    files: {
      'App.js': `import { style } from './zyzz.config.js'

export default function App() {
  const main = document.createElement('main')
  Object.assign(main, pageStyle())
  const heading = document.createElement('h1')
  heading.textContent = 'Just JavaScript and CSS.'
  const button = document.createElement('button')
  Object.assign(button, buttonStyle())
  let count = 0
  button.textContent = 'Count: 0'
  button.onclick = () => { button.textContent = 'Count: ' + ++count }
  main.append(heading, button)
  return main
}

const pageStyle = style({ padding: '40px !custom' })

// Static className props apply directly to DOM elements.
const buttonStyle = style({
  backgroundColor: 'accent',
  border: 'none',
  borderRadius: '10px',
  color: 'onAccent',
  cursor: 'pointer',
  padding: '14px 24px !custom',
})
`,
      'zyzz.config.js': config,
    },
  },
}

/** Opens a starter project with its original source and tab order. */
export function create(name: string): State {
  const { files, framework } = examples[name]!
  return { files, framework, order: Object.keys(files) }
}

/** Adds an empty source file, rejecting duplicate, reserved, or unsupported names. */
export function addFile(project: State, name: string): State {
  if (!validName(name))
    throw new Error(
      'Use a top-level .ts, .tsx, .js, or .jsx filename. index.* is reserved.',
    )
  if (Object.hasOwn(project.files, name))
    throw new Error('That file already exists.')
  if (project.order.length >= 20)
    throw new Error('Projects support at most 20 files.')

  return {
    ...project,
    files: { ...project.files, [name]: `// ${name}\n` },
    order: [...project.order, name],
  }
}

/** Encodes source without sending it to a persistence service. */
export function encode(project: State): string {
  return LZString.compressToEncodedURIComponent(
    JSON.stringify({ ...project, version: 2 }),
  )
}

/** Reads a share link, rejecting unknown formats and oversized or unsupported projects. */
export function decode(value: string): State {
  if (value.length > 100_000)
    throw new Error('This shared project is too large.')
  const text = LZString.decompressFromEncodedURIComponent(value)
  if (!text || text.length > 200_000)
    throw new Error('Invalid or oversized shared project.')
  const data: unknown = JSON.parse(text)
  if (
    !data ||
    typeof data !== 'object' ||
    !('version' in data) ||
    (data.version !== 1 && data.version !== 2) ||
    !('files' in data)
  )
    throw new Error('Unsupported shared project version.')
  const files = data.files
  if (!files || typeof files !== 'object' || Array.isArray(files))
    throw new Error('Invalid project files.')
  const framework = 'framework' in data ? data.framework : 'react'
  if (framework !== 'react' && framework !== 'vanilla')
    throw new Error('Unsupported preview framework.')
  const entries = Object.entries(files)
  if (
    entries.length === 0 ||
    entries.length > 20 ||
    !Object.hasOwn(files, entryFiles[framework])
  )
    throw new Error(
      `Projects must include ${entryFiles[framework]} and at most 20 files.`,
    )
  for (const [path, source] of entries)
    if (!validName(path) || typeof source !== 'string')
      throw new Error(
        'Projects support top-level JavaScript and TypeScript files only.',
      )
  const order = 'order' in data ? data.order : Object.keys(files)
  if (
    !Array.isArray(order) ||
    order.length !== entries.length ||
    new Set(order).size !== entries.length ||
    !order.every(
      (name) => typeof name === 'string' && Object.hasOwn(files, name),
    )
  )
    throw new Error('Invalid file tab order.')

  return { files: Object.fromEntries(entries), framework, order }
}

function validName(name: string) {
  return (
    /^[\w-]+(?:\.[\w-]+)*\.(?:tsx?|jsx?)$/.test(name) &&
    !/^index\.(?:tsx?|jsx?)$/.test(name)
  )
}
