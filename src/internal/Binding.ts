/** Describes fixed custom-property slots shared by explicit and callback bindings. @module */
import type * as Literal from './Literal.js'
import type * as Token from './Token.js'
import * as BindingDomains from './BindingDomains.js'

/** Supported runtime scalar domains. */
export type Kind =
  | 'color'
  | 'length'
  | 'number'
  | 'percentage'
  | 'signedLength'
  | 'signedPercentage'

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
    : kind extends 'signedPercentage'
      ? `${number}%`
      : kind extends 'signedLength'
        ? Exclude<Literal.Length, `${number}%`>
        : kind extends 'percentage'
          ? `${number}%` & NonNegative
          : Exclude<Literal.Length, `${number}%`> & (NonNegative | 0)

type NonNegative =
  `${'0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+'}${string}`

/** Property domains that accept each scalar reference. */
export type Properties<kind extends Kind> = {
  [property in keyof Literal.Properties]: property extends `--${string}`
    ? property
    : property extends keyof typeof Literal.rules
      ? (typeof Literal.rules)[property] extends { kind: 'compound' }
        ? never
        : kind extends 'percentage' | 'signedPercentage'
          ? (typeof Literal.rules)[property] extends { kind: 'number' }
            ? (typeof Literal.rules)[property] extends { percentage: true }
              ? Compatible<kind, property>
              : never
            : Compatible<kind, property>
          : Compatible<kind, property>
      : never
}[keyof Literal.Properties]
type Compatible<
  kind extends Kind,
  property extends keyof Literal.Properties,
> = kind extends 'color'
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
                | { kind: 'grid-line' }
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
          kind extends 'percentage' | 'signedPercentage'
            ? `${number}%`
            : `${number}px`
        > extends never
      ? never
      : kind extends 'signedLength' | 'signedPercentage'
        ? property extends keyof typeof Literal.rules
          ? (typeof Literal.rules)[property] extends
              | { negative: false }
              | { min: number }
              | { max: number }
            ? never
            : property
          : property
        : property

/** Recognizes fixed slot data without invoking consumer accessors. */
export function is(value: unknown): value is Reference {
  if (typeof value !== 'object' || value === null || !Object.isFrozen(value))
    return false
  const fields = Object.getOwnPropertyDescriptors(value)
  return (
    ['name', 'type', 'variable'].every(
      (key) => fields[key] && 'value' in fields[key]!,
    ) &&
    fields.variable!.value === true &&
    typeof fields.name!.value === 'string' &&
    /^--[a-zA-Z0-9_-]+$/.test(fields.name!.value) &&
    [
      'color',
      'length',
      'number',
      'percentage',
      'signedLength',
      'signedPercentage',
    ].includes(fields.type!.value)
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
