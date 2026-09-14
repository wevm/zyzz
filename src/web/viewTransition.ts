/** Declares stylesheet view-transition navigation and type descriptors. @module */
import type * as Context from './internal/Context.js'
import type * as Lexical from '../internal/Lexical.js'

/** Emits an eager view-transition rule. Browser navigation owns transition execution. */
export function viewTransition<
  const options extends Omit<viewTransition.Options, 'navigation'> & {
    readonly navigation?: string | undefined
  },
>(
  options: options &
    Record<Exclude<keyof options, keyof viewTransition.Options>, never> & {
      readonly types?: NoInfer<Types<options['types']>>
      readonly navigation?: Checked<
        options['navigation'],
        Exclude<viewTransition.Options['navigation'], undefined>
      >
    },
  context: Context.Options = {},
): void {
  void options
  void context
  return
}
/** Standard navigation and transition type descriptors. */
export declare namespace viewTransition {
  /** Static descriptors for cross-document view transitions. */
  type Options = {
    /** Whether matching same-origin navigation enables transitions. */
    readonly navigation?: 'auto' | 'none' | undefined
    /** CSS custom-identifier list or none. */
    readonly types?: string | undefined
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

/** CSS-text identifiers retain compiler validation for escapes and widened strings. */
type Types<value> = value extends string
  ? string extends value
    ? value
    : value extends `${string}\\${string}`
      ? value
      : Keyword<Lexical.Normalized<value>> extends 'none'
        ? value
        : Names<Lexical.Normalized<value>> extends true
          ? value
          : never
  : undefined

type Space = ' ' | '\t' | '\n' | '\r' | '\f'
type Names<value extends string> = value extends `${Space}${infer rest}`
  ? Names<rest>
  : value extends `${infer rest}${Space}`
    ? Names<rest>
    : value extends `${infer first}${Space}${infer rest}`
      ? Name<first> extends true
        ? Names<rest>
        : false
      : Name<value>
type Name<value extends string> = value extends
  | ''
  | '-'
  | `${number}${string}`
  | `-${number}${string}`
  ? false
  : value extends `${string}${',' | ';' | ':' | '(' | ')' | '{' | '}' | '[' | ']' | '"' | "'" | '/' | '!' | '.' | '+' | '=' | '#' | '@'}${string}`
    ? false
    : Lexical.Fold<value> extends
          | 'none'
          | 'default'
          | 'inherit'
          | 'initial'
          | 'revert'
          | 'revert-layer'
          | 'unset'
      ? false
      : true
