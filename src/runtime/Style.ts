/**
 * Carries static style values through component props and resolves DOM attributes.
 * @module
 */
import type { style } from '../authoring/style.js'
import * as StyleValue from '../internal/StyleValue.js'

/**
 * Resolves a forwarded style value at an intrinsic JSX element boundary.
 * Ordinary props are returned unchanged. Explicit element props override metadata;
 * external classes are appended, and inline declarations remain inline.
 * @param props - Element props evaluated once in authored order.
 * @returns DOM props without the opaque style metadata.
 */
export function resolve(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const input = props.style
  if (!input || typeof input !== 'object' || !(StyleValue.metadata in input))
    return props

  const { [StyleValue.metadata]: compiled, ...inline } =
    input as style.ReturnType
  const external = props.className
  return {
    ...props,
    className: [compiled.className, external].filter(Boolean).join(' '),
    style: Object.keys(inline).length ? inline : undefined,
  }
}

/**
 * Carries precompiled classes through native style props and custom components.
 * @param props - Static class metadata emitted by the compiler.
 * @returns An immutable style value; no CSS rules are generated.
 */
export function value(props: value.Options): style.ReturnType {
  return Object.freeze({ [StyleValue.metadata]: Object.freeze(props) })
}

/** Inputs for the compiler's immutable style transport. */
export declare namespace value {
  /** Precompiled class metadata. */
  type Options = {
    /** Complete class list matching an emitted stylesheet. */
    readonly className: string
  }
}
