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
      className: external
        ? className
          ? `${className} ${external}`
          : external
        : className,
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
