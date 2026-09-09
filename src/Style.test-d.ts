/**
 * Checks consumer inference and rejected inputs through the public Style API.
 * @module
 */
import { expectTypeOf } from 'vite-plus/test'
import { Config, css, Style, Theme } from 'zyzz'
import { components } from '../test/fixtures/components.js'

const definition = Style.define(components)
expectTypeOf(definition.styles[0]!.name).toEqualTypeOf<
  'card' | 'hidden' | 'label'
>()
expectTypeOf(definition).toEqualTypeOf<
  Style.Definition<'card' | 'hidden' | 'label'>
>()
Style.define({
  valid: {
    color: '#fff',
    display: 'inherit',
    lineHeight: 1.5,
    margin: '-2rem',
    padding: 0,
  },
})
const typo = { card: { colour: '#fff', padding: '1rem' } } as const
// @ts-expect-error Excess properties must also fail through aliased input.
Style.define(typo)
// @ts-expect-error Unknown CSS properties are rejected.
Style.define({ card: { colour: '#fff' } })
// @ts-expect-error Core has no numeric spacing tokens.
Style.define({ card: { padding: 4 } })
// @ts-expect-error Core has no named tokens.
Style.define({ card: { color: 'blue.700' } })
// @ts-expect-error Invalid enum values cannot widen the contract.
Style.define({ card: { display: 'banana' } })
// @ts-expect-error Selectors are outside the literal subset.
Style.define({ card: { ':hover': { color: '#fff' } } })
// @ts-expect-error Callbacks are outside the literal subset.
Style.define({ card: () => ({ color: '#fff' }) })
// @ts-expect-error Undefined is not an authored CSS value.
Style.define({ card: { padding: undefined } })
// @ts-expect-error Data cannot be mutated after validation.
definition.styles.push({ declarations: [], name: 'card' })
// @ts-expect-error Declaration values are readonly.
definition.styles[0]!.declarations[0]!.value = '2px'
// @ts-expect-error Percentages are not border-width values.
Style.define({ card: { borderWidth: '10%' } })

const numeric = Style.define({ 0: { color: '#fff' }, 1.5: { padding: 0 } })
expectTypeOf(numeric).toEqualTypeOf<Style.Definition<'0' | '1.5'>>()

declare const invalidUnion: { color: '#fff' } | { colour: '#fff' }
// @ts-expect-error Every possible union branch must have supported keys.
Style.define({ card: invalidUnion })
declare const overlappingUnion: { padding: 0 } | { colour: '#fff'; padding: 0 }
// @ts-expect-error Shared valid properties must not hide a branch's typo.
Style.define({ card: overlappingUnion })
declare const callbackUnion: (() => { color: '#fff' }) | { color: '#fff' }
// @ts-expect-error A union with an executable branch is not literal data.
Style.define({ card: callbackUnion })
declare const validUnion: { color: '#fff' } | { padding: 0 }
expectTypeOf(Style.define({ card: validUnion })).toEqualTypeOf<
  Style.Definition<'card'>
>()

const theme = Theme.define({ color: { brand: '#06c' }, spacing: { 4: '1rem' } })
const themed = Style.define({ card: { color: 'brand', padding: 4 } }, { theme })
expectTypeOf(themed).toEqualTypeOf<Style.Definition<'card'>>()
// @ts-expect-error Theme inference cannot widen to accept unknown tokens.
Style.define({ card: { color: 'missing' } }, { theme })
// @ts-expect-error Tokens remain property-specific.
Style.define({ card: { padding: 'brand' } }, { theme })
// @ts-expect-error Names require an explicitly supplied theme.
Style.define({ card: { color: 'brand' } })

