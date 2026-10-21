/** Serializes conditional recipe instructions without evaluating queries. @module */
import type { style } from '../styleFunction.js'
import * as Html from './Html.js'
import * as Recipe from './Recipe.js'

/** Shared compiler/runtime spelling for a conditional selection attribute. */
export function attribute(options: attribute.Options): `data-${string}` {
  return `data-zyzz-condition-${options.condition}-${options.axis}`
}

/** Conditional attribute identity. */
export declare namespace attribute {
  /** Statically assigned axis and condition index. */
  type Options = {
    /** Declared axis name. */
    readonly axis: string
    /** Index in authored condition order. */
    readonly condition: number
  }
}

/** Binds conditional instructions while leaving query evaluation entirely to CSS. */
export function create(options: create.Options) {
  const base = Recipe.create({ ...options, html: false })
  const prefix = options.prefix
  const conditions = options.conditions.map((name, condition) => ({
    name,
    axes: Object.keys(options.axes).map((axis, index) => ({
      axis,
      attribute: attribute({ axis, condition }),
      // Class selection marks the override and adds the choice class for this condition.
      classes: prefix
        ? {
            choices: new Map(
              options.axes[axis]!.map((name, position) => [
                name,
                options.silent?.[axis]?.includes(name)
                  ? ''
                  : ` ${Recipe.choice({ axis: index, choice: position, condition, prefix })}`,
              ]),
            ),
            overridden: ` ${Recipe.overridden({ axis: index, condition, prefix })}`,
          }
        : undefined,
    })),
  }))

  return (input: Record<string, unknown> & style.Options = {}) => {
    // The base was explicitly bound to React-shaped props above; HTML
    // serialization occurs once, after all conditional attributes are added.
    const result = base(input) as style.Props & Record<`data-${string}`, string>
    const selected = input.conditions as
      | Record<
          string,
          Record<string, string | boolean | null | undefined> | undefined
        >
      | undefined
    let classes = ''
    for (const condition of conditions) {
      const selections =
        selected && Object.hasOwn(selected, condition.name)
          ? selected[condition.name]
          : undefined
      if (!selections) continue

      for (const entry of condition.axes) {
        const value = Object.hasOwn(selections, entry.axis)
          ? selections[entry.axis]
          : undefined
        if (value === undefined) continue

        if (entry.classes)
          classes +=
            entry.classes.overridden +
            (value === null
              ? ''
              : (entry.classes.choices.get(String(value)) ?? ''))
        else result[entry.attribute] = value === null ? 'n' : `s${value}`
      }
    }

    if (classes)
      (result as { className: string }).className =
        `${result.className ?? ''}${classes}`.trimStart()

    return options.html ? Html.from(result) : result
  }
}

/** Conditional recipe initialization inputs. */
export declare namespace create {
  /** Static recipe metadata with a declared condition order. */
  type Options = Recipe.create.Options & {
    /** Names whose overrides are serialized by the returned callable. */
    readonly conditions: readonly string[]
  }
}
