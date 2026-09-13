/** Declares typed CSS variables with static references and inline assignments. @module */
import type * as Binding from './internal/Binding.js'
import type * as Literal from './internal/Literal.js'

/** Declares one compiler-owned custom property, optionally registered with CSS @property. */
export function variable<const kind extends Binding.Kind>(
  kind: kind,
): variable.Reference<kind>
export function variable<
  const kind extends Binding.Kind,
  const options extends variable.Options<kind>,
>(
  kind: kind,
  options: options &
    Record<Exclude<keyof options, keyof variable.Options<kind>>, never> & {
      readonly initialValue: Literal.Checked<options['initialValue']> &
        Independent<options['initialValue']> &
        (kind extends 'length'
          ? options['initialValue'] extends `-${string}`
            ? never
            : unknown
          : unknown)
    },
): variable.Reference<kind>
export function variable(kind: Binding.Kind, options?: unknown): never {
  void kind
  void options
  throw new MissingTransformError()
}

/** Types shared by variable declarations and assignments. */
export declare namespace variable {
  /** Supported scalar domains. */
  type Kind = Binding.Kind
  /** Optional registration uses the variable's scalar domain as its CSS syntax. */
  type Options<kind extends Binding.Kind = Binding.Kind> = {
    /** Whether the custom property inherits through the DOM. */
    readonly inherits: boolean
    /** Computationally independent initial value emitted in @property. */
    readonly initialValue: Initial<kind>
    /** Matching CSS syntax; inferred from the domain when omitted. */
    readonly syntax?: Syntax<kind> | undefined
  }
  /** Opaque computed key and typed declaration reference; never a runtime CSS string. */
  type Reference<kind extends Binding.Kind = Binding.Kind> = string &
    Binding.Reference<kind> & {
      /** Produces one inline custom-property assignment without runtime value validation. */
      readonly set: <const value extends Binding.Value<kind>>(
        value: value & Literal.Checked<value>,
      ) => Readonly<Record<`--${string}`, value>>
    }
}

/** Computationally independent initial values for registered properties. */
type Initial<kind extends Binding.Kind> = kind extends 'length' | 'signedLength'
  ? 0 | '0' | `${number}${'px' | 'in' | 'cm' | 'mm' | 'q' | 'pt' | 'pc'}`
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

/** CSS syntax corresponding to a supported scalar domain. */
type Syntax<kind extends Binding.Kind> = kind extends 'signedLength'
  ? '<length>'
  : kind extends 'signedPercentage'
    ? '<percentage>'
    : `<${kind}>`

/** Reports execution of authoring source without its compile-time transform. */
export class MissingTransformError extends Error {
  /** Explains the missing transform. */
  constructor() {
    super(
      'variable requires a compile-time transform; do not execute untransformed authoring source.',
    )
  }
  /** Stable namespaced diagnostic name. */
  override name = 'variable.MissingTransformError'
}
