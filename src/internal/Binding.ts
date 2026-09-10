/** Describes fixed custom-property slots shared by explicit and callback bindings. @module */
import type * as Literal from './Literal.js'
import * as Token from './Token.js'

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
      : Literal.Length

/** Property domains that accept each scalar reference. */
export type Properties<kind extends Kind> = {
  [property in keyof Literal.Properties]: kind extends 'color'
    ? property extends Token.Properties<'color'>
      ? property
      : never
    : kind extends 'number'
      ? number extends Literal.Properties[property]
        ? property
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
  if (kind === 'color') return Token.accepts('color', property)
  if (property.startsWith('--')) return true
  // Dimensional template references remain limited to properties with matching scalar domains.
  if (kind === 'number') return true
  return (
    Token.accepts('spacing', property) ||
    Token.accepts('borderRadius', property) ||
    property === 'fontSize'
  )
}
