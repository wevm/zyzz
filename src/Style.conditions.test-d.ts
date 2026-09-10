/** Checks broad condition-aware style contracts through public entrypoints. @module */
import { describe, test } from 'vite-plus/test'
import { Style, Theme } from 'zyzz'

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
