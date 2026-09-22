/** Carries worker-owned compilation state from Metro to its Babel invocation. @module */
import type * as Graph from '../../compiler/Graph.js'
import type * as Syntax from '../../compiler/internal/Syntax.js'

/** Private adapter transport, scoped to one transformer's platform and source entry. */
export const key = Symbol('native compilation')

/** Compiler and syntax supplied by the owning transformer. */
export type Context = {
  readonly compile: typeof Graph.compile
  readonly parse: typeof Syntax.parse
  readonly programs: ReadonlyMap<string, ReturnType<typeof Syntax.parse>>
}
