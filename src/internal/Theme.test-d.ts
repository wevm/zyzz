/**
 * Checks consumer inference and rejected inputs through the internal scalar contract.
 * @module
 */
import { style as queriesStyle } from '../default.js'
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { style, Style, variable } from 'zyzz'
import * as Theme from './Theme.js'
import * as Config from './Configuration.js'
import { Css, global } from 'zyzz/web'

describe('define', () => {
  test('infers nested typography names and property domains', () => {
    const theme = Theme.define({
      typography: {
        heading: {
          32: {
            fontFamily: 'Geist',
            fontSize: '32px',
            fontWeight: 600,
            letterSpacing: '-1.28px',
            lineHeight: '40px',
          },
        },
        label: {
          14: {
            fontSize: '14px',
            mono: { fontFamily: 'Geist Mono', fontSize: '14px' },
          },
        },
      },
    })

    theme.style({ typography: 'heading.32' })
    theme.style({ typography: 'label.14.mono', fontWeight: 500 })
    theme.style({
      typography: 'heading.32 !important',
      ':hover': { typography: 'label.14' },
    })
    Style.define({ title: { typography: 'heading.32' } }, { vars: theme })
    expectTypeOf(theme.tokens.typography.heading[32].fontSize).toEqualTypeOf<
      Theme.Reference<'fontSize'>
    >()
    expectTypeOf(
      theme.tokens.typography.label[14].mono.fontFamily,
    ).toEqualTypeOf<Theme.Reference<'fontFamily'>>()

    Theme.extend(theme, {
      typography: { heading: { 32: { fontSize: '36px', fontWeight: 500 } } },
    })

    // @ts-expect-error A group is not a typography set.
    theme.style({ typography: 'heading' })
    // @ts-expect-error Scalar fields are not typography set names.
    theme.style({ typography: 'heading.32.fontSize' })
    // @ts-expect-error Typography names belong to the bound theme.
    theme.style({ typography: 'heading.48' })
    // @ts-expect-error Core authoring has no bundled typography.
    style({ typography: 'heading.32' })
    // @ts-expect-error Font-size references cannot be used as font weights.
    theme.style({ fontWeight: theme.tokens.typography.heading[32].fontSize })
    const added = {
      typography: { heading: { 48: { fontSize: '48px' } } },
    } as const
    const invalid = {
      typography: { heading: { 32: { fontSize: 'red' } } },
    } as const
    // @ts-expect-error Extensions retain the original typography paths.
    Theme.extend(theme, added)
    // @ts-expect-error Typography properties retain scalar validation.
    Theme.extend(theme, invalid)
    // @ts-expect-error Typography fields exclude unrelated properties.
    Theme.define({ typography: { body: { color: 'red' } } })
    // @ts-expect-error Typography weights retain the numeric range.
    Theme.define({ typography: { body: { fontWeight: 1001 } } })
    // @ts-expect-error Typography fields cannot contain nested palettes.
    Theme.define({ typography: { body: { fontSize: { small: '14px' } } } })
    // @ts-expect-error Font property names are reserved for scalar fields.
    Theme.define({ typography: { fontSize: { fontSize: '14px' } } })
  })

  test('infers immutable token references and validates token values', () => {
    const theme = Theme.define({
      backgroundColor: { surface: { dark: '#000', light: '#fff' } },
      borderRadius: { round: '1rem' },
      color: { blue: { 500: '#06c' } },
      spacing: { md: '1rem' },
      textColor: { foreground: '#000' },
    })

    expectTypeOf(theme.tokens.color.blue[500]).toEqualTypeOf<
      Theme.Reference<'color'>
    >()

    Style.define({
      card: {
        color: theme.tokens.color.blue[500],
        padding: theme.tokens.spacing.md,
      },
    })

    const alternate = Theme.extend(theme, {
      backgroundColor: { surface: '#fff' },
      spacing: { md: '2rem' },
    })
    const result = Css.compile({
      styles: Style.define({}),
      vars: { alternate, base: theme },
    })

    expectTypeOf<keyof typeof result.vars>().toEqualTypeOf<
      'alternate' | 'base'
    >()

    // @ts-expect-error Unknown scope labels remain unavailable.
    expectTypeOf(result.vars.missing)

    // @ts-expect-error Root style remains literal-only.
    style({ color: theme.tokens.color.blue[500] })
    // @ts-expect-error References cannot cross property domains.
    Style.define({ card: { padding: theme.tokens.color.blue[500] } })
    Style.define({
      // @ts-expect-error Text colors cannot be used as background tokens.
      card: { backgroundColor: theme.tokens.textColor.foreground },
    })
    // @ts-expect-error Unknown groups are rejected.
    Theme.define({ colours: { brand: '#000' } })
    // @ts-expect-error Scheme pairs must be complete.
    Theme.define({ color: { brand: { light: '#fff' } } })

    const extra = {
      color: { brand: { dark: '#000', light: '#fff', system: '#ccc' } },
    } as const

    // @ts-expect-error Scheme pairs reject extra fields, even through aliases.
    Theme.define(extra)
    // @ts-expect-error A length scale cannot contain colors.
    Theme.define({ spacing: { md: '#fff' } })
    // @ts-expect-error Public tokens are immutable.
    theme.tokens.spacing.md = alternate.tokens.spacing.md

    // @ts-expect-error Missing paths remain unavailable.
    expectTypeOf(theme.tokens.color.missing)

    const annotated: Theme.Tokens = {
      color: { brand: '#fff' },
      spacing: undefined,
    }

    expectTypeOf(Theme.define(annotated)).toEqualTypeOf<Theme.Definition>()

    const overrides: Theme.Overrides<typeof annotated> = {
      color: { brand: '#000' },
    }

    Theme.extend(Theme.define(annotated), overrides)
    // @ts-expect-error Unsupported scalar colors fail at authoring time.
    Theme.define({ color: { brand: 'not-a-color' } })
    // @ts-expect-error Both scheme values use the supported color grammar.
    Theme.define({ color: { brand: { dark: 'not-a-color', light: '#fff' } } })
  })

  test('omits explicitly undefined token groups', () => {
    const omitted = Theme.define({
      color: { brand: '#fff' },
      spacing: undefined,
    })

    expectTypeOf(omitted.className).toEqualTypeOf<string>()

    // @ts-expect-error Theme scope properties are readonly.
    omitted.className = 'external'
    omitted.style({ color: 'brand', padding: '1rem' })
    // @ts-expect-error An explicitly undefined group contributes no token names.
    omitted.style({ padding: 'missing' })
    // @ts-expect-error Undefined groups do not enable shorthand in named styles.
    Style.define({ card: { padding: 'missing' } }, { vars: omitted })
  })

  test('rejects reserved token keys', () => {
    // @ts-expect-error Exclamation marks are reserved for declaration importance.
    Theme.define({ spacing: { 'md!': '8px' } })
    // @ts-expect-error Nested palette keys cannot use importance syntax.
    Theme.define({ spacing: { 'nested!': { md: '8px' } } })
    // @ts-expect-error Config inline themes use the same token-key contract.
    Config.create({ theme: { spacing: { 'md!important': '8px' } } })
    Config.create({
      defaultTheme: 'light',
      // @ts-expect-error Named theme alternatives also reject reserved keys.
      themes: { light: { spacing: { 'md!IMPORTANT': '8px' } } },
    })
  })
})

