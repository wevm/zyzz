/** Lowers static recipe structure into ordered ordinary style conditions. @module */
import type * as Ast from '@oxc-project/types'
import type * as Recipe from '../../runtime/Recipe.js'
import * as Themes from './Themes.js'

type Property = Extract<
  Ast.ObjectExpression['properties'][number],
  { type: 'Property' }
>

function entries(node: Ast.Node): readonly (readonly [string, Property])[] {
  if (node.type !== 'ObjectExpression')
    throw new Themes.InvalidError('Recipes require static object bodies.', node)

  const seen = new Set<string>()
  return node.properties.map((property) => {
    if (
      property.type !== 'Property' ||
      property.computed ||
      property.method ||
      property.shorthand ||
      property.kind !== 'init'
    )
      throw new Themes.InvalidError(
        'Recipe structure requires explicit static keys.',
        property,
      )

    const key =
      property.key.type === 'Identifier'
        ? property.key.name
        : property.key.type === 'Literal'
          ? String(property.key.value)
          : undefined
    if (key === undefined || seen.has(key))
      throw new Themes.InvalidError('Recipe keys must be unique.', property)

    seen.add(key)
    return [key, property] as const
  })
}

function choice(node: Ast.Node, choices: readonly string[]): string | null {
  if (
    node.type !== 'Literal' ||
    !(
      node.value === null ||
      typeof node.value === 'string' ||
      typeof node.value === 'boolean'
    )
  )
    throw new Themes.InvalidError(
      'Selections require literal choice names, booleans, or null.',
      node,
    )

  if (node.value === null) return null
  const value = String(node.value)
  if (!choices.includes(value))
    throw new Themes.InvalidError('Unknown recipe choice.', node)

  return value
}

function predicate(axis: string, value: string): string {
  const quoted =
    '"' +
    value.replace(
      // oxlint-disable-next-line no-control-regex -- CSS strings require hexadecimal escapes for control characters.
      /[\x00-\x1f\x7f"\\]/g,
      (character) => `\\${character.codePointAt(0)!.toString(16)} `,
    ) +
    '"'
  return `[data-${axis}=${quoted}]`
}

/** Expands every finite alternative while retaining authored style-node locations. */
export function expand(node: Ast.ObjectExpression): {
  body: Ast.ObjectExpression
  recipe: Recipe.Definition
} {
  const properties: Ast.ObjectExpression['properties'] = []
  const fields = new Map(entries(node))
  const axes: Record<string, readonly string[]> = Object.create(null)
  const defaults: Record<string, string | null> = Object.create(null)

  for (const [key, property] of fields)
    if (
      !['base', 'variants', 'defaultVariants', 'compoundVariants'].includes(key)
    )
      throw new Themes.InvalidError(`Unknown recipe field: ${key}.`, property)

  const base = fields.get('base')
  if (base) {
    entries(base.value)
    properties.push(...(base.value as Ast.ObjectExpression).properties)
  }

  function append(
    property: Property,
    condition: string,
    value: Ast.Expression,
  ) {
    entries(value)
    properties.push({
      ...property,
      computed: false,
      key: {
        type: 'Literal',
        value: condition,
        raw: JSON.stringify(condition),
        start: property.key.start,
        end: property.key.end,
      },
      value,
    })
  }

  const variants = fields.get('variants')
  for (const [axis, property] of variants ? entries(variants.value) : []) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(axis) ||
      ['class', 'className', 'key', 'ref', 'style', 'variables'].includes(axis)
    )
      throw new Themes.InvalidError(
        'Recipe axes require lowercase data-attribute names and cannot use reserved props.',
        property,
      )

    const choices = entries(property.value)
    if (!choices.length)
      throw new Themes.InvalidError(
        'Recipe axes require at least one choice.',
        property,
      )

    axes[axis] = choices.map(([key]) => key)
    for (const [key, style] of choices)
      append(style, `&:where(${predicate(axis, key)})`, style.value)
  }

  const defaultVariants = fields.get('defaultVariants')
  for (const [axis, property] of defaultVariants
    ? entries(defaultVariants.value)
    : []) {
    if (!Object.hasOwn(axes, axis))
      throw new Themes.InvalidError('Unknown default variant axis.', property)

    defaults[axis] = choice(property.value, axes[axis]!)
  }

  const compounds = fields.get('compoundVariants')
  if (compounds) {
    if (compounds.value.type !== 'ArrayExpression')
      throw new Themes.InvalidError(
        'Compounds require a static array.',
        compounds,
      )

    for (const [index, element] of compounds.value.elements.entries()) {
      if (!element)
        throw new Themes.InvalidError(
          'Compounds require dense entries.',
          compounds,
        )
      const fields = new Map(entries(element))
      const when = fields.get('when')
      const style = fields.get('style')
      if (!when || !style || fields.size !== 2)
        throw new Themes.InvalidError(
          'Compounds require only when and style.',
          element,
        )

      let condition = '&'
      for (const [axis, property] of entries(when.value)) {
        if (!Object.hasOwn(axes, axis))
          throw new Themes.InvalidError(
            'Unknown compound variant axis.',
            property,
          )

        const values =
          property.value.type === 'ArrayExpression'
            ? property.value.elements
            : [property.value]
        if (!values.length || values.some((value) => !value))
          throw new Themes.InvalidError(
            'Compound matches require nonempty choices.',
            property,
          )

        condition += `:where(${values
          .map((value) => {
            const selected = choice(value!, axes[axis]!)
            if (selected === null)
              throw new Themes.InvalidError(
                'Compounds match choice names, not null.',
                value!,
              )
            return predicate(axis, selected)
          })
          .join(',')})`
      }

      // Distinct zero-specificity suffixes preserve repeated compound groups.
      append(style, condition + ':where(*)'.repeat(index + 1), style.value)
    }
  }

  return { body: { ...node, properties }, recipe: { axes, defaults } }
}
