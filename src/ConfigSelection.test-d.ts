/** Checks inferred names and renderer-specific theme selection props. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config } from 'zyzz'
import { Selection } from 'zyzz/runtime'

describe('create', () => {
  test('retains runtime catalog and renderer types', () => {
    const select = Selection.create([['base', 'scope']] as const)

    expectTypeOf(select.base.className).toEqualTypeOf<string>()
    expectTypeOf(select({ theme: 'base' }).className).toEqualTypeOf<string>()

    const html = Selection.create([['base', 'scope']] as const, true)

    expectTypeOf(html({ theme: 'base' }).class).toEqualTypeOf<string>()

    // @ts-expect-error catalog names remain finite
    select({ theme: 'other' })
  })
  test('infers names, schemes, default variables, and output', () => {
    const { theme, themes } = Config.create({
      defaultTheme: 'ocean',
      themes: {
        ocean: { color: { ink: '#123456' } },
        mint: { color: { ink: '#008844' } },
      },
    })

    expectTypeOf(themes({ theme: 'mint' }).className).toEqualTypeOf<string>()
    expectTypeOf(theme.vars.color.ink).not.toBeNever()

    // @ts-expect-error Unknown theme name.
    themes({ theme: 'missing' })
    // @ts-expect-error Selection requires a name.
    themes({})
    // @ts-expect-error Scheme is a finite CSS domain.
    themes({ theme: 'mint', colorScheme: 'system' })

    const html = Config.create({
      output: 'html',
      defaultTheme: 'a',
      themes: { a: {} },
    })

    expectTypeOf(html.themes({ theme: 'a' }).class).toEqualTypeOf<string>()

    // @ts-expect-error HTML output has no React className.
    void html.themes({ theme: 'a' }).className
  })
})

describe('create', () => {
  test('rejects extra selector fields through variables', () => {
    const { themes } = Config.create({
      defaultTheme: 'base',
      themes: { base: {} },
    })
    const choice = { theme: 'base', extra: true } as const

    // @ts-expect-error selectors accept only theme and colorScheme
    themes(choice)
  })
})
