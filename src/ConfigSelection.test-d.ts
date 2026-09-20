/** Checks inferred names and renderer-specific theme selection props. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'

import { Selection } from 'zyzz/runtime'

describe('create', () => {
  test('retains runtime catalog and renderer types', () => {
    const select = Selection.create([['base', 'scope']] as const)

    expectTypeOf(select({ set: 'base' }).className).toEqualTypeOf<string>()
    expectTypeOf(select({ set: 'base' }).className).toEqualTypeOf<string>()

    const html = Selection.create([['base', 'scope']] as const, true)

    expectTypeOf(html({ set: 'base' }).class).toEqualTypeOf<string>()

    // @ts-expect-error catalog names remain finite
    select({ set: 'other' })
  })
  test('infers names, schemes, default variables, and output', () => {
    const { vars: theme, vars: themes } = Config.create({
      defaultVars: 'ocean',
      vars: {
        ocean: { color: { ink: '#123456' } },
        mint: { color: { ink: '#008844' } },
      },
    })

    expectTypeOf(themes({ set: 'mint' }).className).toEqualTypeOf<string>()
    expectTypeOf(theme.color.ink).not.toBeNever()

    // @ts-expect-error Unknown theme name.
    themes({ set: 'missing' })
    themes({})
    // @ts-expect-error Scheme is a finite CSS domain.
    themes({ set: 'mint', colorScheme: 'system' })

    const html = Config.create({
      output: 'html',
      defaultVars: 'a',
      vars: { a: {} },
    })

    expectTypeOf(html.vars({ set: 'a' }).class).toEqualTypeOf<string>()

    // @ts-expect-error HTML output has no React className.
    void html.vars({ set: 'a' }).className
  })
})

describe('create', () => {
  test('rejects extra selector fields through variables', () => {
    const { vars: themes } = Config.create({
      defaultVars: 'base',
      vars: { base: {} },
    })
    const choice = { set: 'base', extra: true } as const

    // @ts-expect-error selectors accept only theme and colorScheme
    themes(choice)
  })
})
