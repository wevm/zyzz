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
    Vars.define({ ink: '#fff' }, (vars) => ({
      invalid: '#ggg',
      alias: vars.ink,
    }))
    // @ts-expect-error Derived conditional branches retain the base value domain.
    Vars.define({ ink: '#fff' }, (vars) => ({
      alias: vars.ink,
      size: { default: '4px', '@media (min-width: 600px)': '#fff' },
    }))
    Vars.define({ ink: '#fff' }, { id: 'existing' })
  })
  test('retains query-like names inside categories', () => {
    const vars = Vars.define({ color: { container: '#fff' } })
    expectTypeOf(vars.color.container.group).toEqualTypeOf<'color'>()
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
      propertyGroups: { padding: ['spacing'], backgroundColor: ['surface'] },
    })
    config.style({
      color: 'accent',
      padding: 'page',
      backgroundColor: 'panel',
      width: config.vars.spacing.page,
    })
    // Omitted properties retain their default group lookup.
    config.style({ width: 'page' })
    // @ts-expect-error unknown shorthand
    config.style({ color: 'missing' })
    // @ts-expect-error color references do not supply lengths
    config.style({ width: config.vars.color.accent })
    const disabled = Config.create({
      vars: base,
      propertyGroups: { color: [] },
    })
    // @ts-expect-error disabled property
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
    breakpoint: { tablet: '48rem' },
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
    propertyGroups: {
      padding: ['mixed'],
      opacity: ['mixed'],
      zIndex: ['mixed'],
    },
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
        breakpoint: { desktop: '800px' },
      },
      propertyGroups: false,
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
    config.style({ width: 'breakpoint.desktop' })
    // @ts-expect-error unknown full path
    config.style({ color: 'surface.missing' })
  })
})

test('infers Tailwind fallback categories without changing font categories', () => {
  const config = Config.create({
    vars: {
      spacing: { space: '16px', percent: '10%' },
      container: { wide: '640px' },
      height: { tall: '320px' },
      radius: { round: '8px' },
      shadow: { soft: '0 2px 4px #0003' },
      blur: { soft: '2px' },
      aspect: { video: '16 / 9' },
      ease: { out: 'ease-out' },
      textDecorationThickness: { stroke: '2px' },
      textUnderlineOffset: { offset: '4px' },
      fontSize: { body: '16px' },
      lineHeight: { body: '24px' },
    },
  })
  config.style({
    width: 'wide',
    minWidth: 'wide',
    inlineSize: 'wide',
    flexBasis: 'wide',
    columns: 'wide',
    minHeight: 'tall',
    maxHeight: 'tall',
    scrollMarginTop: 'space',
    scrollPaddingTop: 'space',
    borderSpacing: 'space',
    translate: 'space',
    borderRadius: 'round',
    boxShadow: 'soft',
    aspectRatio: 'video',
    transitionTimingFunction: 'out',
    textDecorationThickness: 'stroke',
    textUnderlineOffset: 'offset',
    fontSize: 'body',
    lineHeight: 'body',
  })
  config.style({
    width: config.vars.container.wide,
    filter: `blur(${config.vars.blur.soft})`,
  })
  // @ts-expect-error Containers do not supply heights.
  config.style({ height: 'wide' })
  // @ts-expect-error Font groups do not fall back to spacing.
  config.style({ lineHeight: 'space' })
  // @ts-expect-error Decoration thickness has a dedicated category.
  config.style({ textDecorationThickness: 'space' })
  // @ts-expect-error Underline offsets have a dedicated category.
  config.style({ textUnderlineOffset: 'space' })
  // @ts-expect-error Border spacing does not accept percentages.
  config.style({ borderSpacing: 'percent' })
  // @ts-expect-error Blur requires an explicit CSS function.
  config.style({ filter: 'soft' })
  const explicit = Config.create({
    vars: { container: { wide: '640px' } },
    propertyGroups: false,
  })
  explicit.style({ width: 'container.wide' })
})

test('infers numeric and compound token names', () => {
  const { style } = Config.create({
    vars: {
      gridColumn: { pair: 'span 2' },
      gridColumnStart: { second: 2 },
      columns: { pair: 2 },
      scale: { large: 1.25 },
      strokeWidth: { bold: 2 },
      listStyleType: { named: 'custom-counter' },
      transitionProperty: { fade: 'opacity' },
      gridTemplateColumns: { split: '20px 1fr' },
      backgroundPosition: { offset: '10px' },
    },
  })
  style({
    gridColumn: 'pair',
    gridColumnStart: 'second',
    columns: 'pair',
    scale: 'large',
    strokeWidth: 'bold',
    listStyleType: 'named',
    transitionProperty: 'fade',
    gridTemplateColumns: 'split',
    backgroundPosition: 'offset',
  })
})

test('infers ordered property groups and rejects invalid properties', () => {
  const config = Config.create({
    vars: {
      width: { narrow: '4px' },
      spacing: { gap: '8px' },
      container: { wide: '16px' },
      palette: { ink: '#fff' },
    },
    propertyGroups: {
      width: ['width', 'spacing', 'container'],
      height: [],
      color: ['palette'],
    },
  })
  config.style({ width: 'narrow' })
  config.style({ width: 'gap' })
  config.style({ width: 'wide', color: 'ink', padding: 'gap' })
  // @ts-expect-error Disabled property lookup.
  config.style({ height: 'gap' })
  config.style({ height: config.vars.spacing.gap })
  // @ts-expect-error Unlisted groups cannot supply names.
  config.style({ backgroundColor: 'ink' })
  Config.create({
    vars: { spacing: { gap: '8px' } },
    // @ts-expect-error CSS property names are required.
    propertyGroups: { unknown: ['spacing'] },
  })
  Config.create({
    vars: { spacing: { gap: '8px' } },
    // @ts-expect-error Removed category-to-property API.
    mappings: { spacing: ['width'] },
  })
})

test('uses the first matching group for value domains', () => {
  const { style } = Config.create({
    vars: {
      palette: { shared: '#fff' },
      spacing: { shared: '8px', gap: '16px' },
    },
    propertyGroups: { width: ['palette', 'spacing'] },
  })
  style({ width: 'gap' })
  // @ts-expect-error The first matching token is a color, not a length.
  style({ width: 'shared' })
})
