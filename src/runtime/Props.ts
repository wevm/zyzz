/**
 * Binds compiled classes to typed className and inline-style overrides.
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
    const { className: external, style } = overrides
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
