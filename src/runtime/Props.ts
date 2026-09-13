/**
 * Binds compiled classes to typed className and inline-style overrides.
 * @module
 */
import type { css } from '../css.js'

/**
 * Binds compiled classes to the web styling override contract.
 * Returns fresh props; without variable assignments, inline styles retain their identity.
 * Never generates rules or changes the supplied overrides.
 * @param options - Classes emitted by a compiler.
 * @returns A callable accepting className, style, and variables.
 */
export function create(options: create.Options): css.ReturnType {
  const { className } = options

  return ((overrides?: css.Options) => {
    if (overrides === undefined) return { className }

    const { className: external, style, variables } = overrides
    const inline = variables === undefined ? style : { ...variables, ...style }
    const merged =
      className && external ? `${className} ${external}` : external || className

    return inline === undefined
      ? { className: merged }
      : { className: merged, style: inline }
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
