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