describe('extend', () => {
  test('preserves token contracts and validates overrides', () => {
    const theme = Theme.define({
      backgroundColor: { surface: { dark: '#000', light: '#fff' } },
      borderRadius: { round: '1rem' },
      color: { blue: { 500: '#06c' } },
      spacing: { md: '1rem' },
      textColor: { foreground: '#000' },
    })

    const alternate = Theme.extend(theme, {
      backgroundColor: { surface: '#fff' },
      spacing: { md: '2rem' },
    })

    expectTypeOf(alternate).toEqualTypeOf<typeof theme>()

    // @ts-expect-error New leaves change the contract.
    Theme.extend(theme, { spacing: { lg: '2rem' } })
    // @ts-expect-error New groups change the contract.
    Theme.extend(theme, { borderColor: { outline: '#fff' } })
    // @ts-expect-error Partial pair overrides are invalid.
    Theme.extend(theme, { backgroundColor: { surface: { light: '#fff' } } })
    // @ts-expect-error Unknown nested paths are invalid.
    Theme.extend(theme, { color: { blue: { 600: '#fff' } } })
    // @ts-expect-error Extended colors use the same grammar.
    Theme.extend(theme, { color: { blue: { 500: 'not-a-color' } } })

    const extraOverride = {
      backgroundColor: {
        surface: { dark: '#000', light: '#fff', system: '#ccc' },
      },
    } as const

    // @ts-expect-error Extensions reject extra scheme fields through aliased values.
    Theme.extend(theme, extraOverride)

    // @ts-expect-error Explicit undefined cannot replace a length token.
    Theme.extend(theme, { spacing: { md: undefined } })
    // @ts-expect-error Explicit undefined cannot replace a color token.
    Theme.extend(theme, { color: { blue: { 500: undefined } } })
    // @ts-expect-error Explicit undefined cannot replace a nested palette.
    Theme.extend(theme, { color: { blue: undefined } })

    const possiblyMissing = {} as '1lh' | undefined

    // @ts-expect-error An aliased optional value is also invalid as an override.
    Theme.extend(theme, { spacing: { md: possiblyMissing } })

    // @ts-expect-error A length leaf cannot become an empty object.
    Theme.extend(theme, { spacing: { md: {} } })
    // @ts-expect-error A length leaf cannot become an array.
    Theme.extend(theme, { spacing: { md: [] } })
    // @ts-expect-error A length leaf cannot become a function.
    Theme.extend(theme, { spacing: { md: () => '2rem' } })

    // @ts-expect-error Theme overrides reject nondecimal length spellings too.
    Theme.extend(theme, { spacing: { md: '0x10px' } })
  })
})

