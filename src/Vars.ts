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
  readonly [key in keyof schema]: Binding.Reference<Kind<schema[key]>>
}

/**
 * Declares a source-owned variable contract; a compile-time transform supplies its names.
 * @throws {MissingTransformError} If executed before the compiler rewrites the contract.
 */
export function define<const schema extends Schema>(
  schema: schema &
    Record<Extract<keyof schema, 'set' | '__proto__'>, never> & {
      [key in keyof schema]: schema[key] extends Registration<infer kind>
        ? {
            readonly initialValue: Literal.Checked<
              schema[key]['initialValue']
            > &
              Initial<kind> &
              Independent<schema[key]['initialValue']> &
              (kind extends 'length'
                ? schema[key]['initialValue'] extends `-${string}`
                  ? never
                  : unknown
                : unknown)
          }
        : unknown
    },
): Definition<schema> {
  void schema
  throw new MissingTransformError()
}

/** Supported variable names and scalar domains. */
export type Schema = Readonly<Record<string, Binding.Kind | Registration>>
/** Extracts the scalar domain from a shorthand or registered descriptor. */
export type Kind<value> = value extends Binding.Kind
  ? value
  : value extends { readonly type: infer kind extends Binding.Kind }
    ? kind
    : never
/** Computationally independent initial values for registered properties. */
export type Initial<kind extends Binding.Kind> = kind extends
  | 'length'
  | 'signedLength'
  ? 0 | `${number}${'px' | 'in' | 'cm' | 'mm' | 'q' | 'pt' | 'pc'}`
  : kind extends 'color'
    ? Exclude<
        Binding.Value<kind>,
        'currentColor' | 'currentcolor' | `light-dark(${string})`
      >
    : Binding.Value<kind>
type Independent<value> = value extends string
  ? Lowercase<value> extends `${string}${'currentcolor' | 'var(' | 'env(' | 'light-dark('}${string}`
    ? never
    : value
  : value
/** Optional CSS registration attached to one existing scalar variable slot. */
export type Registration<kind extends Binding.Kind = Binding.Kind> =
  kind extends unknown
    ? {
        /** Scalar value domain, shared with assignments and style references. */
        readonly type: kind
        /** Whether the custom property inherits through the DOM. */
        readonly inherits: boolean
        /** Independent fallback used by CSS registration before assignment. */
        readonly initialValue: Initial<kind>
        /** CSS syntax, inferred from type when omitted. */
        readonly syntax?: Syntax<kind> | undefined
      }
    : never
/** CSS syntax corresponding to a supported scalar domain. */
export type Syntax<kind extends Binding.Kind> = kind extends 'signedLength'
  ? '<length>'
  : kind extends 'signedPercentage'
    ? '<percentage>'
    : `<${kind}>`

/** Partial assignments retain the domain of every declared variable. */
export type Values<schema extends Schema> = {
  readonly [key in keyof schema]?: Binding.Value<Kind<schema[key]>>
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
