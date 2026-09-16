/** Lowers static recipe structure into ordered ordinary style conditions. @module */
import type * as Ast from '@oxc-project/types'
import type * as Query from '../../internal/Query.js'
import * as ConditionalRecipe from '../../runtime/ConditionalRecipe.js'
import type * as Recipe from '../../runtime/Recipe.js'
import type * as StaticRecipe from '../../internal/Recipe.js'
import * as Expression from './Expression.js'
import * as RecipeConditions from './RecipeConditions.js'
import * as RecipePayloads from './RecipePayloads.js'
import * as Themes from './Themes.js'

type Property = Extract<
  Ast.ObjectExpression['properties'][number],
  { type: 'Property' }
>

function object(node: Ast.Node): asserts node is Ast.ObjectExpression {
  if (node.type !== 'ObjectExpression')
    throw new Themes.InvalidError('Recipes require static object bodies.', node)
}

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

function predicate(attribute: string, value: string): string {
  const quoted =
    '"' +
    value.replace(
      // oxlint-disable-next-line no-control-regex -- CSS strings require hexadecimal escapes for control characters.
      /[\x00-\x1f\x7f"\\]/g,
      (character) => `\\${character.codePointAt(0)!.toString(16)} `,
    ) +
    '"'
  return `[${attribute}=${quoted}]`
}

/** Expands every finite alternative while retaining authored style-node locations. */
export function expand(
  node: Ast.ObjectExpression,
  options: expand.Options,
): {
  bindings: RecipePayloads.Bindings
  types: { readonly [axis: string]: { readonly [choice: string]: string } }
  body: Ast.ObjectExpression
  recipe: Recipe.Definition
  staticRecipe?: StaticRecipe.Definition<Ast.ObjectExpression> | undefined
} {
  const bindings = RecipePayloads.create(options)
  const payloads: Recipe.Payload[] = []
  const defaultsValidators = new Map<
    Recipe.Payload,
    NonNullable<ReturnType<typeof bindings.read>>
  >()
  const types: Record<string, Record<string, string>> = Object.create(null)
  const defaultPayloads: Record<
    string,
    Record<string, string | number>
  > = Object.create(null)
  const properties: Ast.ObjectExpression['properties'] = []
  const fields = new Map(entries(node))
  const axes: Record<string, readonly string[]> = Object.create(null)
  const defaults: Record<string, string | null> = Object.create(null)

  for (const [key, property] of fields)
    if (
      ![
        'base',
        'variants',
        'defaultVariants',
        'compoundVariants',
        'conditions',
      ].includes(key)
    )
      throw new Themes.InvalidError(`Unknown recipe field: ${key}.`, property)

  const conditions = fields.get('conditions')
  const named = (conditions ? entries(conditions.value) : []).map(
    ([name, property]) =>
      RecipeConditions.read({
        name,
        node: property.value,
        queries: options.queries,
      }),
  )
  const regions = RecipeConditions.regions(named)
  const base = fields.get('base')
  if (base) {
    object(base.value)
    if (
      named.length ||
      base.value.properties.some(
        (property) =>
          property.type === 'Property' &&
          !property.computed &&
          (property.key.type === 'Identifier'
            ? property.key.name === 'targets'
            : property.key.type === 'Literal' &&
              property.key.value === 'targets'),
      )
    )
      properties.push(group(base.value, '&', base.value))
    else properties.push(...(base.value as Ast.ObjectExpression).properties)
  }

  function group(node: Ast.Node, key: string, value: Ast.Expression): Property {
    return {
      type: 'Property',
      kind: 'init',
      method: false,
      shorthand: false,
      start: node.start,
      end: node.end,
      computed: false,
      key: {
        type: 'Literal',
        value: key,
        raw: JSON.stringify(key),
        start: node.start,
        end: node.end,
      },
      value,
    }
  }

  type Rule = {
    bodies?: readonly Ast.ObjectExpression[] | undefined
    matches: readonly (readonly [string, readonly string[]])[]
    property: Property
    suffix: string
  }
  const rules: Rule[] = []

  const variants = fields.get('variants')
  for (const [axis, property] of variants ? entries(variants.value) : []) {
    if (
      !/^[a-z][a-z0-9-]*$/.test(axis) ||
      axis.startsWith('zyzz-condition-') ||
      [
        'class',
        'className',
        'conditions',
        'key',
        'ref',
        'style',
        'variables',
      ].includes(axis)
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

    for (const [key, property] of choices)
      if (
        (property.key.type === 'Literal' &&
          typeof property.key.value === 'number') ||
        key.includes('\0') ||
        /[\ud800-\udfff]/u.test(key)
      )
        throw new Themes.InvalidError(
          'Recipe choice names require CSS-safe strings.',
          property,
        )

    axes[axis] = choices.map(([key]) => key)
    for (const [key, style] of choices) {
      if (
        key === '__proto__' &&
        (style.value.type === 'ArrowFunctionExpression' ||
          style.value.type === 'FunctionExpression')
      )
        throw new Themes.InvalidError(
          'Dynamic choice names cannot use __proto__.',
          style,
        )
      const models = Array.from({ length: named.length + 1 }, (_, context) =>
        bindings.read(
          style.value,
          `${options.identity}-${Object.keys(axes).length}-${choices.findIndex(([name]) => name === key)}-${context}`,
        ),
      )
      const first = models[0]
      if (first) {
        types[axis] ??= Object.create(null)
        types[axis]![key] = options.source.slice(
          first.type.start,
          first.type.end,
        )
        const payload: Recipe.Payload = {
          axis,
          choice: key,
          slots: models.map((model) =>
            Object.fromEntries(
              Object.entries(model!.slots).map(([field, slot]) => [
                field,
                slot.name,
              ]),
            ),
          ),
        }
        payloads.push(payload)
        defaultsValidators.set(payload, first)
      }
      rules.push({
        matches: [[axis, [key]]],
        property: style,
        suffix: '',
        ...(first ? { bodies: models.map((model) => model!.body) } : {}),
      })
    }
  }

  const defaultVariants = fields.get('defaultVariants')
  for (const [axis, property] of defaultVariants
    ? entries(defaultVariants.value)
    : []) {
    if (!Object.hasOwn(axes, axis))
      throw new Themes.InvalidError('Unknown default variant axis.', property)

    if (
      property.value.type === 'Identifier' &&
      property.value.name === 'undefined'
    )
      continue

    if (property.value.type === 'ObjectExpression') {
      const selections = entries(property.value)
      const selected = selections[0]
      const payload =
        selected &&
        payloads.find(
          (item) => item.axis === axis && item.choice === selected[0],
        )
      if (selections.length !== 1 || !selected || !payload)
        throw new Themes.InvalidError(
          'Dynamic defaults require exactly one declared dynamic choice.',
          property,
        )
      const values: Record<string, string | number> = Object.create(null)
      for (const [field, input] of entries(selected[1].value)) {
        const node = input.value
        const value =
          node.type === 'TemplateLiteral'
            ? Expression.template(node)
            : node.type === 'Literal'
              ? node.value
              : node.type === 'UnaryExpression' &&
                  node.argument.type === 'Literal' &&
                  typeof node.argument.value === 'number' &&
                  (node.operator === '-' || node.operator === '+')
                ? node.operator === '-'
                  ? -node.argument.value
                  : node.argument.value
                : undefined
        if (
          !Object.hasOwn(payload.slots[0]!, field) ||
          (typeof value !== 'string' && typeof value !== 'number')
        )
          throw new Themes.InvalidError(
            'Dynamic defaults require complete scalar payloads.',
            input,
          )
        if (!defaultsValidators.get(payload)!.acceptsValue(field, value))
          throw new Themes.InvalidError(
            'Dynamic default does not match its declared payload type.',
            input,
          )
        values[field] = value
      }
      if (Object.keys(values).length !== Object.keys(payload.slots[0]!).length)
        throw new Themes.InvalidError(
          'Dynamic defaults require complete scalar payloads.',
          property,
        )
      defaults[axis] = selected[0]
      defaultPayloads[axis] = values
    } else {
      defaults[axis] = choice(property.value, axes[axis]!)
      if (
        payloads.some(
          (item) => item.axis === axis && item.choice === defaults[axis],
        )
      )
        throw new Themes.InvalidError(
          'Dynamic choices require a scoped payload.',
          property,
        )
    }
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

      const matches: (readonly [string, readonly string[]])[] = []
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

        matches.push([
          axis,
          values.map((value) => {
            const selected = choice(value!, axes[axis]!)
            if (selected === null)
              throw new Themes.InvalidError(
                'Compounds match choice names, not null.',
                value!,
              )
            return selected
          }),
        ])
      }

      // Distinct zero-specificity suffixes preserve repeated compound groups.
      rules.push({
        matches,
        property: style,
        suffix: `:where(*, .__zyzz-compound-${index})`,
      })
    }
  }

  const tree: Ast.ObjectExpression = { ...node, properties: [] }
  for (const region of regions) {
    let target = tree
    for (const { node: source, rule } of region.rules) {
      const existing = target.properties.find(
        (property) =>
          property.type === 'Property' &&
          property.key.type === 'Literal' &&
          property.key.value === rule,
      ) as Property | undefined
      if (existing) target = existing.value as Ast.ObjectExpression
      else {
        const nested: Ast.ObjectExpression = { ...node, properties: [] }
        target.properties.push(group(source, rule, nested))
        target = nested
      }
    }

    for (const { bodies, matches, property, suffix } of rules) {
      if (bodies) {
        const [axis, choices] = matches[0]!
        const sources = [-1, ...region.active]
        for (const [index, condition] of sources.entries()) {
          const attribute =
            condition === -1
              ? `data-${axis}`
              : ConditionalRecipe.attribute({ axis, condition })
          const excluded = sources
            .slice(index + 1)
            .map(
              (condition) =>
                `:not([${ConditionalRecipe.attribute({ axis, condition })}])`,
            )
            .join('')
          const selector = `&:where(${predicate(attribute, condition === -1 ? choices[0]! : `s${choices[0]}`)}${excluded})`
          target.properties.push(
            group(property.key, selector, bodies[condition + 1]!),
          )
        }
        continue
      }
      object(property.value)
      const selector =
        '&' +
        matches
          .map(([axis, choices]) => {
            const sources = [-1, ...region.active]
            const alternatives = sources.flatMap((condition, index) => {
              const attribute =
                condition === -1
                  ? `data-${axis}`
                  : ConditionalRecipe.attribute({ axis, condition })
              const excluded = sources
                .slice(index + 1)
                .map(
                  (condition) =>
                    `:not([${ConditionalRecipe.attribute({ axis, condition })}])`,
                )
                .join('')
              return choices.map(
                (choice) =>
                  predicate(
                    attribute,
                    condition === -1 ? choice : `s${choice}`,
                  ) + excluded,
              )
            })
            return `:where(${alternatives.join(',')})`
          })
          .join('') +
        suffix
      target.properties.push(group(property.key, selector, property.value))
    }
  }
  properties.push(...tree.properties)

  return {
    bindings,
    types,
    body: { ...node, properties },
    ...(!payloads.length && !named.length
      ? {
          staticRecipe: {
            axes,
            defaults,
            rules: [
              ...(base
                ? [{ matches: [], value: base.value as Ast.ObjectExpression }]
                : []),
              ...rules.map(({ matches, property }) => ({
                matches,
                value: property.value as Ast.ObjectExpression,
              })),
            ],
          },
        }
      : {}),
    recipe: {
      axes,
      defaults,
      ...(payloads.length ? { payloads, defaultPayloads } : {}),
      ...(named.length ? { conditions: named.map(({ name }) => name) } : {}),
    },
  }
}

/** Source inputs for finite recipe lowering. */
export declare namespace expand {
  /** Resolution hooks and source identity for isolated payload slots. */
  type Options = RecipePayloads.create.Options & {
    /** Stable module and call identity. */
    readonly identity: string
    /** Bound query aliases. */
    readonly queries?: Query.Metadata | undefined
    /** Original source retained for declaration signatures. */
    readonly source: string
  }
}
