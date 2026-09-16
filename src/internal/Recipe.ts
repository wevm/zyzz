/** Retains ordered finite recipe alternatives independently of an output target. @module */
import type * as Style from '../Style.js'

/** Static recipe data shared by source extraction and target compilers. */
export type Definition<value = Style.Definition> = {
  /** Ordered axes and their finite choice names. */
  readonly axes: Readonly<Record<string, readonly string[]>>
  /** Default choices, with null suppressing an axis. */
  readonly defaults: Readonly<Record<string, string | null>>
  /** Base, choices, and compounds in application order. */
  readonly rules: readonly {
    /** Required choices by axis. An empty list always matches. */
    readonly matches: readonly (readonly [string, readonly string[]])[]
    /** Target-independent declarations or their compiled value. */
    readonly value: value
  }[]
}
