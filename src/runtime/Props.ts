/**
 * Binds compiled classes to validated className and inline-style overrides.
 * @module
 */
import type { css } from '../css.js'

/**
 * Binds compiled classes to the web styling override contract.
 * Never generates rules or changes the supplied overrides.
 * @param options - Classes emitted by a compiler.
 * @returns A callable accepting only className and style.
 */
export function create(options: create.Options): css.ReturnType {
  const { className } = options

  return (overrides: css.Options = {}) => {
    if (
      typeof overrides !== 'object' ||
      overrides === null ||
      Array.isArray(overrides) ||
      Reflect.ownKeys(overrides).some(
        (key) => key !== 'className' && key !== 'style',
      )
    )
      throw new TypeError('Expected only className and style overrides.')

    const { className: external, style } = overrides
    if (external !== undefined && typeof external !== 'string')
      throw new TypeError('Expected a string className override.')

    if (
      style !== undefined &&
      (typeof style !== 'object' || style === null || Array.isArray(style))
    )
      throw new TypeError('Expected an inline style object.')

    return {
      className:
        className && external
          ? `${className} ${external}`
          : external || className,
      ...(style === undefined ? {} : { style: { ...style } }),
    }
  }
}

/** Contracts for generated static web callables. */
export declare namespace create {
  /** Compiled class binding. */
  type Options = {
    /** Complete generated class list. */
    readonly className: string
  }
}

/** Binds required runtime scalars to fixed private variables and merges styling overrides. */
export function dynamic(
  options: dynamic.Options,
): css.Dynamic<Record<string, string | number>> {
  const bind = create({ className: options.className })
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
export declare namespace dynamic {
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
