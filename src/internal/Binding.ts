/** Describes fixed custom-property slots shared by explicit and callback bindings. @module */
import type * as Literal from './Literal.js'
import type * as Token from './Token.js'
import * as BindingDomains from './BindingDomains.js'

/** Supported runtime scalar domains. */
export type Kind = 'color' | 'length' | 'number' | 'percentage'

/** A compiler-assigned web custom property with its scalar domain. */
export type Reference<kind extends Kind = Kind> = {
  /** Fixed CSS custom-property name. */
  readonly name: `--${string}`
  /** Scalar domain used by authoring types and runtime primitive checks. */
  readonly type: kind
  /** Distinguishes slots from theme references. */
  readonly variable: true
}

/** Scalar inputs accepted by a slot. CSS semantics remain statically checked. */
export type Value<kind extends Kind> = kind extends 'number'
  ? number
  : kind extends 'color'
    ? Literal.Color
    : kind extends 'percentage'
      ? `${number}%`
      : Exclude<Literal.Length, `${number}%`>

/** Property domains that accept each scalar reference. */
export type Properties<kind extends Kind> = {
  [property in keyof Literal.Properties]: property extends `--${string}`
    ? property
    : kind extends 'color'
      ? property extends Token.Properties<'color'>
        ? property
        : never
      : kind extends 'number'
        ? number extends Literal.Properties[property]
          ? property extends keyof typeof Literal.rules
            ? property extends
                | 'opacity'
                | 'fillOpacity'
                | 'floodOpacity'
                | 'stopOpacity'
                | 'strokeOpacity'
              ? property
              : (typeof Literal.rules)[property] extends
                    | { integer: true }
                    | { min: number }
                    | { max: number }
                    | { negative: false }
                ? never
                : property
            : property
          : never
        : Extract<
              Literal.Properties[property],
              kind extends 'percentage' ? `${number}%` : `${number}px`
            > extends never
          ? never
          : property
}[keyof Literal.Properties]

/** Recognizes fixed slot data without invoking consumer accessors. */
export function is(value: unknown): value is Reference {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.getOwnPropertyDescriptor(value, 'variable')?.value === true
  )
}

/** Checks template reference domains against declaration shapes. */
export function accepts(
  kind: Kind,
  property: keyof Literal.Properties,
): boolean {
  if (property.startsWith('--')) return true
  return (BindingDomains.properties[kind] as readonly string[]).includes(
    property,
  )
}
