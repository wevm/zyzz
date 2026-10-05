/** Compiles the migration guide's Zyzz examples through the public compiler. @module */
import * as Fs from 'node:fs'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

const document = Fs.readFileSync(
  new URL('./stylex.mdx', import.meta.url),
  'utf8',
)
const fences = [
  ...document.matchAll(/```tsx?(?: title="([^"]+)")?\n([\s\S]*?)```/g),
].map((match) => ({ code: match[2]!, title: match[1] }))

/** Compiles each Zyzz example with the config fence that precedes it. */
function compile(): readonly string[] {
  let config: string | undefined

  return fences.flatMap((fence) => {
    if (fence.title === 'zyzz.config.ts') {
      config = fence.code
      return []
    }
    if (!/from '(zyzz|\.\/zyzz\.config\.js)/.test(fence.code)) return []

    const modules: Record<string, string> = { 'example.tsx': fence.code }
    if (fence.code.includes("from './zyzz.config.js'"))
      modules['zyzz.config.ts'] = config!
    const output = Graph.compile({ modules })

    return [
      [
        output.sharedCss,
        ...Object.values(output.modules).map((module) => module.css),
      ].join('\n'),
    ]
  })
}

describe('StyleX migration examples', () => {
  test('compiles every Zyzz example with its documented config', () => {
    expect(compile().length).toMatchInlineSnapshot('17')
  })

  test('retains fallback order, conditions, and dynamic bindings', () => {
    const css = compile().join('\n')

    expect(
      /color:#2563eb;[\s\S]*color:oklch\(60% 0.2 250\);/.test(css),
    ).toMatchInlineSnapshot('true')
    expect(css.includes('@media (min-width: 768px)')).toMatchInlineSnapshot(
      'true',
    )
    expect(
      css.includes(':hover{background-color:#1d4ed8;}'),
    ).toMatchInlineSnapshot('true')
    expect(css.includes('::placeholder{color:#666;}')).toMatchInlineSnapshot(
      'true',
    )
    expect(css.includes('width:var(--')).toMatchInlineSnapshot('true')
    expect(css.includes('@keyframes')).toMatchInlineSnapshot('true')
  })
})
