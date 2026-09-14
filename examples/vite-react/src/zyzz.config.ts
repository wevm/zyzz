/** Shares tokens, named themes, layers, and optional property aliases. @module */
import { Config, Theme } from 'zyzz'

const base = Theme.define({
  borderRadius: { card: '1rem' },
  breakpoints: { wide: '48rem' },
  color: {
    accent: { dark: '#a5b4fc', light: '#4338ca' },
    backdrop: { dark: '#252525', light: '#f5f5f5' },
    line: { dark: '#444444', light: '#cccccc' },
    muted: { dark: '#aaaab8', light: '#626273' },
    surface: { dark: '#181818', light: '#ffffff' },
    text: { dark: '#eeeeee', light: '#111111' },
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
export const { css, script, theme, themes } = Config.create({
  defaultTheme: 'indigo',
  layers: ['reset', 'base', 'components'],
  shorthands: { px: ['paddingLeft', 'paddingRight'] },
  themes: {
    indigo: base,
    mint,
  },
})