type Tokens = { color: { brand: '#06c' }; spacing: { 4: '1rem' } }
// @ts-expect-error A token-aware option bag requires a theme.
const missingTheme: Style.define.Options<Tokens> = {}
// @ts-expect-error A token-aware option bag cannot explicitly omit the theme.
const undefinedTheme: Style.define.Options<Tokens> = { theme: undefined }
void missingTheme
void undefinedTheme
const presentTheme: Style.define.Options<Tokens> = { theme }
expectTypeOf(
  Style.define({ card: { color: 'brand' } }, presentTheme),
).toEqualTypeOf<Style.Definition<'card'>>()
declare const optionalTheme: { theme?: typeof theme | undefined }
Style.define({ card: { color: '#fff' } }, optionalTheme)
// @ts-expect-error A potentially absent theme cannot enable shorthand names.
Style.define({ card: { color: 'brand' } }, optionalTheme)
// @ts-expect-error Explicit generic arguments cannot omit the required options.
Style.define<{ card: { color: 'brand' } }, Tokens>({ card: { color: 'brand' } })
if (optionalTheme.theme)
  Style.define({ card: { color: 'brand' } }, { theme: optionalTheme.theme })

css({
  display: ['block', 'flex!'],
  opacity: '0.5 !important',
  padding: [0, '8px!'],
})
const configured = Config.create({
  theme: { color: { brand: '#06c' }, spacing: { md: '8px' } },
})
configured.css({
  color: ['#fff', 'brand!', configured.theme.tokens.color.brand],
  padding: ['md!', 0],
})
Style.define({ card: { padding: ['1px', '2px !important'] } })
// @ts-expect-error Fallbacks are nonempty.
css({ color: [] })
// @ts-expect-error Fallback elements cannot be undefined.
css({ padding: ['8px', undefined] })
// @ts-expect-error Nested fallback arrays are unsupported.
css({ color: [['#fff']] })
// @ts-expect-error Importance does not widen the property domain.
css({ display: 'banana!' })
// @ts-expect-error Root styles remain token-free.
css({ color: ['brand!'] })
// @ts-expect-error Tokens retain their domain in fallback arrays.
configured.css({ padding: [configured.theme.tokens.color.brand] })

css({
  borderWidth: '1Q',
  height: ['100vh', '100dvh!'],
  marginLeft: '-2cqi',
  padding: '1lh',
  width: '80ch',
})
const lengthTheme = Theme.define({ spacing: { space: '2cqi' } })
Style.define({ card: { padding: 'space!' } }, { theme: lengthTheme })
// @ts-expect-error A time unit is not a CSS length.
css({ width: '1ms' })
// @ts-expect-error An unknown viewport suffix is not a CSS unit.
css({ height: '1dvheight' })
// @ts-expect-error Border widths still exclude percentages.
css({ borderWidth: '1%!' })
// @ts-expect-error Length tokens still retain their property domains.
lengthTheme.css({ color: lengthTheme.tokens.spacing.space })

const extendedLengths = Theme.extend(lengthTheme, {
  spacing: { space: '1dvh' },
})
expectTypeOf(extendedLengths).toEqualTypeOf<typeof lengthTheme>()
// @ts-expect-error Overrides cannot introduce token paths.
Theme.extend(lengthTheme, { spacing: { missing: '1lh' } })
// @ts-expect-error Overrides cannot change length tokens to colors.
Theme.extend(lengthTheme, { spacing: { space: '#fff' } })

// @ts-expect-error CSS lengths exclude hexadecimal numbers.
css({ width: '0x10dvh' })
// @ts-expect-error CSS lengths exclude binary numbers.
css({ width: '0b10lh!' })
// @ts-expect-error CSS lengths exclude octal numbers.
css({ padding: ['1px', '0o10cqi'] })
// @ts-expect-error Theme lengths use the same decimal grammar.
Theme.define({ spacing: { space: '0b10lh' } })
css({ width: '01dvh', height: '.5cqi', margin: '-1e-2lh', padding: '+0.5rem' })

// @ts-expect-error CSS numbers cannot contain whitespace before the unit.
css({ width: '10 dvh' })
// @ts-expect-error Style.define checks the same numeric spellings.
Style.define({ card: { padding: '0x10px' } })
// @ts-expect-error Config-bound values use the same inferred checks.
configured.css({ width: '0b10cqi!' })
const numericNames = Theme.define({ spacing: { '0x10px': '8px' } })
numericNames.css({ padding: '0x10px!' })

// @ts-expect-error Binary values also fail for units with overlapping suffixes.
css({ height: '0b10dvh' })
