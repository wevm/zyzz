/** Resolves immutable applied-props aliases without reevaluating their initializers. @module */
import type * as Ast from '@oxc-project/types'
import * as Walker from 'oxc-walker'
import * as Expression from './Expression.js'
import * as Themes from './Themes.js'

/** Collects immutable bindings during the composition scope walk. */
export function create(options: create.Options) {
  const declarations = new Map<number, Ast.VariableDeclarator>()
  const references = new Map<number, number>()
  const parents = new Map<Ast.Node, Ast.Node>()
  const reads = new Map<number, Ast.Node[]>()

  function safe(
    binding: number,
    ranges: readonly Ast.CallExpression[],
    seen = new Set<number>(),
  ): boolean {
    if (seen.has(binding)) return true
    seen.add(binding)
    return (reads.get(binding) ?? []).every((node) => {
      let current = node
      let container = parents.get(current)
      while (
        container?.type === 'TSAsExpression' ||
        container?.type === 'TSSatisfiesExpression' ||
        container?.type === 'TSNonNullExpression' ||
        (container?.type === 'LogicalExpression' &&
          container.operator === '&&' &&
          container.right === current)
      ) {
        current = container
        container = parents.get(current)
      }
      if (
        container?.type === 'CallExpression' &&
        ranges.includes(container) &&
        container.arguments.includes(current as Ast.Expression)
      )
        return true
      let parent = parents.get(node)
      if (
        parent?.type === 'JSXSpreadAttribute' ||
        parent?.type === 'TSTypeQuery'
      )
        return true
      while (
        parent?.type === 'TSAsExpression' ||
        parent?.type === 'TSSatisfiesExpression' ||
        parent?.type === 'TSNonNullExpression'
      )
        parent = parents.get(parent)
      return (
        parent?.type === 'VariableDeclarator' &&
        declarations.has(parent.start) &&
        safe(parent.start, ranges, seen)
      )
    })
  }

  return {
    enter(node: Ast.Node, parent: Ast.Node | null | undefined) {
      if (parent) parents.set(node, parent)
      if (node.type === 'VariableDeclaration' && node.kind === 'const')
        for (const declaration of node.declarations)
          if (declaration.id.type === 'Identifier' && declaration.init)
            declarations.set(declaration.start, declaration)
      if (
        node.type !== 'Identifier' ||
        !parent ||
        !Walker.isReferenceIdentifier(node, parent)
      )
        return
      const binding = options.declaration(node.name)
      if (!binding) return
      references.set(node.start, binding.start)
      reads.set(binding.start, [...(reads.get(binding.start) ?? []), node])
    },
    resolve(input: Ast.Node, ranges: readonly Ast.CallExpression[]) {
      let node = Expression.unwrap(input)
      const seen = new Set<number>()
      while (node.type === 'Identifier') {
        const binding = references.get(node.start)
        const declaration =
          binding === undefined ? undefined : declarations.get(binding)
        if (!declaration?.init || binding === undefined) break
        if (seen.has(binding) || node.start < declaration.init.end)
          throw new Themes.InvalidError(
            'Applied props bindings must be acyclic and follow initialization.',
            node,
          )
        if (!safe(binding, ranges))
          throw new Themes.InvalidError(
            'Applied props bindings must not escape before composition.',
            node,
          )
        seen.add(binding)
        node = Expression.unwrap(declaration.init)
      }
      return node
    },
  }
}

/** Lexical lookup used by applied-props resolution. */
export declare namespace create {
  /** The active scope walker owns declaration identity and shadowing. */
  type Options = {
    /** Resolves the value declaration visible at the current identifier. */
    readonly declaration: (name: string) => Ast.Node | undefined
  }
}
