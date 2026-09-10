/** Assigns fixed private variables for compiled dynamic styles. @module */
import type { css } from '../css.js'

/** Binds required runtime scalars to fixed private variables and merges styling overrides. */
export function create(
  options: create.Options,
): css.Dynamic<Record<string, string | number>> {
  const { className } = options
  const slots = Object.entries(options.slots)
  return (input) => {
    const values = slots.map(([key]) => {
      const value = input[key]!
      return value === '' ? ' ' : value
    })
    const external = input.className
    const style = { ...input.style }
    for (let index = 0; index < slots.length; index++)
      style[slots[index]![1].name] = values[index]!
    return {
      className:
        className && external
          ? `${className} ${external}`
          : external || className,
      style,
    }
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
      Record<
        string,
        {
          readonly name: `--${string}`
          readonly type: string
          readonly zero?: boolean
        }
      >
    >
  }
}
