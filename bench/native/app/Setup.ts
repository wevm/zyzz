/** Configures Unistyles before fixture modules create themed stylesheets. @module */
import { StyleSheet } from 'react-native-unistyles'

// Matches the 400 theme values the zyzz theme lane configures in `Corpus.ts`.
const colors = Object.fromEntries(
  Array.from({ length: 200 }, (_, index) => [
    `c${index}`,
    `#${((index + 1) * 7919).toString(16).padStart(6, '0')}`,
  ]),
)
const spacing = Object.fromEntries(
  Array.from({ length: 199 }, (_, index) => [`s${index}`, index]),
)
StyleSheet.configure({
  themes: {
    base: { colors, padding: 2, spacing },
    alternate: { colors, padding: 6, spacing },
  },
  settings: { initialTheme: 'base' },
})
