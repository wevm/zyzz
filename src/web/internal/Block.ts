/** Represents ordered descriptor and declaration blocks independently of parsing. @module */
import type * as Style from '../../Style.js'
/** One authored descriptor, element declaration fragment, or nested descriptor block. */
export type Entry =
  | {
      readonly kind: 'descriptor'
      readonly name: string
      readonly value: string | number
    }
  | { readonly kind: 'style'; readonly style: Style.NamedStyle }
  | {
      readonly kind: 'block'
      readonly header: string
      readonly entries: readonly Entry[]
    }
/** Renders a structured block while delegating ordinary property serialization to the CSS compiler. */
export function render(
  entries: readonly Entry[],
  style: (value: Style.NamedStyle) => string,
): string {
  return entries
    .map((entry) => {
      if (entry.kind === 'style') return style(entry.style)
      if (entry.kind === 'block')
        return `${entry.header}{${render(entry.entries, style)}}`
      return `${entry.name}:${entry.value};`
    })
    .join('')
}
