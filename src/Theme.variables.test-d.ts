/** Checks inferred web variable paths and declaration domains through public APIs. @module */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import { Config, css, Theme } from 'zyzz'

describe('define', () => {
  test('retains web reference domains and config inference', () => {
    const theme = Theme.define({
      color: { brand: 'red' },
      spacing: { md: '8px' },
    })
    css({
      color: theme.vars.color.brand,
      // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions -- Source compilation consumes this reference before coercion.
      // oxlint-disable-next-line typescript/no-base-to-string, typescript/restrict-template-expressions -- Source compilation consumes this reference before coercion.
      width: `calc(100% - ${theme.vars.spacing.md})`,
    })
    css({ padding: [theme.vars.spacing.md, '2px'] })
    theme.css({ color: theme.vars.color.brand })
    // @ts-expect-error Variable domains cannot cross properties.
    css({ color: theme.vars.spacing.md })
    // @ts-expect-error Undeclared variables are unavailable.
    css({ width: theme.vars.spacing.missing })
    const config = Config.create({ theme })
    expectTypeOf(config.theme.vars.color.brand).toEqualTypeOf<
      typeof theme.vars.color.brand
    >()
  })
})
