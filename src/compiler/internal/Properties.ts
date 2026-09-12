/** Validates native property registration descriptors and independent initial values. @module */
import * as Functions from './Functions.js'
import * as FunctionSyntax from '../../internal/FunctionSyntax.js'
import * as Identifiers from './Identifiers.js'
import * as Tree from 'css-tree'

/** Rejects declaration delimiters inside an authored initial value. */
export function initial(value: string): void {
  Tree.parse(value, { context: 'value' })
}

/** Validates registrations before output-parser recovery can discard them. */
export function validate(source: string): boolean {
  let escaped = false
  Tree.walk(Tree.parse(source), {
    visit: 'Atrule',
    enter(rule) {
      if (rule.name.toLowerCase() !== 'property') return
      const names = Identifiers.list(
        rule.prelude ? Tree.generate(rule.prelude) : '',
        'space',
      )
      if (
        names?.length !== 1 ||
        !names[0]!.startsWith('--') ||
        names[0]!.length <= 2 ||
        !rule.block
      )
        throw new Error(
          'Property registration requires a custom-property name and descriptors.',
        )
      const values = new Map<string, Tree.Value>()
      rule.block.children.forEach((node) => {
        if (node.type !== 'Declaration' || node.important)
          throw new Error('Expected non-important property descriptors.')
        const key = node.property.toLowerCase()
        if (!['syntax', 'inherits', 'initial-value'].includes(key))
          throw new Error('Unknown property descriptor.')
        values.set(
          key,
          Tree.parse(Tree.generate(node.value), {
            context: 'value',
          }) as Tree.Value,
        )
      })
      const syntaxNode = values.get('syntax')
      const syntax =
        syntaxNode?.children.size === 1 &&
        syntaxNode.children.first?.type === 'String'
          ? syntaxNode.children.first.value
          : undefined
      if (syntax?.includes('\\')) escaped = true
      const inherits = values.get('inherits')
      if (
        syntax === undefined ||
        !FunctionSyntax.accepts(`type(${syntax})`) ||
        syntax.includes('<string>')
      )
        throw new Error(
          'Property registration requires a supported syntax string.',
        )
      const inherited =
        inherits && Identifiers.list(Tree.generate(inherits), 'space')
      if (
        inherited?.length !== 1 ||
        !['true', 'false'].includes(inherited[0]!.toLowerCase())
      )
        throw new Error('Property registration requires boolean inherits.')
      const initial = values.get('initial-value')
      if (!initial && syntax.trim() !== '*')
        throw new Error(
          'Non-universal property registrations require an initial value.',
        )
      if (!initial || syntax.trim() === '*') return
      const matched = (() => {
        try {
          return Functions.value(syntax, Tree.generate(initial))
        } catch {
          throw new Error(
            'Registered initial values must match the declared syntax.',
          )
        }
      })()
      if (
        matched &&
        (!matched.startsWith('<') || matched.startsWith('<custom-ident>'))
      )
        return
      Tree.walk(initial, (node) => {
        if (
          node.type === 'Dimension' &&
          /^(?:cq(?:w|h|i|b|min|max)|r?(?:em|ex|ch|cap|ic|lh))$/i.test(
            node.unit,
          )
        )
          throw new Error(
            'Registered initial values must be computationally independent.',
          )
        if (
          node.type === 'Function' &&
          /^(?:var|env|attr|light-dark|contrast-color|anchor|anchor-size|sibling-index|sibling-count)$/i.test(
            Tree.ident.decode(node.name),
          )
        )
          throw new Error(
            'Registered initial values must be computationally independent.',
          )
        if (
          node.type === 'Identifier' &&
          /^(?:currentcolor|inherit|initial|unset|revert|revert-layer)$/i.test(
            Tree.ident.decode(node.name),
          )
        )
          throw new Error(
            'Registered initial values must be computationally independent.',
          )
      })
    },
  })
  return escaped
}
