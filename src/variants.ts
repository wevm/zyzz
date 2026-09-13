/** Declares single-element recipes for ahead-of-time compilation. @module */
import type { css } from './css.js'
import type * as Config from './Config.js'
import type * as Condition from './internal/Condition.js'
import type * as Shorthands from './internal/Shorthands.js'
import type * as Style from './Style.js'
import type * as Theme from './Theme.js'

type Axes<definition> = definition extends { readonly variants: infer axes }
  ? axes
  : {}
type Conditions<definition> = definition extends {
  readonly conditions: infer conditions
}
  ? conditions
  : {}
type Choice<choices> = keyof choices extends infer key
  ? key extends 'true' | 'false'
    ? key extends 'true'
      ? true
      : false
    : key extends string
      ? key
      : never
  : never
type Keys<value> = value extends unknown ? keyof value : never
type Selections<axes> = {
  readonly [axis in keyof axes]?: Choice<axes[axis]> | null | undefined
}
type Input<definition> = Selections<Axes<definition>> &
  css.Options &
  (keyof Conditions<definition> extends never
    ? {}
    : {
        readonly conditions?:
          | {
              readonly [name in keyof Conditions<definition>]?:
                | Selections<Axes<definition>>
                | undefined
            }
          | undefined
      })
type CheckedStyles<
  style,
  tokens extends Theme.Tokens,
  layers extends string,
  mappings extends Shorthands.Map,
> =
  style extends Record<string, unknown>
    ? [keyof mappings | layers] extends [never]
      ? Style.Accepted<style, tokens, keyof tokens extends never ? true : false>
      : Config.Body<style, tokens, layers, mappings>
    : never
type Checked<
  definition,
  tokens extends Theme.Tokens,
  layers extends string,
  mappings extends Shorthands.Map,
> = {
  readonly [key in keyof definition]: key extends 'base'
    ? CheckedStyles<definition[key], tokens, layers, mappings>
    : key extends 'variants'
      ? {
          readonly [axis in keyof definition[key]]: axis extends
            | keyof css.Options
            | 'class'
            | 'conditions'
            | 'key'
            | 'ref'
            | `zyzz-condition-${string}`
            ? never
            : {
                readonly [choice in keyof definition[key][axis]]: CheckedStyles<
                  definition[key][axis][choice],
                  tokens,
                  layers,
                  mappings
                >
              }
        }
      : key extends 'conditions'
        ? {
            readonly [name in keyof definition[key]]: Extract<
              Condition.Keys<tokens>,
              `@${'media' | 'supports'}${' ' | '(' | '/' | '\t' | '\n' | '\r' | '\f'}${string}`
            >
          }
        : key extends 'defaultVariants'
          ? Selections<Axes<definition>> &
              Record<
                Exclude<keyof definition[key], keyof Axes<definition>>,
                never
              >
          : key extends 'compoundVariants'
            ? readonly {
                readonly when: {
                  readonly [axis in keyof Axes<definition>]?:
                    | Choice<Axes<definition>[axis]>
                    | readonly Choice<Axes<definition>[axis]>[]
                }
                readonly style: Record<string, unknown>
              }[] & {
                readonly [index in keyof definition[key]]: definition[key][index] extends {
                  readonly style: infer style
                  readonly when: infer when
                }
                  ? {
                      readonly style: CheckedStyles<
                        style,
                        tokens,
                        layers,
                        mappings
                      >
                      readonly when: Record<
                        Exclude<keyof when, keyof Axes<definition>>,
                        never
                      >
                    } & Record<
                      Exclude<keyof definition[key][index], 'style' | 'when'>,
                      never
                    >
                  : definition[key][index]
              }
            : never
}

/**
 * Declares base styles, variant axes, defaults, and ordered compounds.
 * @param definition - Static recipe for one element.
 * @returns A callable selecting precompiled styles and returning one props object.
 * @throws {MissingTransformError} When authoring executes without compilation.
 */
export function variants<const definition extends Record<string, unknown>>(
  definition: definition & NoInfer<Checked<definition, {}, never, {}>>,
): variants.ReturnType<definition> {
  void definition
  throw new MissingTransformError()
}

/** Inferred recipe authoring and selection contracts. */
export declare namespace variants {
  /** Theme-bound authoring with the same inferred selection contract. */
  type Bound<
    tokens extends Theme.Tokens,
    output extends css.Output = 'react',
    layers extends string = never,
    mappings extends Shorthands.Map = {},
  > = <const definition extends Record<string, unknown>>(
    definition: definition &
      NoInfer<Checked<definition, tokens, layers, mappings>>,
  ) => ReturnType<definition, output>

  /** Callable selection; omitted values use defaults and null suppresses them. */
  type ReturnType<definition, output extends css.Output = 'react'> = <
    const input extends Input<definition> = Input<definition>,
  >(
    input?: input &
      Record<Exclude<Keys<input>, keyof Input<definition>>, never>,
  ) => css.Props<output> & {
    readonly [axis in keyof Axes<definition> as `data-${axis & string}`]?:
      | string
      | undefined
  }

  /** Missing source transformation diagnostic. */
  type ErrorType = MissingTransformError
}

/** Executed recipe authoring has not been rewritten. */
export class MissingTransformError extends Error {
  /** Explains the required recipe transformation. */
  constructor() {
    super(
      'variants requires a compile-time transform. Do not execute untransformed recipe authoring.',
    )
  }
  /** Stable recipe diagnostic name. */
  override name = 'variants.MissingTransformError'
}
