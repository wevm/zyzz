/** Checks variable reference domains and configured token inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, Variables } from 'zyzz'

describe('define', () => {
  test('infers mapped names and explicit reference domains', () => {
    const base = Variables.define({
      color: { accent: '#2563eb' },
      spacing: {
        page: { default: '16px', '@media (min-width: 768px)': '32px' },
      },
      surface: { panel: '#fff' },
    })
    const config = Config.create({
      variables: base,
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
    const disabled = Config.create({ variables: base, mappings: { color: [] } })
    // @ts-expect-error disabled category
    disabled.style({ color: 'accent' })
    disabled.style({ color: disabled.vars.color.accent })
    expectTypeOf(config.vars.color.accent.group).toEqualTypeOf<'color'>()
  })
  test('checks conditional domains and explicit string references', () => {
    Variables.define({
      // @ts-expect-error media branches must retain the default domain
      size: { default: '16px', '@media (min-width: 600px)': '#fff' },
    })
    // @ts-expect-error media leaves require a default
    Variables.define({ size: { '@media (min-width: 600px)': '16px' } })
    const config = Config.create({
      variables: { misc: { face: 'Inter', length: '16px', negative: '-16px' } },
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
    const base = Variables.define({ color: { accent: '#2563eb' } })
    const alternate = Variables.extend(base, { color: { accent: '#9333ea' } })
    const config = Config.create({
      variables: { base, alternate },
      defaultVariables: 'base',
    })
    config.variables({ set: 'alternate', colorScheme: 'dark' })
    // @ts-expect-error unknown set
    config.variables({ set: 'missing' })
    const invalid = {
      variables: { base, alternate },
      defaultVariables: 'missing',
    } as const
    // @ts-expect-error unknown default
    Config.create(invalid)
    const mismatched = {
      variables: {
        base,
        other: Variables.define({ color: { other: '#fff' } }),
      },
      defaultVariables: 'base',
    } as const
    // @ts-expect-error sets must share paths
    Config.create(mismatched)
    const wrongDomain = {
      variables: {
        base,
        other: Variables.define({ color: { accent: '16px' } }),
      },
      defaultVariables: 'base',
    } as const
    // @ts-expect-error sets must share scalar domains
    Config.create(wrongDomain)
    // @ts-expect-error extensions cannot add paths
    Variables.extend(base, { color: { other: '#fff' } })
  })
})
