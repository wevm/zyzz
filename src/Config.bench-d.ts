/**
 * Measures type instantiations contributed by public configuration modes.
 * @module
 */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'

// Type-only imports keep the fixture free of runtime module loading; attest
// analyzes bench bodies without executing them.
declare const Config: typeof Zyzz.Config
declare const Vars: typeof Zyzz.Vars

/** Resolves the shared authoring contracts before any bench body is measured. */
export function baseline() {
  Config.create({ vars: { color: { base: '#000' } } }).style({ color: 'base' })
}

bench('create / token-free authoring', () => {
  const { script, style } = Config.create()

  style({ color: '#fff', padding: '8px' })
  script()
}).types([8783, 'instantiations'])

bench('create / inline theme with layers and shorthands', () => {
  const { style, vars: theme } = Config.create({
    layers: ['base', 'components'],
    shorthands: { px: ['paddingLeft', 'paddingRight'] },
    vars: {
      color: { brand: '#06c' },
      padding: { md: '8px' },
      spacing: { md: '8px' },
    },
  })

  style({
    '@layer components': { color: 'brand', px: 'md' },
    ':hover': { color: theme.color.brand },
    margin: 'md',
  })
}).types([16866, 'instantiations'])

bench('create / named theme catalog', () => {
  const base = Vars.define({
    color: { brand: '#06c' },
    spacing: { md: '8px' },
  })
  const { style, vars: themes } = Config.create({
    defaultVars: 'base',
    vars: {
      base,
      mint: {
        color: { brand: { dark: '#afa', light: '#175' } },
        spacing: { md: '12px' },
      },
    },
  })

  style({ color: 'brand', padding: 'md' })
  themes({ colorScheme: 'dark', set: 'mint' })
}).types([9538, 'instantiations'])

bench('create / html output', () => {
  const { style } = Config.create({ output: 'html' })
  const dynamic = style((values: { width: `${number}%` }) => ({
    width: values.width,
  }))

  void style({ padding: '8px' })().class
  void dynamic({ width: '25%' }).style
}).types([10954, 'instantiations'])

bench('create / configured styles with shorthands', () => {
  const { style } = Config.create({
    layers: ['base', 'components'],
    shorthands: {
      px: ['paddingLeft', 'paddingRight'],
      py: ['paddingTop', 'paddingBottom'],
    },
    vars: {
      color: { border: '#ddd', ink: '#111', muted: '#666', surface: '#fff' },
      radius: { md: '6px', sm: '4px' },
      spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px' },
    },
  })

  style({
    '@layer components': { borderRadius: 'md', px: 3, py: 2 },
    ':hover': { backgroundColor: 'muted' },
    alignItems: 'center',
    backgroundColor: 'surface',
    borderColor: 'border',
    color: 'ink',
    display: 'flex',
    gap: 2,
  })
  style({ color: 'ink', display: 'flex', gap: 2, px: 4 })
}).types([46652, 'instantiations'])
