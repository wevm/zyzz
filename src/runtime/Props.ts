/**
 * Binds compiled classes to typed className and inline-style overrides.
 * @module
 */
import type { css } from '../css.js'

/**
 * Binds compiled classes to the web styling override contract.
 * Returns fresh props; without variable assignments, inline styles retain their identity.
 * Never generates rules or changes the supplied overrides.
 * @returns A callable accepting className, style, and variables.
 */
export function create({ className }: create.Options): css.ReturnType {
  return ((overrides?: css.Options) => {
    if (!overrides) return { className }

    const { className: external, style, variables } = overrides
    const inline = variables ? { ...variables, ...style } : style
    const merged =
      className && external ? `${className} ${external}` : external || className

    return inline ? { className: merged, style: inline } : { className: merged }
  }) as css.ReturnType
}

/** Contracts for generated static web callables. */
export declare namespace create {
  /** Compiled class binding. */
  type Options = {
    /** Complete generated class list. */
    readonly className: string
  }
}
