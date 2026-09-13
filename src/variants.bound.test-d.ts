/** Checks themed and configured recipe inference through public authoring. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, Theme } from 'zyzz'

describe('variants', () => {
  test('keeps renamed theme helpers independently typed', () => {
    const theme = Theme.define({ color: { brand: '#06c' } })
    const { css: style, variants: recipe } = theme
    const base = style({ color: 'brand' })
    const button = recipe({
      variants: { intent: { primary: { color: 'brand' }, quiet: {} } },
    })

    expectTypeOf(base()).toHaveProperty('className')
    expectTypeOf<
      NonNullable<Parameters<typeof button>[0]>['intent']
    >().toEqualTypeOf<'primary' | 'quiet' | null | undefined>()
    // @ts-expect-error Unknown finite choice.
    button({ intent: 'missing' })
    // @ts-expect-error Unknown theme color.
    style({ color: 'missing' })
    // @ts-expect-error Unknown theme color in a recipe.
    recipe({ base: { color: 'missing' } })
  })

  test('retains tokens, mappings, layers, and HTML output', () => {
    const theme = Theme.define({
      color: { brand: '#06c' },
      spacing: { sm: '4px' },
    })
    const button = theme.variants({
      variants: { intent: { primary: { color: 'brand', padding: 'sm' } } },
    })
    expectTypeOf(button()).toHaveProperty('className')
    // @ts-expect-error Wrong token domain.
    theme.variants({ base: { padding: 'brand' } })
    const { variants, theme: configured } = Config.create({
      theme: { color: { brand: '#06c' } },
      output: 'html',
      layers: ['components'],
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
    })
    const link = variants({
      base: { '@layer components': { px: '4px' } },
      variants: { intent: { primary: { color: 'brand' } } },
    })
    expectTypeOf(link()).toHaveProperty('class')
    expectTypeOf(configured.variants({ base: { px: '4px' } })()).toHaveProperty(
      'class',
    )
    const extended = Theme.extend(configured, { color: { brand: '#09c' } })
    expectTypeOf(extended.variants({ base: { px: '4px' } })()).toHaveProperty(
      'class',
    )
    // @ts-expect-error Unknown configured layer.
    variants({ base: { '@layer missing': { color: 'brand' } } })
    // @ts-expect-error Unknown configured token.
    variants({ base: { color: 'missing' } })
  })
})
