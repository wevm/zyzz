/** Defines the playground's editable projects and versioned share links. @module */
import LZString from 'lz-string'

/** Source files supplied to the compiler, keyed by project-relative paths. */
export type Files = Record<string, string>

const config = `import { defineConfig } from 'zyzz'

// Shared tokens are compiled across both files.
export const { style, variants, vars } = defineConfig({
  vars: {
    color: { accent: '#6366f1', ink: '#18181b', paper: '#ffffff' },
    spacing: { gap: '16px' },
  },
})
`

/** Starter projects in the order shown by the example picker. */
export const examples: Record<string, { description: string; files: Files }> = {
  Styles: {
    description: 'Shared tokens, scoped styles, and hover selectors.',
    files: {
      'App.tsx': `import { style } from './zyzz.config.js'

export default function App() {
  return (
    <main {...styles.page()}>
      <article {...styles.card()}>
        <span {...styles.eyebrow()}>ZYZZ PLAYGROUND</span>
        <h1 {...styles.title()}>Make it your own.</h1>
        <p>Change a style. See the CSS. Keep the runtime small.</p>
        <button {...styles.button()}>Hover over me ↗</button>
      </article>
    </main>
  )
}

namespace styles {
  export const page = style({
    backgroundColor: '#f4f4f5 !custom',
    display: 'grid',
    minHeight: '100vh !custom',
    padding: '32px !custom',
    placeItems: 'center',
  })

  export const card = style({
    backgroundColor: 'paper',
    border: '1px solid #e4e4e7',
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
    color: 'paper',
    cursor: 'pointer',
    fontWeight: 600,
    padding: '12px 20px !custom',
    ':hover': { backgroundColor: '#4338ca !custom' },
  })
}
`,
      'zyzz.config.ts': config,
    },
  },
  Variants: {
    description: 'Switch between precompiled button variants.',
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
        accent: { backgroundColor: 'accent', color: 'paper' },
        neutral: { backgroundColor: '#e4e4e7 !custom', color: 'ink' },
      },
    },
  })
}
`,
      'zyzz.config.ts': config,
    },
  },
}

/** Encodes source without sending it to a persistence service. */
export function encode(files: Files): string {
  return LZString.compressToEncodedURIComponent(
    JSON.stringify({ files, version: 1 }),
  )
}

/** Reads a share link, rejecting unknown formats and oversized or unsupported projects. */
export function decode(value: string): Files {
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
    data.version !== 1 ||
    !('files' in data)
  )
    throw new Error('Unsupported shared project version.')
  const files = data.files
  if (!files || typeof files !== 'object' || Array.isArray(files))
    throw new Error('Invalid project files.')
  const entries = Object.entries(files)
  if (entries.length === 0 || entries.length > 20 || !('App.tsx' in files))
    throw new Error('Projects must include App.tsx and at most 20 files.')
  for (const [path, source] of entries)
    if (
      !/^[\w-]+(?:\.[\w-]+)*\.(?:tsx?|jsx?)$/.test(path) ||
      typeof source !== 'string'
    )
      throw new Error(
        'Projects support top-level JavaScript and TypeScript files only.',
      )
  return Object.fromEntries(entries)
}
