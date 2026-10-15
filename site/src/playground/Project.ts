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
      accent: { dark: '#a5b4fc', light: '#6366f1' },
      accentHover: { dark: '#c7d2fe', light: '#4338ca' },
      border: { dark: '#333333', light: '#e5e5e5' },
      canvas: { dark: '#0a0a0a', light: '#fafafa' },
      ink: { dark: '#ededed', light: '#18181b' },
      onAccent: { dark: '#171717', light: '#ffffff' },
      paper: { dark: '#171717', light: '#ffffff' },
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
      'App.tsx': `import { style } from './zyzz.config.js'

export default function App() {
  return (
    <main {...styles.page()}>
      <article {...styles.card()}>
        <span {...styles.eyebrow()}>ZYZZ PLAYGROUND</span>
        <h1 {...styles.title()}>Make it your own.</h1>
        <p>Switch the theme. Edit a style. See the CSS.</p>
        <button {...styles.button()}>Hover over me ↗</button>
      </article>
    </main>
  )
}

namespace styles {
  export const page = style({
    backgroundColor: 'canvas',
    display: 'grid',
    minHeight: '100vh !custom',
    padding: '32px !custom',
    placeItems: 'center',
  })

  export const card = style({
    backgroundColor: 'paper',
    border: '1px solid',
    borderColor: 'border',
    borderRadius: '20px',
    color: 'ink',
    display: 'grid',
    gap: 'gap',
    maxWidth: '420px !custom',
    padding: '32px !custom',
  })

  export const eyebrow = style({
    color: 'accent',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
  })

  export const title = style({
    fontSize: '36px',
    letterSpacing: '-0.04em',
    lineHeight: 1.1,
    margin: '0 !custom',
  })

  // Selectors are emitted as ordinary CSS.
  export const button = style({
    backgroundColor: 'accent',
    border: 'none',
    borderRadius: '10px',
    color: 'onAccent',
    cursor: 'pointer',
    fontWeight: 600,
    padding: '12px 20px !custom',
    ':hover': { backgroundColor: 'accentHover' },
  })
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
