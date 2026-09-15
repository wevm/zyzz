/**
 * Measures type instantiations contributed by public configuration modes.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Config: typeof Zyzz.Config
declare const Theme: typeof Zyzz.Theme

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  Config.create({ theme: { color: { base: '#000' } } }).css({ color: 'base' })
}

bench('create / token-free authoring', () => {
  const { css, script } = Config.create()

  css({ color: '#fff', padding: '8px' })
  script()
}).types([16386, 'instantiations'])

bench('create / inline theme with layers and shorthands', () => {
  const { css, theme } = Config.create({
    layers: ['base', 'components'],
    shorthands: { px: ['paddingLeft', 'paddingRight'] },
    theme: {
      color: { brand: '#06c' },
      padding: { md: '8px' },
      spacing: { md: '8px' },
    },
  })

  css({
    '@layer components': { color: 'brand', px: 'md' },
    ':hover': { color: theme.tokens.color.brand },
    margin: 'md',
  })
}).types([47630, 'instantiations'])

bench('create / named theme catalog', () => {
  const base = Theme.define({
    color: { brand: '#06c' },
    spacing: { md: '8px' },
  })
  const { css, themes } = Config.create({
    defaultTheme: 'base',
    themes: {
      base,
      mint: {
        color: { brand: { dark: '#afa', light: '#175' } },
        spacing: { md: '12px' },
      },
    },
  })

  css({ color: 'brand', padding: 'md' })
  themes({ colorScheme: 'dark', theme: 'mint' })
}).types([107900, 'instantiations'])

bench('create / html output', () => {
  const { css } = Config.create({ output: 'html' })
  const dynamic = css((values: { width: `${number}%` }) => ({
    width: values.width,
  }))

  void css({ padding: '8px' })().class
  void dynamic({ width: '25%' }).style
}).types([21599, 'instantiations'])
