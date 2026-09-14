/** Declares a named anchor-positioning fallback. @module */
import * as Identity from '../internal/Identity.js'
import type * as Style from '../Style.js'
import type * as RuleReference from '../internal/RuleReference.js'
import type * as Value from '../internal/Value.js'
import type * as Context from './internal/Context.js'

/** Emits the restricted position-try declaration set and returns its CSS name. */
export function positionTry<const declarations extends Record<string, unknown>>(
  declarations: declarations &
    NoInfer<
      Value.Accepted<declarations, positionTry.Declarations> &
        Value.Checked<declarations>
    >,
  context: Context.Options = {},
): positionTry.Reference {
  void declarations
  void context
  return Identity.contribution(
    'positionTry',
    context.id,
  ) as positionTry.Reference
}
/** Anchor fallback declaration and reference contracts. */
export declare namespace positionTry {
  /** Properties permitted in a position-try block. */
  type Declarations = Pick<
    Style.DeclarationProperties,
    | 'alignSelf'
    | 'blockSize'
    | 'bottom'
    | 'height'
    | 'inlineSize'
    | 'inset'
    | 'insetBlock'
    | 'insetBlockEnd'
    | 'insetBlockStart'
    | 'insetInline'
    | 'insetInlineEnd'
    | 'insetInlineStart'
    | 'justifySelf'
    | 'left'
    | 'margin'
    | 'marginBlock'
    | 'marginBlockEnd'
    | 'marginBlockStart'
    | 'marginBottom'
    | 'marginInline'
    | 'marginInlineEnd'
    | 'marginInlineStart'
    | 'marginLeft'
    | 'marginRight'
    | 'marginTop'
    | 'maxBlockSize'
    | 'maxHeight'
    | 'maxInlineSize'
    | 'maxWidth'
    | 'minBlockSize'
    | 'minHeight'
    | 'minInlineSize'
    | 'minWidth'
    | 'placeSelf'
    | 'positionAnchor'
    | 'positionArea'
    | 'right'
    | 'top'
    | 'width'
  >
  /** Compiler-owned position fallback name. */
  type Reference = RuleReference.Reference<'positionTry'>
}
