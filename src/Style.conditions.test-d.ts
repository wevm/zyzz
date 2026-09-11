/** Checks broad condition-aware style contracts through public entrypoints. @module */
import { describe, test } from 'vite-plus/test'
import { css, Style, Theme } from 'zyzz'

describe('css', () => {
  test('requires parenthesized support conditions', () => {
    // @ts-expect-error Support conditions require parentheses or a feature function.
    css({ '@supports display: grid': { color: 'red' } })
    css({ '@supports selector(:has(*))': { color: 'red' } })
  })
  test('accepts case-insensitive media types', () => {
    css({
      '@media SCREEN': { color: 'red' },
      '@media OnLy ScReEn': { color: 'blue' },
    })
  })
})

describe('define', () => {
  test('preserves broad bound declarations and rejects unknown keys', () => {
    const theme: Theme.Definition = Theme.define({
      breakpoints: { tablet: '48rem' },
      color: { accent: 'red' },
    })
    const styles = {} as Style.Properties<Theme.Tokens>

    Style.define({ styles }, { theme })

    const declarations = {} as Style.DeclarationProperties & { widht?: string }

    // @ts-expect-error Broad declaration annotations must retain exact keys too.
    Style.define({ declarations })
  })
})
