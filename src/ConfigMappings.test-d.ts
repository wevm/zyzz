import { Vars } from 'zyzz'
/** Checks exact alias keys and every expanded target's token/value domain. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, style } from 'zyzz'

describe('create', () => {
  test('preserves HTML output on mapped theme handles', () => {
    const themeConfig = Config.create({
      output: 'html',
      vars: { padding: { sm: '4px' } },
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
    })

    expectTypeOf(themeConfig.style({ px: 'sm' })()).toHaveProperty('class')

    const extended = Vars.extend(themeConfig.vars, { padding: { sm: '8px' } })
    const extendedConfig = Config.create({
      vars: extended,
      output: 'html',
      shorthands: {
        px: ['paddingLeft', 'paddingRight'],
        'padding-x': ['paddingLeft', 'paddingRight'],
      },
    })

    expectTypeOf(extendedConfig.style({ px: 'sm' })()).toHaveProperty('class')

    // @ts-expect-error HTML output does not expose React className
    void extendedConfig.style({ px: 'sm' })().className

    expectTypeOf(
      themeConfig.style((values: { width: '4px' | '8px' }) => ({
        px: `[${values.width}]`,
      }))({
        width: '4px',
      }).style,
    ).toEqualTypeOf<string | undefined>()
    // @ts-expect-error HTML handles do not expose React className
    void themeConfig.style({ px: 'sm' })().className
  })
  test('preserves configured aliases through theme extensions', () => {
    const themeConfig = Config.create({
      vars: { spacing: { sm: '4px' } },
      shorthands: { 'padding-x': ['paddingLeft', 'paddingRight'] },
    })
    const extended = Vars.extend(themeConfig.vars, { spacing: { sm: '8px' } })
    const extendedConfig = Config.create({
      vars: extended,
      output: 'html',
      shorthands: {
        px: ['paddingLeft', 'paddingRight'],
        'padding-x': ['paddingLeft', 'paddingRight'],
      },
    })

    extendedConfig.style({ 'padding-x': 'sm' })
    // @ts-expect-error extension retains finite alias names
    extendedConfig.style({ unknownAlias: 'sm' })
  })
  test('does not infer aliases from a widened mapping record', () => {
    const { style } = Config.create({
      shorthands: { px: ['paddingLeft'] } as NonNullable<
        Config.create.Options['shorthands']
      >,
    })

    // @ts-expect-error widened metadata declares no finite alias names
    style({ missing: 'inherit' })
    // @ts-expect-error numeric keys are not source alias names
    Config.create({ shorthands: { 1: ['paddingLeft'] } })
  })
  test('infers aliases through nested styles and bound handles', () => {
    const { style: configured } = Config.create({
      shorthands: {
        px: ['paddingLeft', 'paddingRight'],
        mixed: ['marginLeft', 'paddingLeft'],
      },
      vars: {
        margin: { gap: '-4px', shared: '4px' },
        padding: { shared: '8px' },
      },
    })

    expectTypeOf(
      configured({ px: 'shared', ':hover': { px: 'shared !important' } })(),
    ).toHaveProperty('className')

    configured({ px: 'shared' })
    configured({ mixed: 'shared' })
    configured((values: { width: '10px' | '20px' }) => ({
      px: `[${values.width}]`,
    }))
    // @ts-expect-error every target must accept the token
    configured({ mixed: 'gap' })
    // @ts-expect-error padding rejects negative lengths
    configured({ px: '-1px' })
    // @ts-expect-error aliases do not install on root style
    style({ px: '4px' })
    // @ts-expect-error unknown aliases remain errors
    configured({ paddingX: '4px' })
    // @ts-expect-error dynamic numbers do not represent lengths
    configured((values: { width: number }) => ({ px: `[${values.width}]` }))
  })
  test('rejects malformed definitions', () => {
    // @ts-expect-error empty targets
    Config.create({ shorthands: { px: [] } })
    // @ts-expect-error duplicate targets
    Config.create({ shorthands: { px: ['paddingLeft', 'paddingLeft'] } })
    // @ts-expect-error aliases cannot shadow standard properties
    Config.create({ shorthands: { padding: ['paddingLeft'] } })
    // @ts-expect-error aliases cannot target aliases
    Config.create({ shorthands: { px: ['paddingX'] } })
    const negative = Config.create({ vars: { padding: { bad: '-2px' } } })
    // @ts-expect-error padding declarations must be nonnegative
    negative.style({ padding: negative.vars.padding.bad })
  })
})
