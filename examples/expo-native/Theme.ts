/** Defines themes for the native example. @module */
import { Config } from 'zyzz'

export const { style, variants } = Config.create({
  themes: {
    blue: {
      color: {
        accent: { light: '#2563eb', dark: '#93c5fd' },
        ink: { light: '#0f172a', dark: '#f1f5f9' },
        muted: { light: '#475569', dark: '#cbd5e1' },
        page: { light: '#ffffff', dark: '#0f172a' },
        surface: { light: '#dbeafe', dark: '#1e3a8a' },
      },
    },
    green: {
      color: {
        accent: { light: '#15803d', dark: '#86efac' },
        ink: { light: '#0f172a', dark: '#f1f5f9' },
        muted: { light: '#475569', dark: '#cbd5e1' },
        page: { light: '#ffffff', dark: '#0f172a' },
        surface: { light: '#dcfce7', dark: '#14532d' },
      },
    },
  },
  defaultTheme: 'blue',
})
