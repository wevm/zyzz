/** Compiles finite shared recipes into bounded native selection tables. @module */
import type * as Recipe from '../internal/Recipe.js'
import type * as Style from '../Style.js'
import * as StyleSheet from './StyleSheet.js'

/** Native recipe tables with the same finite choice metadata as web recipes. */
export type Definition<
  recipe extends Recipe.Definition = Recipe.Definition,
  themeName extends string = string,
> = {
  /** Ordered axes and their immutable finite choice names. */
  readonly axes: {
    readonly [axis in keyof recipe['axes']]: Readonly<recipe['axes'][axis]>
  }
  /** Default choices, with null suppressing an axis. */
  readonly defaults: Readonly<recipe['defaults']>
  /** Theme and scheme tables indexed by the mixed-radix selection index. */
  readonly styles: StyleSheet.compile.ReturnType<string, themeName>['styles']
}

/**
 * Compiles every finite selection, including omitted axes, before application.
 * @param options - Static recipe, vars, and explicit native destination inputs.
 * @returns Immutable native tables with at most 256 selections per set and scheme.
 * @throws {CompileError} When recipe data is invalid or exceeds the selection budget.
 * @throws {StyleSheet.CompileError} When selected declarations cannot compile for native.
 */
export function compile<
  const recipe extends Recipe.Definition,
  const themeName extends string = 'default',
>(
  options: compile.Options<recipe, themeName>,
): compile.ReturnType<recipe, themeName> {
  const { recipe, ...native } = options
  const axes = Object.entries(recipe.axes)
  let count = 1
  for (const [axis, choices] of axes) {
    if (
      !axis ||
      !Array.isArray(choices) ||
      !choices.length ||
      new Set(choices).size !== choices.length ||
      Array.from(choices).some((choice) => typeof choice !== 'string')
    )
      throw new CompileError('Recipe axes require unique string choices.')
    count *= choices.length + 1
    if (count > 256)
      throw new CompileError(
        'Native recipes support at most 256 selections, including null choices.',
      )
  }
  for (const [axis, choice] of Object.entries(recipe.defaults))
    if (
      !Object.hasOwn(recipe.axes, axis) ||
      (choice !== null && !recipe.axes[axis]!.includes(choice))
    )
      throw new CompileError('Defaults must select a declared axis and choice.')
  for (const rule of recipe.rules)
    for (const [axis, choices] of rule.matches)
      if (
        !Object.hasOwn(recipe.axes, axis) ||
        !choices.length ||
        choices.some((choice) => !recipe.axes[axis]!.includes(choice))
      )
        throw new CompileError('Compound matches must select declared choices.')

  const styles: Style.NamedStyle[] = []
  for (let index = 0; index < count; index++) {
    let remaining = index
    const selected = new Map<string, string | undefined>()
    for (const [axis, choices] of axes) {
      selected.set(axis, choices[remaining % (choices.length + 1)])
      remaining = Math.floor(remaining / (choices.length + 1))
    }
    const parts = recipe.rules
      .filter(({ matches }) =>
        matches.every(([axis, choices]) => {
          const choice = selected.get(axis)
          return choice !== undefined && choices.includes(choice)
        }),
      )
      .flatMap(({ value }) => value.styles)
    styles.push({
      name: String(index),
      declarations: [],
      rules: parts.map((style) => ({ style })),
    })
  }
  const tables = StyleSheet.compile({ ...native, styles: { styles } })
  return Object.freeze({
    axes: Object.freeze(
      Object.fromEntries(
        axes.map(([axis, choices]) => [axis, Object.freeze([...choices])]),
      ),
    ) as Definition<recipe, themeName>['axes'],
    defaults: Object.freeze({ ...recipe.defaults }),
    styles: tables.styles,
  })
}

/** Native recipe compilation inputs. */
export declare namespace compile {
  /** Destination mappings and target-neutral recipe declarations. */
  type Options<
    recipe extends Recipe.Definition = Recipe.Definition,
    themeName extends string = string,
  > = Omit<StyleSheet.compile.Options<string, themeName>, 'styles'> & {
    /** Validated static recipe retained by Source.extract. */
    readonly recipe: recipe
  }
  /** Immutable tables retaining recipe metadata and set labels. */
  type ReturnType<
    recipe extends Recipe.Definition = Recipe.Definition,
    themeName extends string = string,
  > = Definition<recipe, themeName>
}

/** Invalid or unbounded static recipe data. */
export class CompileError extends Error {
  /** Stable namespaced diagnostic name. */
  override name = 'Variants.CompileError'
}
