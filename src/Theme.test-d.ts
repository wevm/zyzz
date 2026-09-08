/**
 * Checks consumer inference and rejected inputs through the public Theme API.
 * @module
 */
import { expectTypeOf } from 'vite-plus/test'
import { css, Style, Theme } from 'zyzz'
import { Css } from 'zyzz/web'

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
expectTypeOf(alternate).toEqualTypeOf<typeof theme>()
const result = Css.compile({
  styles: Style.define({}),
  themes: { alternate, base: theme },
})
expectTypeOf<keyof typeof result.themes>().toEqualTypeOf<'alternate' | 'base'>()
// @ts-expect-error Unknown scope labels remain unavailable.
expectTypeOf(result.themes.missing)
// @ts-expect-error Root css remains literal-only.
css({ color: theme.tokens.color.blue[500] })
// @ts-expect-error References cannot cross property domains.
Style.define({ card: { padding: theme.tokens.color.blue[500] } })
// @ts-expect-error Text colors cannot be used as background tokens.
Style.define({ card: { backgroundColor: theme.tokens.textColor.foreground } })
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
// @ts-expect-error New leaves change the contract.
Theme.extend(theme, { spacing: { lg: '2rem' } })
// @ts-expect-error New groups change the contract.
Theme.extend(theme, { borderColor: { outline: '#fff' } })
// @ts-expect-error Partial pair overrides are invalid.
Theme.extend(theme, { backgroundColor: { surface: { light: '#fff' } } })
// @ts-expect-error Unknown nested paths are invalid.
Theme.extend(theme, { color: { blue: { 600: '#fff' } } })
// @ts-expect-error Public tokens are immutable.
theme.tokens.spacing.md = alternate.tokens.spacing.md
// @ts-expect-error Missing paths remain unavailable.
expectTypeOf(theme.tokens.color.missing)

const extraOverride = {
  backgroundColor: { surface: { dark: '#000', light: '#fff', system: '#ccc' } },
} as const
// @ts-expect-error Extensions reject extra scheme fields through aliased values.
Theme.extend(theme, extraOverride)

const annotated: Theme.Tokens = { color: { brand: '#fff' }, spacing: undefined }
expectTypeOf(Theme.define(annotated)).toEqualTypeOf<Theme.Definition>()
const overrides: Theme.Overrides<typeof annotated> = {
  color: { brand: '#000' },
}
Theme.extend(Theme.define(annotated), overrides)
// @ts-expect-error Unsupported scalar colors fail at authoring time.
Theme.define({ color: { brand: 'red' } })
// @ts-expect-error Both scheme values use the supported color grammar.
Theme.define({ color: { brand: { dark: 'red', light: '#fff' } } })
// @ts-expect-error Extended colors use the same grammar.
Theme.extend(theme, { color: { blue: { 500: 'red' } } })

const shorthand = Theme.define({
  backgroundColor: { surface: '#fff' },
  borderColor: { outline: '#000' },
  borderRadius: { round: '1rem' },
  color: { blue: { 500: '#06c' }, brand: '#06c' },
  spacing: { 4: '1rem', md: '2rem' },
  textColor: { foreground: '#111' },
})
const { css: themedCss } = shorthand
const themedCard = themedCss({
  backgroundColor: 'surface',
  borderRadius: 'round',
  color: 'blue.500',
  padding: 4,
})
expectTypeOf(themedCard).toEqualTypeOf<css.ReturnType>()
expectTypeOf(
  themedCard({ className: 'external', style: { padding: '2rem' } }),
).toEqualTypeOf<css.Props>()
Theme.extend(shorthand, { spacing: { 4: '2rem' } }).css({ padding: 4 })
themedCss({ color: 'foreground', padding: 'md' })
themedCss({ color: shorthand.tokens.color.brand, padding: 0 })
// @ts-expect-error Unknown theme paths are rejected.
themedCss({ color: 'blue.600' })
// @ts-expect-error A text token cannot be used as a background.
themedCss({ backgroundColor: 'foreground' })
// @ts-expect-error Spacing tokens cannot become colors.
themedCss({ color: 'md' })
// @ts-expect-error Nonzero numeric spacing requires a declared key.
themedCss({ padding: 5 })
// @ts-expect-error Styling overrides remain literal-only.
themedCard({ style: { padding: 'md' } })
// @ts-expect-error Unknown properties are rejected.
themedCss({ colour: 'brand' })
// @ts-expect-error Root authoring does not inherit the imported theme.
css({ color: 'brand' })

const omitted = Theme.define({ color: { brand: '#fff' }, spacing: undefined })
expectTypeOf(omitted.className).toEqualTypeOf<string>()
// @ts-expect-error Theme scope properties are readonly.
omitted.className = 'external'
omitted.css({ color: 'brand', padding: '1rem' })
// @ts-expect-error An explicitly undefined group contributes no token names.
omitted.css({ padding: 'missing' })
// @ts-expect-error Undefined groups do not enable shorthand in named styles.
Style.define({ card: { padding: 'missing' } }, { theme: omitted })
