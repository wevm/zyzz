/** Assigns fixed private variables for compiled dynamic styles. @module */
import type { style } from '../styleFunction.js'

/** Binds required runtime scalars to fixed private variables and merges styling overrides. */
export function create(
  options: create.Options,
): style.Dynamic<Record<string, string | number>> {
  const { className } = options
  const slots = Object.entries(options.slots)

  return ((input: Record<string, string | number> & style.Options) => {
    const values = slots.map(([key]) => {
      const value = input[key]!

      return value === '' ? ' ' : value
    })
    const external = input.className
    const style: Record<string, string | number | undefined> = {
      ...input.vars,
      ...input.style,
    }

    for (let index = 0; index < slots.length; index++)
      style[slots[index]![1].name] = values[index]!

    return {
      className:
        className && external
          ? `${className} ${external}`
          : external || className,
      style,
    }
  }) as style.Dynamic<Record<string, string | number>>
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