describe('style', () => {
  test('extracted parameters preserve tokens without weakening inferred declarations', () => {
    const { style: themed } = Theme.define({
      color: { brand: '#06c' },
      spacing: { md: '8px' },
    })

    type ParametersStyle = Parameters<typeof themed>[0]

    const extracted: ParametersStyle = {
      color: 'brand',
      padding: ['md', '2px !important'],
    }

    themed(extracted)

    // @ts-expect-error Extracted parameter types retain token domains.
    const wrongDomain: ParametersStyle = { color: 'md' }

    void wrongDomain

    const unknown: Record<string, unknown> = { color: 'red' }

    // @ts-expect-error An arbitrary key/value record cannot bypass exact declarations.
    themed(unknown)

    const callable = Object.assign(() => null, { color: 'red' as const })

    // @ts-expect-error Callable objects are not declaration records.
    themed(callable)
    // @ts-expect-error Inferred dimensions still reject hexadecimal numeric prefixes.
    themed({ padding: '0x10px' })
    // @ts-expect-error Inferred dimensions still reject non-CSS whitespace within numeric values.
    themed({ padding: '2 px' })
    themed({ padding: ' 2px' })
    // @ts-expect-error Unknown properties remain rejected alongside known properties.
    themed({ color: 'brand', colour: 'red' })
    // @ts-expect-error Ordered fallbacks cannot be empty.
    themed({ color: [] })
  })

  test('preserves token inference through aliases and applied styles', () => {
    const shorthand = Theme.define({
      backgroundColor: { surface: '#fff' },
      borderColor: { outline: '#000' },
      borderRadius: { round: '1rem' },
      color: { blue: { 500: '#06c' }, brand: '#06c' },
      spacing: { 4: '1rem', md: '2rem' },
      textColor: { foreground: '#111' },
    })

    const { style: themedStyle } = shorthand
    const memberStyle = shorthand.style
    const chainedStyle = memberStyle
    const renamedStyle = themedStyle

    expectTypeOf(memberStyle).toEqualTypeOf<typeof shorthand.style>()
    expectTypeOf(chainedStyle).toEqualTypeOf<typeof shorthand.style>()
    expectTypeOf(renamedStyle).toEqualTypeOf<typeof shorthand.style>()
    expectTypeOf(
      chainedStyle({ color: 'brand', padding: 4 }),
    ).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(
      renamedStyle({ color: 'blue.500', padding: 'md' })(),
    ).toEqualTypeOf<style.Props>()

    // @ts-expect-error Member aliases reject undeclared token paths.
    memberStyle({ color: 'blue.600' })
    // @ts-expect-error Alias chains retain token domains.
    chainedStyle({ color: 'md' })
    // @ts-expect-error Renamed destructured aliases reject unknown properties.
    renamedStyle({ colour: 'brand' })
    // @ts-expect-error Chained aliases require declared numeric spacing keys.
    chainedStyle({ padding: 5 })
    renamedStyle({ padding: 'md' })({
      // @ts-expect-error Inline overrides cannot resolve structured theme references.
      style: { padding: shorthand.tokens.spacing.md },
    })

    expectTypeOf(
      chainedStyle({
        color: shorthand.tokens.color.blue[500],
        padding: shorthand.tokens.spacing[4],
      }),
    ).toEqualTypeOf<style.ReturnType>()

    // @ts-expect-error Explicit spacing references retain their domain through aliases.
    renamedStyle({ color: shorthand.tokens.spacing.md })
    // @ts-expect-error Explicit palette paths must exist.
    memberStyle({ color: shorthand.tokens.color.blue[600] })
    // @ts-expect-error Token groups are not scalar references.
    chainedStyle({ color: shorthand.tokens.color })
    // @ts-expect-error Root style remains token-free.
    style({ color: shorthand.tokens.color.brand })

    const themedCard = themedStyle({
      backgroundColor: 'surface',
      borderRadius: 'round',
      color: 'blue.500',
      padding: 4,
    })

    expectTypeOf(themedCard).toEqualTypeOf<style.ReturnType>()
    expectTypeOf(
      themedCard({ className: 'external', style: { padding: '2rem' } }),
    ).toEqualTypeOf<style.Props>()

    Theme.extend(shorthand, { spacing: { 4: '2rem' } }).style({ padding: 4 })
    themedStyle({ color: 'foreground', padding: 'md' })
    themedStyle({ color: shorthand.tokens.color.brand, padding: 0 })
    // @ts-expect-error Unknown theme paths are rejected.
    themedStyle({ color: 'blue.600' })
    // @ts-expect-error A text token cannot be used as a background.
    themedStyle({ backgroundColor: 'foreground' })
    // @ts-expect-error Spacing tokens cannot become colors.
    themedStyle({ color: 'md' })
    // @ts-expect-error Nonzero numeric spacing requires a declared key.
    themedStyle({ padding: 5 })
    // @ts-expect-error Inline overrides cannot resolve structured theme references.
    themedCard({ style: { padding: shorthand.tokens.spacing.md } })
    // @ts-expect-error Unknown properties are rejected.
    themedStyle({ colour: 'brand' })
    // @ts-expect-error Root authoring does not inherit the imported theme.
    style({ color: 'brand' })
  })
})

