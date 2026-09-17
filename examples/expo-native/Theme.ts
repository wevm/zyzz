/** Shared theme authoring used by the native runtime fixture. @module */
import { Config } from 'zyzz'

export const { style, variants } = Config.create({
  themes: {
    blue: {
      color: {
        accent: { light: '#2563eb', dark: '#93c5fd' },
        surface: { light: '#dbeafe', dark: '#1e3a8a' },
      },
    },
    green: {
      color: {
        accent: { light: '#15803d', dark: '#86efac' },
        surface: { light: '#dcfce7', dark: '#14532d' },
      },
    },
  },
  defaultTheme: 'blue',
})
