/** Assigns fixed private variables for compiled dynamic styles. @module */
import type { css } from '../css.js'
import * as Props from './Props.js'

/** Binds required runtime scalars to fixed private variables and merges styling overrides. */
export function create(
  options: create.Options,
): css.Dynamic<Record<string, string | number>> {
  const bind = Props.create({ className: options.className })
  const names = new Set(Object.values(options.slots).map((slot) => slot.name))
  return (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new TypeError('Expected dynamic style inputs.')
    if (
      Reflect.ownKeys(input).some(
        (key) =>
          typeof key !== 'string' ||
          (!Object.hasOwn(options.slots, key) &&
            key !== 'className' &&
            key !== 'style'),
      )
    )
      throw new TypeError('Unknown dynamic style input.')
    const style: Record<`--${string}`, string | number> = Object.create(null)
    for (const [key, slot] of Object.entries(options.slots)) {
      const property = Object.getOwnPropertyDescriptor(input, key)
      if (!property || !('value' in property))
        throw new TypeError('Missing dynamic style input or accessor value.')
      const value: unknown = property.value
      if (
        slot.type === 'number'
          ? typeof value !== 'number' || !Number.isFinite(value)
          : typeof value !== 'string'
      )
        throw new TypeError(
          'Dynamic style inputs require matching scalar primitives.',
        )
      style[slot.name] = value as string | number
    }
    const overrides = { className: input.className, style: input.style }
    const result = bind(overrides)
    if (
      result.style &&
      Object.keys(result.style).some((key) => names.has(key as `--${string}`))
    )
      throw new TypeError('Private dynamic variables cannot be overridden.')
    return { ...result, style: { ...style, ...result.style } }
  }
}

/** Contracts for compiler-generated dynamic callables. */
export declare namespace create {
  /** Fixed class and private slot assignments supplied by compilation. */
  type Options = {
    /** Complete generated class list. */
    readonly className: string
    /** Required scalar slots keyed by input name. */
    readonly slots: Readonly<
      Record<string, { readonly name: `--${string}`; readonly type: string }>
    >
  }
}
