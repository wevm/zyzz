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
