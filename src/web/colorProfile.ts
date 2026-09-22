/** Declares a compiler-owned colorProfile stylesheet identity. @module */
import type * as Context from './internal/Context.js'
import type * as Lexical from '../internal/Lexical.js'
import * as Identity from '../internal/Identity.js'
import type * as RuleReference from '../internal/RuleReference.js'

/** Emits static descriptors and returns a domain-specific CSS name. */
export function colorProfile<const options extends Record<string, unknown>>(
  options: options & NoInfer<Accepted<options>>,
  context: Context.Options = {},
): colorProfile.Reference {
  void options
  void context
  return Identity.contribution(
    'colorProfile',
    context.id,
  ) as colorProfile.Reference
}
/** Descriptor and identity contracts. */
export declare namespace colorProfile {
  /** Exact CSS descriptor input; declaration order is preserved. */
  type Options = {
    /** Ordered, comma-separated component names for relative colors. */
    readonly components?: string | undefined
    /** CSS renderingIntent descriptor. */
    readonly renderingIntent?:
      | 'absolute-colorimetric'
      | 'relative-colorimetric'
      | 'perceptual'
      | 'saturation'
      | undefined
    /** CSS src descriptor. */
    readonly src: string
  }
  /** Compiler-owned reference usable in the matching CSS domain. */
  type Reference = RuleReference.Reference<'colorProfile'>
}

type Intent<value> = value extends string
  ? Keyword<Lexical.Normalized<value>> extends Exclude<
      colorProfile.Options['renderingIntent'],
      undefined
    >
    ? value
    : never
  : undefined
type Keyword<value extends string> =
  value extends `${' ' | '\t' | '\n' | '\r' | '\f'}${infer rest}`
    ? Keyword<rest>
    : value extends `${infer rest}${' ' | '\t' | '\n' | '\r' | '\f'}`
      ? Keyword<rest>
      : Lexical.Fold<value>

type Accepted<input> = {
  [key in keyof input as key extends Context.Group ? key : never]: Accepted<
    input[key]
  >
} & (keyof input extends never
  ? Definition<input>
  : Exclude<keyof input, Context.Group> extends never
    ? unknown
    : Definition<Omit<input, Context.Group>>)

type Definition<options> = options extends Omit<
  colorProfile.Options,
  'renderingIntent'
> & {
  readonly renderingIntent?: string | undefined
}
  ? options &
      Record<Exclude<keyof options, keyof colorProfile.Options>, never> &
      RuleReference.Checked<options> & {
        readonly renderingIntent?: Intent<options['renderingIntent']>
      }
  : never
