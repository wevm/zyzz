/** Component-aware static declarations layered over ordinary style overloads. @module */
import type * as Completion from '../../internal/Completion.js'
import type * as Condition from '../../internal/Condition.js'
import type * as Configuration from '../../internal/Configuration.js'
import type * as Part from './Part.js'
import type * as Shorthands from '../../internal/Shorthands.js'
import type * as Theme from '../../internal/Theme.js'
import type * as Types from './internal/Types.generated.js'
// Root entrypoint references keep inferred definitions nameable in consumer declaration emit.
import type * as Zyzz from '../../index.js'
import * as Authoring from './internal/Authoring.js'
import { style as rootStyle } from '../../styleFunction.js'

type MarkerKeys<marker> = {
  [key in keyof marker]-?: true extends marker[key] ? key : never
}[keyof marker]

type Keys<input> = input extends { readonly [Types.part]?: infer marker }
  ? MarkerKeys<marker>
  : never

type Identity<component> = component extends (props: infer props) => unknown
  ? Extract<Keys<component> | Keys<props>, keyof Types.Parts>
  : never

type Declared<component> = component extends {
  readonly [Part.marker]: infer states extends Part.Part.States
}
  ? states
  : never

// Declared boolean states match presence. Other declared states list their values.
type States<states, body> = {
  readonly [name in keyof states]?: states[name] extends boolean
    ? body
    : { readonly [value in states[name] & string]?: body }
}

// A declared part's state domains, or the identity of a catalogued Base UI part.
type Contract<component> = [Declared<component>] extends [never]
  ? Identity<component>
  : Declared<component>

type Domain<contract, body> = [contract] extends [keyof Types.Parts]
  ? Types.States<body>[contract]
  : States<contract, body>

type Selectors<contract> = [contract] extends [keyof Types.Parts]
  ? Types.Selectors[contract]
  : {}

type Hints<
  part extends keyof Types.Parts,
  tokens extends Theme.Tokens,
> = Completion.Properties<tokens> & {
  readonly selectors?: {
    readonly [selector in keyof Types.Selectors[part]]?: Hints<part, tokens>
  } & Readonly<Record<string, Hints<part, tokens>>>
  readonly states?: Types.States<Hints<part, tokens>>[part]
} & {
  readonly [key in Condition.Keys<tokens> | Condition.Suggestions]?: Hints<
    part,
    tokens
  >
}

type ContractHints<
  contract,
  tokens extends Theme.Tokens,
> = Completion.Properties<tokens> & {
  readonly selectors?: {
    readonly [selector in keyof Selectors<contract>]?: ContractHints<
      contract,
      tokens
    >
  } & Readonly<Record<string, ContractHints<contract, tokens>>>
  readonly states?: Domain<contract, ContractHints<contract, tokens>>
} & {
  readonly [key in
    | Condition.Keys<tokens>
    | Condition.Suggestions]?: ContractHints<contract, tokens>
}

// `table[part]` lists the state domains a body accepts.
type Body<
  input,
  table,
  part extends keyof table,
  tokens extends Theme.Tokens,
  layers extends string,
  mappings extends Shorthands.Map,
> = {
  readonly [key in keyof input]: key extends 'states'
    ? {
        readonly [name in keyof input[key]]: name extends keyof table[part]
          ? NonNullable<table[part][name]> extends true
            ? Body<input[key][name], table, part, tokens, layers, mappings>
            : {
                readonly [value in keyof input[key][name]]: value extends keyof NonNullable<
                  table[part][name]
                >
                  ? Body<
                      input[key][name][value],
                      table,
                      part,
                      tokens,
                      layers,
                      mappings
                    >
                  : never
              }
          : never
      }
    : key extends 'selectors'
      ? {
          readonly [selector in keyof input[key]]: Body<
            input[key][selector],
            table,
            part,
            tokens,
            layers,
            mappings
          >
        }
      : key extends Configuration.Nested<tokens, key, layers>
        ? Body<input[key], table, part, tokens, layers, mappings>
        : Configuration.Body<Pick<input, key>, tokens, layers, mappings>[key]
}

// Component-first static overloads. Ordinary style overloads remain available.
// Catalogued parts resolve through their constrained contracts first. The general last
// signature accepts declared parts, and reports the diagnostics of either kind of part.
type Component<
  tokens extends Theme.Tokens = {},
  layers extends string = never,
  mappings extends Shorthands.Map = {},
> = {
  <const component, const input extends Record<string, unknown>>(
    component: component &
      ([Identity<NoInfer<component>>] extends [never] ? never : unknown),
    styles: input &
      NoInfer<
        Body<
          input,
          Types.States<true>,
          Identity<component>,
          tokens,
          layers,
          mappings
        >
      > &
      Hints<Identity<NoInfer<component>>, tokens>,
    options?: Zyzz.style.DefinitionOptions,
  ): Zyzz.style.ReturnType
  <const component, const input extends Record<string, unknown>>(
    component: component &
      ([Contract<NoInfer<component>>] extends [never] ? never : unknown),
    styles: input &
      NoInfer<
        Body<
          input,
          { readonly part: Domain<Contract<component>, true> },
          'part',
          tokens,
          layers,
          mappings
        >
      > &
      ContractHints<Contract<NoInfer<component>>, tokens>,
    options?: Zyzz.style.DefinitionOptions,
  ): Zyzz.style.ReturnType
}

type Values<options> = options extends { vars: infer values }
  ? options extends { defaultVars: infer name extends keyof values }
    ? Zyzz.Vars.Extract<values[name]>
    : Zyzz.Vars.Extract<values>
  : {}

/**
 * The `style` helper of `defineConfig` from this entrypoint: the ordinary configured
 * overloads plus component-first static styles for Base UI parts and declared parts.
 * Declaration emit names inferred configured helpers with this type.
 * @example
 * ```ts
 * import { defineConfig, type Factory } from 'zyzz/base-ui/react'
 *
 * // An explicit annotation of the configured helper.
 * export const style: Factory<{ id: 'app' }> = defineConfig({ id: 'app' }).style
 * ```
 */
export type Factory<options extends Zyzz.Config.create.Options = {}> =
  Zyzz.Config.create.ReturnType<options>['style'] &
    Component<
      Zyzz.Vars.Mapped<
        Values<options>,
        options extends { mappings: infer map } ? map : {}
      >,
      options extends { layers: readonly (infer layer extends string)[] }
        ? layer
        : never,
      options extends { shorthands: infer map extends Shorthands.Map }
        ? map
        : {}
    >

/**
 * Declares styles for an imported Base UI part, a component declared with `part`, or
 * ordinary token-free styles. Component-first calls accept static objects. `states`
 * checks documented or declared attributes, while `selectors` suggests Base UI attributes
 * and accepts arbitrary CSS selectors. Compilation resolves component imports and emits
 * CSS ahead of time. No component wrapper, registration, or runtime CSS insertion is required.
 * @see https://base-ui.com/react/handbook/styling
 */
export const style: typeof rootStyle & Component = Authoring.bind(
  rootStyle as Authoring.bind.Factory,
) as typeof rootStyle & Component
