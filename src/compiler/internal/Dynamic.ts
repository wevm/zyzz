/** Extracts typed callback slots and static object bodies without invoking callbacks. @module */
import type * as Ast from '@oxc-project/types'
import type * as Binding from '../../internal/Binding.js'
import * as Expression from './Expression.js'
import * as Literal from '../../internal/Literal.js'
import * as Themes from './Themes.js'

/** Fixed callback input slots retained in generated callables. */
export type Slots = Readonly<Record<string, Binding.Reference>>

/** Reads a finite explicitly typed parameter and a concise static object body. */
export function read(
  node: Ast.Node,
  identity: string,
  resolveType: (node: Ast.Node) => Ast.Node = (node) => node,
) {
  node = Expression.unwrap(node)

  if (node.type !== 'ArrowFunctionExpression') return undefined

  if (node.async || node.params.length !== 1)
    throw new Themes.InvalidError(
      'Dynamic styles require one typed values parameter.',
      node,
    )

  const parameter = node.params[0]!
  if (parameter.type !== 'Identifier' || !parameter.typeAnnotation)
    throw new Themes.InvalidError(
      'Dynamic styles require an explicit finite object type on the values parameter.',
      parameter,
    )

  const fields = resolveType(parameter.typeAnnotation.typeAnnotation)
  if (fields.type !== 'TSTypeLiteral')
    throw new Themes.InvalidError(
      'Dynamic styles require a finite object type.',
      parameter,
    )

  const parameterName = parameter.name
  const slots: Record<string, Binding.Reference> = Object.create(null)
  const numeric = new Map<Binding.Reference, readonly number[]>()

  for (const member of fields.members) {
    const key =
      member.type === 'TSPropertySignature'
        ? member.key.type === 'Identifier'
          ? member.key.name
          : member.key.type === 'Literal' &&
              typeof member.key.value === 'string'
            ? member.key.value
            : undefined
        : undefined
    if (
      member.type !== 'TSPropertySignature' ||
      member.computed ||
      member.optional ||
      !member.typeAnnotation ||
      key === undefined ||
      ['class', 'className', 'key', 'ref', 'style', '__proto__'].includes(
        key,
      ) ||
      Object.hasOwn(slots, key)
    )
      throw new Themes.InvalidError(
        'Dynamic values require unique required scalar fields without styling override keys.',
        member,
      )

    const type = resolveType(member.typeAnnotation.typeAnnotation)
    const kind = scalar(type)
    if (!kind)
      throw new Themes.InvalidError(
        'Dynamic values require explicit string or number scalar types.',
        member,
      )

    const slot = (slots[key] = Object.freeze({
      name: `--z-d${identity}-${Array.from(key)
        .map((character) => character.codePointAt(0)!.toString(16))
        .join('-')}`,
      type: kind === 'number' ? 'number' : 'length',
      ...(kind === 'zero-string' ? { zero: true } : {}),
      variable: true,
    }))

    const values = numbers(type)

    if (values) numeric.set(slot, values)
  }

  const body = Expression.unwrap(node.body)
  if (body.type !== 'ObjectExpression')
    throw new Themes.InvalidError(
      'Dynamic styles require a concise static object body.',
      node.body,
    )

  function resolve(node: Ast.Node): Binding.Reference | undefined {
    node = Expression.unwrap(node)

    if (
      node.type !== 'MemberExpression' ||
      node.object.type !== 'Identifier' ||
      node.object.name !== parameterName
    )
      return undefined

    const key = (() => {
      if (node.property.type === 'Identifier' && !node.computed)
        return node.property.name

      if (
        node.property.type === 'Literal' &&
        node.computed &&
        typeof node.property.value === 'string'
      )
        return node.property.value

      return undefined
    })()

    const slot = key === undefined ? undefined : slots[key]
    if (!slot || node.optional)
      throw new Themes.InvalidError(
        'Dynamic reads require declared scalar fields without optional access.',
        node,
      )

    return slot
  }

  return {
    body,
    accepts(reference: Binding.Reference, property: string) {
      const values = numeric.get(reference)
      const rule = Literal.rules[property as keyof typeof Literal.rules]
      if (!values || !rule) return false

      if (rule.kind === 'grid-line')
        return values.every(
          (value) => Number.isSafeInteger(value) && value !== 0,
        )

      if (rule.kind !== 'number') return false

      return values.every(
        (value) =>
          (!('integer' in rule) ||
            !rule.integer ||
            Number.isSafeInteger(value)) &&
          (!('min' in rule) || value >= rule.min) &&
          (!('max' in rule) || value <= rule.max),
      )
    },
    resolve,
    slots: Object.freeze(slots),
    type: parameter.typeAnnotation.typeAnnotation,
  }
}

function scalar(
  node: Ast.Node,
): 'number' | 'string' | 'zero-string' | undefined {
  if (node.type === 'TSIntersectionType') {
    const kinds = node.types.map(scalar)

    return kinds.length && kinds.every((kind) => kind === kinds[0])
      ? kinds[0]
      : undefined
  }

  if (node.type === 'TSNumberKeyword') return 'number'
  if (node.type === 'TSStringKeyword') return 'string'

  if (
    node.type === 'TSTemplateLiteralType' &&
    node.types.every((type) => scalar(type) !== undefined) &&
    node.quasis.every((part) => !part.value.raw.includes('!'))
  )
    return 'string'

  if (node.type === 'TSLiteralType') {
    if (numbers(node)) return 'number'

    if (
      node.literal.type === 'Literal' &&
      typeof node.literal.value === 'number'
    )
      return 'number'

    if (
      node.literal.type === 'Literal' &&
      typeof node.literal.value === 'string' &&
      !node.literal.value.includes('!') &&
      !['initial', 'inherit', 'unset', 'revert', 'revert-layer'].includes(
        node.literal.value.trim().toLowerCase(),
      )
    )
      return 'string'
  }

  if (node.type === 'TSUnionType') {
    const kinds = node.types.map(scalar)
    if (
      kinds.some((kind) => kind === 'string' || kind === 'zero-string') &&
      node.types.every(
        (type, index) =>
          kinds[index] === 'string' ||
          kinds[index] === 'zero-string' ||
          numbers(type)?.every((value) => value === 0),
      )
    )
      return 'zero-string'

    if (kinds.length && kinds.every((kind) => kind === kinds[0]))
      return kinds[0]
  }

  return undefined
}

function numbers(node: Ast.Node): readonly number[] | undefined {
  if (node.type === 'TSIntersectionType') {
    const domains = node.types
      .filter((type) => type.type !== 'TSNumberKeyword')
      .map(numbers)
    if (!domains.length || domains.some((domain) => domain === undefined))
      return undefined

    return domains[0]!.filter((value) =>
      domains.every((domain) => domain!.includes(value)),
    )
  }

  if (node.type === 'TSUnionType') {
    const members = node.types.map(numbers)

    return members.every((member) => member !== undefined)
      ? members.flat()
      : undefined
  }

  if (node.type !== 'TSLiteralType') return undefined

  const literal = node.literal
  if (literal.type === 'Literal' && typeof literal.value === 'number')
    return [literal.value]

  if (
    literal.type === 'UnaryExpression' &&
    literal.operator === '-' &&
    literal.argument.type === 'Literal' &&
    typeof literal.argument.value === 'number'
  )
    return [-literal.argument.value]

  return undefined
}