describe('queries', () => {
  describe('define', () => {
    test('checks literal container identities', () => {
      Theme.define({ containerNames: ['--sidebar', '-sidebar', '侧栏'] })
      // @ts-expect-error Literal identities must be unique.
      Theme.define({ containerNames: ['sidebar', 'sidebar'] })
      // @ts-expect-error Container query operators cannot name containers.
      Theme.define({ containerNames: ['and'] })
    })
    test('rejects reserved container identities', () => {
      // @ts-expect-error Container identities exclude reserved keywords.
      Theme.define({ containerNames: ['none'] })
      // @ts-expect-error Container keywords are case insensitive.
      Theme.define({ containerNames: ['INITIAL'] })
    })

    test('rejects CSS-wide typography leaves', () => {
      // @ts-expect-error Typography leaves cannot override CSS-wide keywords.
      Theme.define({ fontFamily: { body: 'inherit' } })
      // @ts-expect-error CSS-wide keywords are case insensitive.
      Theme.define({ fontFamily: { body: 'INITIAL' } })
    })

    test('retains scalar domains', () => {
      const theme = Theme.define({
        breakpoints: { tablet: '48rem' },
        containers: { card: '24rem' },
        fontSize: { body: '1rem' },
        fontWeight: { medium: 500 },
      })

      theme.style({ fontSize: 'body', fontWeight: 'medium' })
      queriesStyle({
        fontFamily: 'sans',
        fontSize: 'base',
        color: 'blue.500',
        padding: 4,
      })

      const odd = Theme.define({ spacing: { '01': '1px', '1e3': '2px' } })

      odd.style({ padding: '01' })
      // @ts-expect-error Noncanonical numeric keys cannot widen shorthand numbers.
      odd.style({ padding: 999 })
      Config.create({
        defaultTheme: 'base',
        themes: {
          base: { containerNames: ['sidebar'] },
          // @ts-expect-error Named themes must expose the same container identities.
          other: { containerNames: ['content'] },
        },
      })
      // @ts-expect-error Thresholds are nonnegative.
      Theme.define({ breakpoints: { bad: '-1px' } })
      // @ts-expect-error Font weights cannot exceed 1000.
      Theme.define({ fontWeight: { bad: 2000 } })
      // @ts-expect-error Font sizes cannot be negative.
      Theme.define({ fontSize: { bad: '-1px' } })
      // @ts-expect-error Line heights cannot be negative.
      Theme.define({ lineHeight: { bad: -1 } })
      // @ts-expect-error CSS-wide keywords cannot be custom-property token leaves.
      Theme.define({ fontSize: { bad: 'initial' } })
      // @ts-expect-error Query metadata is not a declaration variable.
      void theme.vars.breakpoints.tablet
      // @ts-expect-error Query metadata is not a portable declaration reference.
      void theme.tokens.containers.card
      // @ts-expect-error Query lengths cannot be percentages.
      Theme.define({ breakpoints: { tablet: '50%' } })
      // @ts-expect-error Typography references retain their scalar property domain.
      theme.style({ color: theme.tokens.fontSize.body })
    })
  })
})

