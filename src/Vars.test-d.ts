/** Checks variable reference domains and configured token inference. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import * as Zyzz from 'zyzz'
import { Config, Vars } from 'zyzz'

describe('define', () => {
  test('infers deeply merged derived references', () => {
    const base = Vars.define(
      { color: { palette: { ink: '#123456' } }, spacing: { small: '4px' } },
      (vars) => {
        expectTypeOf(vars.color.palette.ink.group).toEqualTypeOf<'color'>()
        // @ts-expect-error Derived paths are not available in the callback.
        void vars.color.foreground
        return {
          color: { foreground: vars.color.palette.ink },
          spacing: { large: '16px' },
        }
      },
      { id: 'derived' },
    )
    expectTypeOf(base.color.foreground.group).toEqualTypeOf<'color'>()
    expectTypeOf(base.color.palette.ink.group).toEqualTypeOf<'color'>()
    expectTypeOf(base.spacing.large.group).toEqualTypeOf<'spacing'>()
    const other = Vars.extend(base, { color: { palette: { ink: '#abcdef' } } })
    const { style } = Config.create({
      vars: { base, other },
      defaultVars: 'base',
    })
    style({ color: 'foreground', padding: 'large' })
    // @ts-expect-error Color references cannot supply lengths.
    style({ width: base.color.foreground })
    // @ts-expect-error Derived values must satisfy literal validation.
    Vars.define({ ink: '#fff' }, (vars) => ({ invalid: '#ggg', alias: vars.ink }))
    // @ts-expect-error Derived conditional branches retain the base value domain.
    Vars.define({ ink: '#fff' }, (vars) => ({
      alias: vars.ink,
      size: { default: '4px', '@media (min-width: 600px)': '#fff' },
    }))
    Vars.define({ ink: '#fff' }, { id: 'existing' })
  })
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

test('infers responsive typography and border widths', () => {
  const base = Vars.define({
    borderWidth: { regular: '2px' },
    breakpoints: { tablet: '48rem' },
    typography: {
      heading: { fontSize: '24px', '@media >=tablet': { fontSize: '40px' } },
    },
  })
  const other = Vars.extend(base, {
    typography: { heading: { '@media >=tablet': { fontSize: '44px' } } },
  })
  const { style } = Config.create({
    vars: { base, other },
    defaultVars: 'base',
  })
  style({ typography: 'heading', borderInlineStartWidth: 'regular' })
  // @ts-expect-error Border-width tokens do not apply to border-image widths.
  style({ borderImageWidth: 'regular' })
})

test('validates mapped leaf values and optional selections', () => {
  const base = Vars.define({
    mixed: {
      ink: '#fff',
      gap: '4px',
      negative: '-4px',
      nested: { gap: '8px' },
      opacity: 0.5,
      order: 2,
    },
  })
  const { style, vars } = Config.create({
    vars: base,
    mappings: { mixed: ['padding', 'opacity', 'zIndex'] },
  })
  style({ padding: 'gap', opacity: 'opacity', zIndex: 'order' })
  style({ padding: 'nested.gap' })
  // @ts-expect-error Color leaves cannot supply padding.
  style({ padding: 'ink' })
  // @ts-expect-error Padding cannot be negative.
  style({ padding: 'negative' })
  // @ts-expect-error Z-index requires an integer.
  style({ zIndex: 'opacity' })
  vars({ set: undefined })
  const config = Config.create({
    vars: { base, other: Vars.extend(base, {}) },
    defaultVars: 'base',
  })
  const selection: 'base' | 'other' | undefined = undefined as
    | 'base'
    | 'other'
    | undefined
  config.vars({ set: selection })
})

test('accepts root scalar names and restricts arrays to root containerNames', () => {
  const vars = Vars.define({
    light: '8px',
    dark: 2,
    default: 'red',
    containerNames: ['card'],
  })
  expectTypeOf(vars.light.group).toEqualTypeOf<'spacing'>()
  expectTypeOf(vars.dark.group).toEqualTypeOf<'number'>()
  expectTypeOf(vars.default.group).toEqualTypeOf<'color'>()
  // @ts-expect-error Nested arrays are not variable leaves.
  Vars.define({ spacing: { scale: ['4px'] } })
  // @ts-expect-error Arrays are only root containerNames metadata.
  Vars.define({ scale: ['4px'] })
  // @ts-expect-error Nested containerNames are ordinary variables.
  Vars.define({ spacing: { containerNames: ['card'] } })
  // @ts-expect-error Root variable keys cannot contain dots.
  Vars.define({ 'color.ink': '#fff' })
})

describe('full paths', () => {
  test('accepts compatible paths across categories', () => {
    const config = Config.create({
      vars: {
        surface: { nested: { ink: '#123456' } },
        spacing: { page: '16px' },
        opacity: { muted: 0.5 },
        breakpoints: { desktop: '800px' },
      },
      mappings: false,
      shorthands: { px: ['paddingLeft', 'paddingRight'] },
    })
    config.style({
      color: 'surface.nested.ink',
      backgroundColor: 'surface.nested.ink !important',
      width: 'spacing.page',
      px: 'spacing.page',
      opacity: 'opacity.muted',
      ':hover': { color: config.vars.surface.nested.ink },
    })
    // @ts-expect-error full paths replace category shortcuts
    config.style({ width: 'page' })
    // @ts-expect-error colors cannot be used as lengths
    config.style({ width: 'surface.nested.ink' })
    // @ts-expect-error lengths cannot be used as colors
    config.style({ color: 'spacing.page' })
    // @ts-expect-error query metadata does not declare a variable
    config.style({ width: 'breakpoints.desktop' })
    // @ts-expect-error unknown full path
    config.style({ color: 'surface.missing' })
  })
})
