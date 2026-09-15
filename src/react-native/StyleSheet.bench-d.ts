/** Measures native compiler and lookup inference through public types. @module */
import { bench } from '@ark/attest'
import type * as Zyzz from 'zyzz'
import type * as Native from 'zyzz/react-native'

declare const StyleSheet: typeof Native.StyleSheet
declare const styles: Zyzz.Style.Definition<'card' | 'label'>
declare const theme: Zyzz.Theme.Definition

/** Warms the common native table contract. */
export function baseline() {
  StyleSheet.compile({ styles })
}

bench('native / compile and select named tables', () => {
  const output = StyleSheet.compile({
    styles,
    themes: { alternate: theme, base: theme },
  })
  StyleSheet.select(output.styles, { colorScheme: 'dark', theme: 'alternate' })
}).types([422, 'instantiations'])
