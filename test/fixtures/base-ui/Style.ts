/** Explores component-aware selector completion without adding a runtime API. @module */
import type { Select } from '@base-ui/react/select'
import type { Style, style as rootStyle } from 'zyzz'
import type * as Completion from '../../../src/internal/Completion.js'

type CallbackState<callback> = callback extends (state: infer state) => unknown
  ? state
  : never

type State<component> = component extends (props: infer props) => unknown
  ? props extends { className?: infer className }
    ? CallbackState<className>
    : never
  : never

// These are explicit DOM contracts, not a camel-case conversion of state keys.
// Base UI 1.8 exports state types, but its component types carry no attribute schema.
type Catalog =
  | readonly [
      Select.Item.State,
      {
        'data-disabled': true
        'data-highlighted': true
        'data-selected': true
      },
    ]
  | readonly [
      Select.Popup.State,
      {
        'data-align': Select.Popup.State['align']
        'data-closed': true
        'data-ending-style': true
        'data-open': true
        'data-side': Select.Popup.State['side']
        'data-starting-style': true
      },
    ]
  | readonly [
      Select.Trigger.State,
      {
        'data-dirty': true
        'data-disabled': true
        'data-filled': true
        'data-focused': true
        'data-invalid': true
        'data-placeholder': true
        'data-popup-open': true
        'data-popup-side': NonNullable<Select.Trigger.State['popupSide']>
        'data-pressed': true
        'data-readonly': true
        'data-required': true
        'data-touched': true
        'data-valid': true
      },
    ]

type Equal<left, right> =
  (<value>() => value extends left ? 1 : 2) extends <
    value,
  >() => value extends right ? 1 : 2
    ? true
    : false

// Structural equality prevents subset matches, but cannot establish component identity.
// A custom component with the same State receives the same hints. See README.md.
type Attributes<state, entry = Catalog> = entry extends readonly [
  infer expected,
  infer attributes,
]
  ? Equal<state, expected> extends true
    ? attributes
    : never
  : never

type Selectors<attributes> = {
  [name in keyof attributes & string]:
    | `&[${name}]`
    | (attributes[name] extends string
        ? `&[${name}="${attributes[name]}"]`
        : never)
}[keyof attributes & string]

type Hints<component> = Completion.Properties & {
  readonly selectors?: {
    readonly [selector in Selectors<
      Attributes<State<component>>
    >]?: Hints<component>
  }
}

/**
 * Type-only prototype of style(Component, declarations). Do not execute this declaration.
 * Retains ordinary style overloads and literal validation. The component contributes
 * suggestions only, so arbitrary CSS selectors remain accepted.
 */
export declare const style: typeof rootStyle & {
  <
    const component extends (props: never) => unknown,
    const styles extends Record<string, unknown>,
  >(
    component: component,
    styles: styles &
      NoInfer<Style.Accepted<styles, {}, true>> &
      Hints<NoInfer<component>>,
  ): rootStyle.ReturnType
}
