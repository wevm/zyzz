/** Extracts typed callback slots and static object bodies without invoking callbacks. @module */
import type * as Ast from '@oxc-project/types'
import type * as Binding from '../../internal/Binding.js'
import * as Expression from './Expression.js'
import * as Themes from './Themes.js'

/** Fixed callback input slots retained in generated callables. */
export type Slots = Readonly<Record<string, Binding.Reference>>

/** Reads a finite explicitly typed parameter and a concise static object body. */
export function read(node: Ast.Node, identity: string) {
  if (node.type !== 'ArrowFunctionExpression') return undefined
  if (node.async || node.params.length !== 1)
    throw new Themes.InvalidError(
      'Dynamic styles require one typed values parameter.',
      node,
    )
  const parameter = node.params[0]!
  if (
    parameter.type !== 'Identifier' ||
    !parameter.typeAnnotation ||
    parameter.typeAnnotation.typeAnnotation.type !== 'TSTypeLiteral'
  )
    throw new Themes.InvalidError(
      'Dynamic styles require an explicit finite object type on the values parameter.',
      parameter,
    )
  const parameterName = parameter.name
  const slots: Record<string, Binding.Reference> = Object.create(null)
  for (const member of parameter.typeAnnotation.typeAnnotation.members) {
    if (
      member.type !== 'TSPropertySignature' ||
      member.computed ||
      member.optional ||
      !member.typeAnnotation ||
      member.key.type !== 'Identifier' ||
      ['className', 'style', '__proto__'].includes(member.key.name) ||
      Object.hasOwn(slots, member.key.name)
    )
      throw new Themes.InvalidError(
        'Dynamic values require unique required scalar fields without styling override keys.',
        member,
      )
    const type = member.typeAnnotation.typeAnnotation
    const kind = scalar(type)
    if (!kind)
      throw new Themes.InvalidError(
        'Dynamic values require explicit string or number scalar types.',
        member,
      )
    slots[member.key.name] = Object.freeze({
      name: `--z-d${identity}-${Array.from(member.key.name)
        .map((character) => character.codePointAt(0)!.toString(16))
        .join('-')}`,
      type: kind === 'number' ? 'number' : 'length',
      variable: true,
    })
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
    resolve,
    slots: Object.freeze(slots),
    type: parameter.typeAnnotation.typeAnnotation,
  }
}

function scalar(node: Ast.Node): 'number' | 'string' | undefined {
  if (node.type === 'TSNumberKeyword') return 'number'
  if (node.type === 'TSStringKeyword') return 'string'
  if (
    node.type === 'TSTemplateLiteralType' &&
    node.types.every((type) => scalar(type) !== undefined)
  )
    return 'string'
  if (node.type === 'TSLiteralType') {
    if (
      node.literal.type === 'Literal' &&
      typeof node.literal.value === 'number'
    )
      return 'number'
    if (
      node.literal.type === 'Literal' &&
      typeof node.literal.value === 'string'
    )
      return 'string'
  }
  if (node.type === 'TSUnionType') {
    const kinds = node.types.map(scalar)
    if (kinds.length && kinds.every((kind) => kind === kinds[0]))
      return kinds[0]
  }
  return undefined
}
