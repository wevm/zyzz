/**
 * Verifies configuration modes, token domains, and exact layer-key inference.
 * @module
 */
import { expectTypeOf } from 'vite-plus/test'
import { Config, Theme } from 'zyzz'

const empty = Config.create()
empty.css({ color: '#fff', padding: '8px' })
// @ts-expect-error Root config has no tokens.
empty.css({ padding: 'md' })
// @ts-expect-error Token-free config has no theme handle.
void empty.theme

const base = Theme.define({ color: { brand: '#06c' }, spacing: { md: '8px' } })
const single = Config.create({ layers: ['base', 'components'], theme: base })
single.css({ color: 'brand', padding: single.theme.tokens.spacing.md })
single.css({
  '@layer components': { color: 'brand', '@layer base': { padding: 'md' } },
})
// @ts-expect-error Misspelled layer.
single.css({ '@layer component': { color: 'brand' } })
// @ts-expect-error Layer bodies retain token checking.
single.css({ '@layer components': { color: 'missing' } })
// @ts-expect-error References retain property domains inside layers.
single.css({ '@layer base': { padding: single.theme.tokens.color.brand } })
// @ts-expect-error Unknown style keys through variables remain invalid.
single.css({ colour: '#06c' } as const)
// @ts-expect-error Single-theme config has no catalog.
void single.themes

const named = Config.create({
  defaultTheme: 'base',
  themes: {
    base,
    mint: {
      color: { brand: { light: '#175', dark: '#afa' } },
      spacing: { md: '12px' },
    },
  },
})
named.css({ color: 'brand', padding: 'md' })
expectTypeOf(named.themes.mint.tokens.color.brand).toEqualTypeOf<
  Theme.Reference<'color'>
>()
// @ts-expect-error Missing default.
Config.create({ themes: { base } })
// @ts-expect-error Unknown default.
Config.create({ defaultTheme: 'missing', themes: { base } })
// @ts-expect-error Modes are mutually exclusive.
Config.create({ theme: base, themes: { base }, defaultTheme: 'base' })
// @ts-expect-error Default requires a catalog.
Config.create({ theme: base, defaultTheme: 'base' })
Config.create({
  defaultTheme: 'base',
  // @ts-expect-error Complete alternatives must include spacing.
  themes: { base, mint: { color: { brand: '#175' } } },
})
Config.create({
  defaultTheme: 'base',
  themes: {
    base,
    // @ts-expect-error Extra tokens are incompatible.
    mint: { color: { brand: '#175', extra: '#000' }, spacing: { md: '8px' } },
  },
})
const incomplete = Theme.define({ color: { brand: '#175' } })
// @ts-expect-error Reusable definitions must also have complete paths.
Config.create({ defaultTheme: 'base', themes: { base, incomplete } })
// @ts-expect-error Wrong inline token group.
Config.create({ theme: { colors: { brand: '#fff' } } })
// @ts-expect-error Incomplete color pair.
Config.create({ theme: { color: { brand: { light: '#fff' } } } })
Config.create({
  // @ts-expect-error Color pairs cannot carry extra properties.
  theme: { color: { brand: { light: '#fff', dark: '#000', extra: '#fff' } } },
})
// @ts-expect-error Unknown options are rejected through variables.
Config.create({ theme: base, unknown: true } as const)
// @ts-expect-error A layer list does not add an arbitrary selector index.
single.css({ ':hover': { color: 'brand' } })
