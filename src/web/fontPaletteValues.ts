/** Declares a compiler-owned fontPaletteValues stylesheet identity. @module */
import * as Identity from '../internal/Identity.js'
import type * as RuleReference from '../internal/RuleReference.js'
import type * as Context from './internal/Context.js'

/** Emits static descriptors and returns a domain-specific CSS name. */
export function fontPaletteValues<
  const options extends fontPaletteValues.Options,
>(
  options: options &
    Record<Exclude<keyof options, keyof fontPaletteValues.Options>, never> &
    RuleReference.Checked<options> &
    (options extends { basePalette: infer value extends number }
      ? `${value}` extends `${bigint}`
        ? `${value}` extends `-${string}`
          ? never
          : unknown
        : never
      : unknown),
  context: Context.Options = {},
): fontPaletteValues.Reference {
  void options
  void context
  return Identity.contribution(
    'fontPaletteValues',
    context.id,
  ) as fontPaletteValues.Reference
}
/** Descriptor and identity contracts. */
export declare namespace fontPaletteValues {
  /** Exact CSS descriptor input; declaration order is preserved. */
  type Options = {
    /** CSS basePalette descriptor. */
    readonly basePalette?: 'light' | 'dark' | number | undefined
    /** CSS fontFamily descriptor. */
    readonly fontFamily: string
    /** CSS overrideColors descriptor. */
    readonly overrideColors?: string | undefined
  }
  /** Compiler-owned reference usable in the matching CSS domain. */
  type Reference = RuleReference.Reference<'fontPaletteValues'>
}
