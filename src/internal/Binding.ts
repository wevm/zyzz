/** Describes fixed custom-property slots shared by explicit and callback bindings. @module */
import type * as Literal from './Literal.js'
import type * as Token from './Token.js'
import * as BindingDomains from './BindingDomains.js'

/** Explicit scalar domains or an unconstrained custom property. */
export type Domain = Kind | '*'

/** Supported runtime scalar domains. */
export type Kind =
  | 'color'
  | 'length'
  | 'number'
  | 'percentage'
  | 'signedLength'
  | 'signedPercentage'

/** A compiler-assigned web custom property with its scalar domain. */
export type Reference<kind extends Domain = Domain> = {
  /** Fixed CSS custom-property name. */
  readonly name: `--${string}`
  /** Scalar domain used by authoring types and runtime primitive checks. */
  readonly type: kind
  /** Distinguishes slots from theme references. */
  readonly variable: true
}

/** Scalar inputs accepted by a slot. CSS semantics remain statically checked. */
export type Value<kind extends Domain> = kind extends '*'
  ? string | number
  : kind extends 'number'
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
  [property in keyof Literal.Properties]: Property<kind, property>
}[keyof Literal.Properties]

/** Checks one property's binding domain without enumerating every CSS grammar. */
export type Property<
  kind extends Kind,
  property extends keyof Literal.Properties,
> = property extends `--${string}`
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
                | { kind: 'grid-line' | 'ratio' }
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
              | { kind: 'line' | 'grid-tracks' }
              | { min: number }
              | { max: number }
            ? never
            : property
          : property
        : property

/** Rejects broad numeric callback values where a property requires a narrower domain. */
export type Checked<style> = {
  [property in keyof style]: property extends 'targets'
    ? never
    : property extends keyof Literal.Properties
      ? number extends style[property]
        ? property extends Properties<'number'>
          ? unknown
          : never
        : unknown
      : style[property] extends Record<string, unknown>
        ? Checked<style[property]>
        : unknown
}

/** Rejects reserved callback field names and importance-bearing value domains. */
export type Inputs<values> = {
  [key in keyof values]: key extends
    | 'class'
    | 'className'
    | 'key'
    | 'ref'
    | 'style'
    | 'variables'
    | '__proto__'
    ? never
    : Extract<values[key], `${string}!${string}`> extends never
      ? Extract<
          Lowercase<Extract<values[key], string>>,
          'initial' | 'inherit' | 'unset' | 'revert' | 'revert-layer'
        > extends never
        ? values[key]
        : never
      : never
}

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
      '*',
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
  kind: Domain,
  property: keyof Literal.Properties,
): boolean {
  if (kind === '*' || property.startsWith('--')) return true

  return (BindingDomains.properties[kind] as readonly string[]).includes(
    property,
  )
}
