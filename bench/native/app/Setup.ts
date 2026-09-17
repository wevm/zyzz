/** Configures Unistyles before fixture modules create themed stylesheets. @module */
import { StyleSheet } from 'react-native-unistyles'
StyleSheet.configure({
  themes: { base: { padding: 2 }, alternate: { padding: 6 } },
  settings: { initialTheme: 'base' },
})
