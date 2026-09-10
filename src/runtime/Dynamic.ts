/** Assigns fixed private variables for compiled dynamic styles. @module */
import type { css } from '../css.js'
import * as Props from './Props.js'

/** Binds required runtime scalars to fixed private variables and merges styling overrides. */
export function create(
  options: create.Options,
): css.Dynamic<Record<string, string | number>> {
  const bind = Props.create({ className: options.className })
  return (input) => {
    const style: Record<`--${string}`, string | number> = Object.create(null)
    for (const [key, slot] of Object.entries(options.slots)) {
      const value = input[key]!
      style[slot.name] = value === '' ? ' ' : value
    }
    const result = bind({ className: input.className, style: input.style })
    return { ...result, style: { ...result.style, ...style } }
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
