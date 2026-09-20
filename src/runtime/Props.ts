/**
 * Binds compiled classes to typed className and inline-style overrides.
 * @module
 */
import type { style } from '../styleFunction.js'

/**
 * Binds compiled classes to the web styling override contract.
 * Returns fresh props; without variable assignments, inline styles retain their identity.
 * Never generates rules or changes the supplied overrides.
 * @returns A callable accepting className, style, and vars.
 */
export function create({ className }: create.Options): style.ReturnType {
  return ((overrides?: style.Options) => {
    if (!overrides) return { className }

    const { className: external, style, vars } = overrides
    const inline = vars ? { ...vars, ...style } : style
    const merged =
      className && external ? `${className} ${external}` : external || className

    return inline ? { className: merged, style: inline } : { className: merged }
  }) as style.ReturnType
}

/** Contracts for generated static web callables. */
export declare namespace create {
  /** Compiled class binding. */
  type Options = {
    /** Complete generated class list. */
    readonly className: string
  }
}
