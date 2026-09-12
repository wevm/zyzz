/** Declares named OpenType feature sets for a font family list. @module */
import type * as Context from './internal/Context.js'
import type * as Lexical from '../internal/Lexical.js'
import { MissingTransformError } from '../css.js'

/** Emits eager font feature aliases in authored block and declaration order. */
export function fontFeatureValues<
  const options extends Omit<fontFeatureValues.Options, 'fontDisplay'> & {
    readonly fontDisplay?: string | undefined
  },
>(
  options: options &
    Record<Exclude<keyof options, keyof fontFeatureValues.Options>, never> & {
      readonly fontDisplay?: Checked<
        options['fontDisplay'],
        Exclude<fontFeatureValues.Options['fontDisplay'], undefined>
      >
    } & {
      readonly features: Record<
        Exclude<
          keyof options['features'],
          keyof fontFeatureValues.Options['features']
        >,
        never
      >
    },
  context: Context.Options = {},
): void {
  void options
  void context
  throw new MissingTransformError()
}
/** Family, display, and nested feature alias contracts. */
export declare namespace fontFeatureValues {
  /** Static font family list and named OpenType feature blocks. */
  type Options = {
    /** CSS font family list, or individually quoted family names. */
    readonly families: string | readonly [string, ...string[]]
    /** Named feature groups. */
    readonly features: {
      /** Annotation feature indices. */
      readonly '@annotation'?: Readonly<Record<string, number>> | undefined
      /** Character variant index and optional variation selector. */
      readonly '@character-variant'?:
        | Readonly<Record<string, number | readonly [number, number]>>
        | undefined
      /** Ornament feature indices. */
      readonly '@ornaments'?: Readonly<Record<string, number>> | undefined
      /** Ordered stylistic-set indices. */
      readonly '@styleset'?:
        | Readonly<Record<string, number | readonly [number, ...number[]]>>
        | undefined
      /** Stylistic alternate indices. */
      readonly '@stylistic'?: Readonly<Record<string, number>> | undefined
      /** Swash feature indices. */
      readonly '@swash'?: Readonly<Record<string, number>> | undefined
    }
    /** Font display policy for the family aliases. */
    readonly fontDisplay?:
      | 'auto'
      | 'block'
      | 'fallback'
      | 'optional'
      | 'swap'
      | undefined
  }
}

type Keyword<value extends string> =
  value extends `${' ' | '\t' | '\n' | '\r' | '\f'}${infer rest}`
    ? Keyword<rest>
    : value extends `${infer rest}${' ' | '\t' | '\n' | '\r' | '\f'}`
      ? Keyword<rest>
      : Lexical.Fold<value>

type Checked<value, domain> = value extends string
  ? Keyword<Lexical.Normalized<value>> extends domain
    ? value
    : never
  : undefined
