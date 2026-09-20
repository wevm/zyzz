/** Checks variable reference domains and configured token inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import * as Zyzz from 'zyzz'
import { Config, Vars } from 'zyzz'

describe('define', () => {
  test('retains query-like names inside categories', () => {
    const vars = Vars.define({ color: { containers: '#fff' } })
    expectTypeOf(vars.color.containers.group).toEqualTypeOf<'color'>()
  })
  test('infers mapped names and explicit reference domains', () => {
    const base = Vars.define({
      color: { accent: '#2563eb' },
      spacing: {
        page: { default: '16px', '@media (min-width: 768px)': '32px' },
      },
      surface: { panel: '#fff' },
    })
    const config = Config.create({
      vars: base,
      mappings: { spacing: ['padding'], surface: ['backgroundColor'] },
    })
    config.style({
      color: 'accent',
      padding: 'page',
      backgroundColor: 'panel',
      width: config.vars.spacing.page,
    })
    // @ts-expect-error spacing mapping replaces the default width mapping
    config.style({ width: 'page' })
    // @ts-expect-error unknown shorthand
    config.style({ color: 'missing' })
    // @ts-expect-error color references do not supply lengths
    config.style({ width: config.vars.color.accent })
    const disabled = Config.create({ vars: base, mappings: { color: [] } })
    // @ts-expect-error disabled category
    disabled.style({ color: 'accent' })
    disabled.style({ color: disabled.vars.color.accent })
    expectTypeOf(config.vars.color.accent.group).toEqualTypeOf<'color'>()
  })
  test('checks conditional domains and explicit string references', () => {
    Vars.define({
      // @ts-expect-error media branches must retain the default domain
      size: { default: '16px', '@media (min-width: 600px)': '#fff' },
    })
    // @ts-expect-error media leaves require a default
    Vars.define({ size: { '@media (min-width: 600px)': '16px' } })
    const config = Config.create({
      vars: { misc: { face: 'Inter', length: '16px', negative: '-16px' } },
    })
    config.style({
      fontFamily: config.vars.misc.face,
      borderRadius: config.vars.misc.length,
    })
    // @ts-expect-error string references still require a compatible property
    config.style({ width: config.vars.misc.face })
    // @ts-expect-error padding cannot be negative
    config.style({ padding: config.vars.misc.negative })
  })
  test('selects compatible named sets', () => {
    const base = Vars.define({ color: { accent: '#2563eb' } })
    const alternate = Vars.extend(base, { color: { accent: '#9333ea' } })
    const config = Config.create({
      vars: { base, alternate },
      defaultVars: 'base',
    })
    config.vars({ set: 'alternate', colorScheme: 'dark' })
    // @ts-expect-error unknown set
    config.vars({ set: 'missing' })
    const invalid = {
      vars: { base, alternate },
      defaultVars: 'missing',
    } as const
    // @ts-expect-error unknown default
    Config.create(invalid)
    const mismatched = {
      vars: {
        base,
        other: Vars.define({ color: { other: '#fff' } }),
      },
      defaultVars: 'base',
    } as const
    // @ts-expect-error sets must share paths
    Config.create(mismatched)
    const wrongDomain = {
      vars: {
        base,
        other: Vars.define({ color: { accent: '16px' } }),
      },
      defaultVars: 'base',
    } as const
    // @ts-expect-error sets must share scalar domains
    Config.create(wrongDomain)
    // @ts-expect-error extensions cannot add paths
    Vars.extend(base, { color: { other: '#fff' } })
  })
})

test('exposes one variable API', () => {
  // @ts-expect-error Removed public module.
  void Zyzz.Theme
  // @ts-expect-error Use Vars.
  void Zyzz.Variables
  // @ts-expect-error Use vars.
  Config.create({ theme: {} })
  // @ts-expect-error Use vars and defaultVars.
  Config.create({ themes: { base: {} }, defaultTheme: 'base' })
  const config = Config.create({ vars: { color: { ink: 'red' } } })
  config.vars()
  config.vars({ colorScheme: 'dark' })
  // @ts-expect-error Use set.
  config.vars({ theme: 'default' })
  // @ts-expect-error Removed helper.
  void config.theme
  // @ts-expect-error Removed catalog helper.
  void config.themes
  const html = Config.create({
    vars: { color: { ink: 'red' } },
    output: 'html',
  })
  expectTypeOf(html.vars().class).toEqualTypeOf<string>()
})
