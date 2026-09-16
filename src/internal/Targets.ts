/** Copies static target data without retaining or freezing caller-owned objects. @module */
import type * as Native from './NativeProperties.js'
import type * as Style from '../Style.js'

/** Type-only authoring data retained for destination component compatibility. */
export declare const authored: unique symbol

/** Per-style destination domains, computed only when a compiler consumes them. */
export type Domains<input> = [input] extends [never]
  ? unknown
  : {
      [key in keyof input]: {
        android: Overflow<input[key], 'android'>
        ios: Overflow<input[key], 'ios'>
        native: Overflow<input[key], undefined>
      }
    }

/** Retains the selected overflow domain, which differs between Image and View. */
export type Overflow<input, platform> = Merge<
  Value<input>,
  Merge<
    Value<Branch<input, 'native'>>,
    platform extends 'ios' | 'android'
      ? Value<Branch<input, platform>>
      : undefined
  >
>
type Branch<input, key extends PropertyKey> = input extends {
  readonly targets?: infer targets
}
  ? key extends keyof NonNullable<targets>
    ? NonNullable<targets>[key]
    : never
  : never
type Value<input> = [input] extends [never]
  ? undefined
  : 'overflow' extends keyof NonNullable<input>
    ? NonNullable<input>['overflow']
    : undefined
type Merge<before, after> =
  | Exclude<after, undefined>
  | (undefined extends after ? before : never)

/** Checks nested native literal keys without accepting host-owned values. */
export type Checked<input, expected> = expected extends unknown
  ? input extends expected
    ? input extends readonly unknown[]
      ? expected extends readonly (infer value)[]
        ? readonly Checked<input[number], value>[]
        : never
      : input extends object
        ? {
            [key in keyof input]: key extends keyof expected
              ? Checked<input[key], expected[key]>
              : never
          }
        : input
    : never
  : never

/** Checks only authored native properties against their destination domains. */
export type Declarations<input> = input extends undefined
  ? undefined
  : input extends object
    ? {
        [key in keyof input]: key extends keyof Native.Properties
          ? Checked<input[key], Native.Properties[key]>
          : never
      }
    : never

/** Retained compiler data for native and platform-specific declarations. */
export type NativeBranches = {
  /** Android overrides applied after the common native branch. */
  readonly android?: Native.Properties | undefined
  /** iOS overrides applied after the common native branch. */
  readonly ios?: Native.Properties | undefined
  /** Declarations using native value semantics. */
  readonly native?: Native.Properties | undefined
}

/** Copies only finite primitives, dense arrays, and plain enumerable data records. */
export function copy(
  value: unknown,
  path: readonly string[] = [],
  depth = 0,
): unknown {
  if (depth > 64)
    throw new Error(`Target nesting exceeds 64 levels at ${path.join('.')}.`)
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  )
    return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value || typeof value !== 'object')
    throw new Error(`Expected static native data at ${path.join('.')}.`)
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (!array && prototype !== null && prototype !== Object.prototype) {
    const constructor = Object.getOwnPropertyDescriptor(
      prototype,
      'constructor',
    )?.value
    if (
      Object.getPrototypeOf(prototype) !== null ||
      typeof constructor !== 'function' ||
      Function.prototype.toString.call(constructor) !==
        Function.prototype.toString.call(Object)
    )
      throw new Error(
        `Host-owned objects are not static target data at ${path.join('.')}.`,
      )
  }
  const output: Record<string, unknown> = Object.create(null)
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    if (
      typeof key !== 'string' ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    )
      throw new Error(
        `Target data must not contain accessors or symbols at ${path.join('.')}.`,
      )
    if (!array && descriptor.value === undefined) continue
    output[key] = copy(descriptor.value, [...path, key], depth + 1)
  }
  if (!array) return Object.freeze(output)
  if (
    Object.keys(output).length !== value.length ||
    Object.keys(output).some((key, index) => key !== String(index))
  )
    throw new Error(
      `Target arrays must contain dense data entries at ${path.join('.')}.`,
    )
  return Object.freeze(Object.values(output))
}

/** Selects web overrides without passing native declarations to the CSS compiler. */
export function web<name extends string>(
  style: Style.NamedStyle<name>,
): Style.NamedStyle<name> {
  const rules = style.rules?.map((rule) => ({
    ...rule,
    style: web(rule.style),
  }))
  const { targets, ...body } = style
  const shared = rules ? { ...body, rules } : body
  if (!targets?.web) return shared
  return {
    ...shared,
    declarations: [],
    rules: [{ style: shared }, { style: web(targets.web) }],
  }
}
