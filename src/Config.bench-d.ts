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
  Config.create({ theme: { color: { base: '#000' } } }).style({ color: 'base' })
}

bench('create / token-free authoring', () => {
  const { script, style } = Config.create()

  style({ color: '#fff', padding: '8px' })
  script()
}).types([16414, 'instantiations'])

bench('create / inline theme with layers and shorthands', () => {
  const { style, theme } = Config.create({
    layers: ['base', 'components'],
    shorthands: { px: ['paddingLeft', 'paddingRight'] },
    theme: {
      color: { brand: '#06c' },
      padding: { md: '8px' },
      spacing: { md: '8px' },
    },
  })

  style({
    '@layer components': { color: 'brand', px: 'md' },
    ':hover': { color: theme.tokens.color.brand },
    margin: 'md',
  })
}).types([47664, 'instantiations'])

bench('create / named theme catalog', () => {
  const base = Theme.define({
    color: { brand: '#06c' },
    spacing: { md: '8px' },
  })
  const { style, themes } = Config.create({
    defaultTheme: 'base',
    themes: {
      base,
      mint: {
        color: { brand: { dark: '#afa', light: '#175' } },
        spacing: { md: '12px' },
      },
    },
  })

  style({ color: 'brand', padding: 'md' })
  themes({ colorScheme: 'dark', theme: 'mint' })
}).types([108537, 'instantiations'])

bench('create / html output', () => {
  const { style } = Config.create({ output: 'html' })
  const dynamic = style((values: { width: `${number}%` }) => ({
    width: values.width,
  }))

  void style({ padding: '8px' })().class
  void dynamic({ width: '25%' }).style
}).types([21682, 'instantiations'])