describe('variables', () => {
  describe('define', () => {
    test('accepts color expressions and static variable assignments', () => {
      const theme = Theme.define({
        color: { surface: { light: 'red', dark: 'blue' } },
      })
      const color = variable('color')

      const box = theme.style({
        variables: { [color]: theme.vars.color.surface },
        backgroundImage: `linear-gradient(${theme.vars.color.surface}, transparent)`,
        boxShadow: `0 0 2px ${theme.vars.color.surface}`,
      })
      box()
      global({ ':root': { '--surface': theme.vars.color.surface } })
      theme.style({ color: `${theme.vars.color.surface} !important` })
      // @ts-expect-error Template-friendly references retain direct property domains.
      theme.style({ width: theme.vars.color.surface })
      // @ts-expect-error Fallbacks retain reference domains.
      theme.style({ width: ['1px', theme.vars.color.surface] })
      // @ts-expect-error Root styles cannot consume theme references through fallbacks.
      style({ color: ['red', theme.vars.color.surface] })

      // @ts-expect-error A color alone is not an image.
      theme.style({ backgroundImage: theme.vars.color.surface })
    })
    test('retains web reference domains and config inference', () => {
      const theme = Theme.define({
        color: { brand: 'red' },
        spacing: { md: '8px' },
      })

      theme.style({
        color: theme.vars.color.brand,
        // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions -- Source compilation consumes this reference before coercion.
        width: `calc(100% - ${theme.vars.spacing.md})`,
      })
      theme.style({ padding: [theme.vars.spacing.md, '2px'] })
      theme.style({ color: theme.vars.color.brand })
      // @ts-expect-error Variable domains cannot cross properties.
      theme.style({ color: theme.vars.spacing.md })
      // @ts-expect-error Spacing variables cannot represent integer counts.
      theme.style({ maxLines: theme.vars.spacing.md })
      // @ts-expect-error Undeclared variables are unavailable.
      theme.style({ width: theme.vars.spacing.missing })
      // @ts-expect-error Root style has no theme reference contract.
      style({ width: theme.vars.spacing.md })
      // @ts-expect-error marginTrim is a keyword grammar, not a length.
      theme.style({ marginTrim: theme.vars.spacing.md })

      const config = Config.create({ theme })

      expectTypeOf(config.theme.vars.color.brand).toEqualTypeOf<
        typeof theme.vars.color.brand
      >()
    })
  })
})
