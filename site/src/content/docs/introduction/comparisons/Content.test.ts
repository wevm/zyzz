/** Compiles the authored comparison example through the public CSS pipeline. @module */
import * as Fs from 'node:fs/promises'
import { describe, expect, test } from 'vite-plus/test'
import { Source } from 'zyzz/compiler'
import { Css } from 'zyzz/web'

describe('comparison examples', () => {
  test('compiles the documented dynamic bar', async () => {
    const document = await Fs.readFile(
      new URL('../comparisons.mdx', import.meta.url),
      'utf8',
    )
    const section = document
      .split('## Binding runtime values')[1]!
      .split('### Tailwind CSS')[0]!
    const source = section.match(/```tsx[^\n]*\n([\s\S]*?)```/)![1]!

    const extracted = Source.extract({ moduleId: 'Bar.tsx', source })
    const output = Css.compile({ styles: extracted.styles })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-bg-fkkKHe{background-color:#06c;}
      .z-h-awfsR2{height:0.5rem;}
      .z-w-K9WwAi{width:var(--z-dg4ksh71uood5r-243-77-69-64-74-68);}"
    `)
  })
})
