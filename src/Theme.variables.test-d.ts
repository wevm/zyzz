/** Checks inferred web variable paths and declaration domains through public APIs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, Theme } from 'zyzz'

describe('define', () => {
  test('retains web reference domains and config inference', () => {
    const theme = Theme.define({
      color: { brand: 'red' },
      spacing: { md: '8px' },
    })

    theme.css({
      color: theme.vars.color.brand,
      // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions -- Source compilation consumes this reference before coercion.
      width: `calc(100% - ${theme.vars.spacing.md})`,
    })
    theme.css({ padding: [theme.vars.spacing.md, '2px'] })
    theme.css({ color: theme.vars.color.brand })
    // @ts-expect-error Variable domains cannot cross properties.
    theme.css({ color: theme.vars.spacing.md })
    // @ts-expect-error Spacing variables cannot represent integer counts.
    theme.css({ maxLines: theme.vars.spacing.md })
    // @ts-expect-error Undeclared variables are unavailable.
    theme.css({ width: theme.vars.spacing.missing })
    // @ts-expect-error Root css has no theme reference contract.
    css({ width: theme.vars.spacing.md })
    // @ts-expect-error marginTrim is a keyword grammar, not a length.
    theme.css({ marginTrim: theme.vars.spacing.md })

    const config = Config.create({ theme })

    expectTypeOf(config.theme.vars.color.brand).toEqualTypeOf<
      typeof theme.vars.color.brand
    >()
  })
})
