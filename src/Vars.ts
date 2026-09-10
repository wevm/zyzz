/** Declares explicit scalar slots and assigns values to compiled custom properties. @module */
import { MissingTransformError } from './css.js'
import type * as Literal from './internal/Literal.js'
import type * as Binding from './internal/Binding.js'

/** Compiled scalar slots, preserving each schema key and value domain. */
export type Definition<schema extends Schema = Schema> = {
  readonly [key in keyof schema]: Binding.Reference<schema[key]>
}

/** Declares a source-owned variable contract; a compile-time transform supplies its names. */
export function define<const schema extends Schema>(
  schema: schema,
): Definition<schema> {
  void schema
  throw new MissingTransformError()
}

/** Supported variable names and scalar domains. */
export type Schema = Readonly<Record<string, Binding.Kind>>

/** Returns inline custom-property assignments; never creates CSS rules. */
export function set<
  const schema extends Schema,
  const values extends Values<schema>,
>(
  definition: Definition<schema>,
  values: values & {
    [key in keyof values]: Literal.Checked<values[key]>
  } & Record<Exclude<keyof values, keyof schema>, never>,
): Readonly<Record<`--${string}`, number | string>> {
  const output: Record<`--${string}`, number | string> = Object.create(null)
  for (const key of Reflect.ownKeys(values)) {
    if (typeof key !== 'string')
      throw new TypeError('Unknown variable or accessor assignment.')
    const slot = Object.getOwnPropertyDescriptor(definition, key)?.value as
      | Binding.Reference
      | undefined
    const descriptor = Object.getOwnPropertyDescriptor(values, key)
    if (
      !slot ||
      !descriptor ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    )
      throw new TypeError('Unknown variable or accessor assignment.')
    const value: unknown = descriptor.value
    if (
      slot.type === 'number'
        ? typeof value !== 'number' || !Number.isFinite(value)
        : typeof value !== 'string' && !(slot.type === 'length' && value === 0)
    )
      throw new TypeError(
        'Variable assignments require a matching scalar primitive.',
      )
    output[slot.name] = value as number | string
  }
  return Object.freeze(output)
}

/** Partial assignments retain the domain of every declared variable. */
export type Values<schema extends Schema> = {
  readonly [key in keyof schema]?: Binding.Value<schema[key]>
}
