/** Declares single-element recipes for ahead-of-time compilation. @module */
import { MissingTransformError } from './css.js'
import type { css } from './css.js'
import type * as Style from './Style.js'
import type * as Theme from './Theme.js'

type Axes<definition> = definition extends { readonly variants: infer axes }
  ? axes
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
type Selections<axes> = {
  readonly [axis in keyof axes]?: Choice<axes[axis]> | null | undefined
}
type CheckedStyles<style, tokens extends Theme.Tokens> =
  style extends Record<string, unknown>
    ? Style.Accepted<style, tokens, true>
    : never
type Checked<definition, tokens extends Theme.Tokens> = {
  readonly [key in keyof definition]: key extends 'base'
    ? CheckedStyles<definition[key], tokens>
    : key extends 'variants'
      ? {
          readonly [axis in keyof definition[key]]: axis extends
            | keyof css.Options
            | 'class'
            | 'key'
            | 'ref'
            ? never
            : {
                readonly [choice in keyof definition[key][axis]]: CheckedStyles<
                  definition[key][axis][choice],
                  tokens
                >
              }
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
                    readonly style: CheckedStyles<style, tokens>
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
  definition: definition & NoInfer<Checked<definition, {}>>,
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
  > = <const definition extends Record<string, unknown>>(
    definition: definition & NoInfer<Checked<definition, tokens>>,
  ) => ReturnType<definition, output>

  /** Callable selection; omitted values use defaults and null suppresses them. */
  type ReturnType<definition, output extends css.Output = 'react'> = (
    input?: Selections<Axes<definition>> & css.Options,
  ) => css.Props<output> & {
    readonly [attribute: `data-${string}`]: string | undefined
  }
}
