/** Shares tokens, named themes, layers, and optional property aliases. @module */
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  borderRadius: { card: '1rem' },
  breakpoints: { wide: '48rem' },
  color: {
    accent: { dark: '#a5b4fc', light: '#4338ca' },
    backdrop: { dark: '#14141a', light: '#f7f7fb' },
    line: { dark: '#393944', light: '#dcdce5' },
    muted: { dark: '#aaaab8', light: '#626273' },
    surface: { dark: '#202029', light: '#ffffff' },
    text: { dark: '#f4f4f8', light: '#20202a' },
  },
  containerNames: ['preview'],
  containers: { card: '20rem' },
  margin: { section: '2rem' },
  padding: { card: '1.25rem' },
  spacing: { lg: '1.5rem', md: '1rem', sm: '0.5rem' },
  textColor: { subtle: { dark: '#aaaab8', light: '#626273' } },
})

const mint = Theme.extend(base, {
  color: { accent: { dark: '#6ee7b7', light: '#047857' } },
})

/** Named helpers retain the shared token contract across every example. */
export const { css, theme, themes } = Config.create({
  defaultTheme: 'indigo',
  layers: ['reset', 'base', 'components'],
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  themes: {
    indigo: base,
    mint,
  },
})
