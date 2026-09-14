/** Binds the root theme selection on <html> to the initialization script's storage record. @module */
import { Appearance } from 'zyzz/web'
import { themes } from './zyzz.config.js'

/** Controls read `current()` after the head script has run and persist changes with `select()`. */
export const appearance = Appearance.create({
  defaults: { colorScheme: 'light dark', theme: 'indigo' },
  themes,
})

/** A catalog theme with an optional scheme. */
export type Selection = Parameters<typeof appearance.select>[0]
