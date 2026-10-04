/** Compiles the migration guide's examples through public source and CSS APIs. @module */
import * as Fs from 'node:fs'
import { describe, expect, test } from 'vite-plus/test'
import { Graph, Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

const document = Fs.readFileSync(
  new URL('./stylex.mdx', import.meta.url),
  'utf8',
)
const examples = [
  ...document.matchAll(/```(tsx?|sh|html)[^\n]*\n([\s\S]*?)```/g),
]

function compile(section: string) {
  const source = document.split(`## ${section}\n`)[1]!.split('\n## ')[0]!
  const snippets = [...source.matchAll(/```tsx?[^\n]*\n([\s\S]*?)```/g)]
  return snippets
    .filter((snippet) => !snippet[1]!.includes('@stylexjs/stylex'))
    .map((snippet) => {
      const extracted = Source.extract({
        moduleId: 'example.tsx',
        source: snippet[1]!,
      })
      return Css.compile({ styles: extracted.styles }).css
    })
    .join('\n')
}

describe('StyleX migration examples', () => {
  test('compiles every Zyzz example with its documented config', () => {
    let config: string | undefined
    let count = 0
    for (const example of examples) {
      const source = example[2]!
      if (!example[1]!.startsWith('ts') || source.includes("from 'vite'"))
        continue
      if (
        source.includes('@stylexjs/stylex') &&
        !source.includes("from 'zyzz'")
      )
        continue
      if (source.startsWith('// zyzz.config.ts')) {
        config = source
        continue
      }
      const modules: Record<string, string> = { 'example.tsx': source }
      if (source.includes("from './zyzz.config.js'"))
        modules['zyzz.config.ts'] = config!

      Graph.compile({ modules })

      count++
    }
    expect(count).toMatchInlineSnapshot('18')
  })

  test('retains fallback order, conditions, and dynamic bindings', () => {
    const definitions = compile('Define Styles')
    const conditions = compile('States and Queries')
    const dynamic = compile('Dynamic Values')

    expect(
      /color:#2563eb;[\s\S]*color:oklch\(60% 0.2 250\);/.test(definitions),
    ).toMatchInlineSnapshot('true')
    expect(
      conditions.includes('@media (min-width: 48rem)'),
    ).toMatchInlineSnapshot('true')
    expect(
      conditions.includes('@container card (min-width: 30rem)'),
    ).toMatchInlineSnapshot('true')
    expect(
      conditions.includes(':hover{background-color:#1d4ed8;}'),
    ).toMatchInlineSnapshot('true')
    expect(dynamic.includes('width:var(--')).toMatchInlineSnapshot('true')
  })
})
