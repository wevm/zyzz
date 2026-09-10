/** Declares explicit scalar slots and assigns values to compiled custom properties. @module */
import type * as Literal from './internal/Literal.js'
import type * as Binding from './internal/Binding.js'

/** Compiled references and a typed assignment method for the declared schema. */
export type Definition<schema extends Schema = Schema> = References<schema> & {
  /** Assigns partial scalar values to this contract's fixed custom properties. */
  readonly set: <const values extends Values<schema>>(
    values: values & {
      [key in keyof values]: Literal.Checked<values[key]>
    } & Record<Exclude<keyof values, keyof schema>, never>,
  ) => Readonly<Record<`--${string}`, number | string>>
}
/** Compiler-assigned scalar references preserving the schema keys. */
export type References<schema extends Schema = Schema> = {
  readonly [key in keyof schema]: Binding.Reference<schema[key]>
}

/**
 * Declares a source-owned variable contract; a compile-time transform supplies its names.
 * @throws {MissingTransformError} If executed before the compiler rewrites the contract.
 */
export function define<const schema extends Schema>(
  schema: schema & Record<Extract<keyof schema, 'set'>, never>,
): Definition<schema> {
  void schema
  throw new MissingTransformError()
}

/** Supported variable names and scalar domains. */
export type Schema = Readonly<Record<string, Binding.Kind>>

/** Partial assignments retain the domain of every declared variable. */
export type Values<schema extends Schema> = {
  readonly [key in keyof schema]?: Binding.Value<schema[key]>
}

/** Reports execution of a variable schema that has not been compiled. */
export class MissingTransformError extends Error {
  /** Explains the missing variable-contract rewrite. */
  constructor() {
    super(
      'Vars.define requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.',
    )
  }
  /** Stable namespaced diagnostic name. */
  override name = 'Vars.MissingTransformError'
}
