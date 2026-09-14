/** Applies the root theme on <html> and persists the selection for the initialization script. @module */
import { script, themes } from './zyzz.config.js'

/** Root selection stored under the initialization script's default key. */
export type Appearance = {
  colorScheme: 'light' | 'dark' | 'light dark'
  theme: 'indigo' | 'mint'
}

const defaults: Appearance = { colorScheme: 'light dark', theme: 'indigo' }

/** Applies a selection to <html> without saving it; the props carry the scope and scheme classes. */
export function apply(appearance: Appearance) {
  const root = document.documentElement
  const previous = themes(current())
  const next = themes(appearance)

  root.classList.remove(...previous.class.split(' '))
  root.classList.add(...next.class.split(' '))
  root.style.colorScheme = appearance.colorScheme
}

/** Reads the selection <html> carries; controls initialize from applied root state. */
export function current(): Appearance {
  const root = document.documentElement
  const scheme = root.style.colorScheme

  return {
    colorScheme:
      scheme === 'light' || scheme === 'dark' ? scheme : 'light dark',
    theme: root.classList.contains(themes.mint.className) ? 'mint' : 'indigo',
  }
}

/**
 * Renders the default selection on <html>, then runs the initialization script so a saved selection wins.
 * A server-rendered document inlines the same script in <head>; this client-rendered playground has no
 * markup before its entry module, so the entry inserts it before anything renders.
 */
export function initialize() {
  apply(defaults)

  const restore = document.createElement('script')
  restore.textContent = script()
  document.head.append(restore)
}

/** Applies a selection to <html> and saves it for the next visit. */
export function select(appearance: Appearance) {
  apply(appearance)

  try {
    localStorage.setItem('zyzz', JSON.stringify(appearance))
  } catch {
    // Blocked storage keeps the selection for this document only.
  }
}
