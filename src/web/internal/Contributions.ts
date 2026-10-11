/** Ordered stylesheet contribution data and layer ordering. @module */
import type * as Block from './Block.js'
import type * as Namespace from './Namespace.js'
import type * as Style from '../../Style.js'

/** Explicit stylesheet data supplied by source adapters or in-memory callers. */
export type Definition = {
  /** Enclosing groups in authored outermost-first order. */
  readonly within?: readonly string[] | undefined
} & (
  | {
      /** Whether the registered value inherits from its parent element. */
      readonly inherits: boolean
      /** Computationally independent initial CSS value. */
      readonly initialValue?: number | string | undefined
      /** Emits a CSS custom-property registration rule. */
      readonly kind: 'property'
      /** Registered custom-property name, including the -- prefix. */
      readonly name: `--${string}`
      /** CSS Properties and Values syntax descriptor. */
      readonly syntax: string
    }
  | {
      readonly kind: 'rule'
      readonly selector: string
      readonly style: Style.NamedStyle
    }
  | {
      readonly kind: 'font-face'
      readonly declarations: Readonly<Record<string, string | number>>
    }
  | {
      readonly kind: 'keyframes'
      readonly name: string
      readonly frames: readonly {
        readonly stop: string
        readonly style: Style.NamedStyle
      }[]
    }
  | {
      /** Structured named descriptor rule. */
      readonly kind: 'descriptor'
      /** Compiler-owned rule name. */
      readonly name: string
      /** CSS descriptor rule family. */
      readonly rule: 'color-profile' | 'counter-style' | 'font-palette-values'
      /** Authored scalar descriptors. */
      readonly declarations: Readonly<Record<string, string | number>>
    }
  | {
      /** Structured document-level descriptor rule. */
      readonly kind: 'block'
      /** CSS rule header. */
      readonly header: string
      /** Descriptors and nested blocks in authored order. */
      readonly entries: readonly Block.Entry[]
    }
  | (Namespace.Definition & { readonly kind: 'namespace' })
  | {
      readonly kind: 'import'
      readonly url: string
      readonly layer?: string | true | undefined
      readonly supports?: string | undefined
      readonly media?: string | undefined
    }
  | {
      readonly kind: 'custom-media'
      readonly name: string
      readonly query: string | boolean
    }
  | { readonly kind: 'layers'; readonly names: readonly string[] }
)

/** Merges declared ordering constraints with deterministic unconstrained ties. */
export function order(
  lists: readonly (readonly string[])[],
): readonly string[] {
  const scopes = new Map<string, Map<string, Set<string>>>()
  const authored = new Set<string>()

  function scope(parent: string) {
    let graph = scopes.get(parent)

    if (!graph) {
      graph = new Map()
      scopes.set(parent, graph)
    }

    return graph
  }

  for (const list of lists) {
    if (new Set(list).size !== list.length)
      throw new Error('Duplicate layer name.')

    for (const name of list) {
      if (
        !/^(?:--|-?[_a-zA-Z])[\w-]*(?:\.(?:--|-?[_a-zA-Z])[\w-]*)*$/.test(
          name,
        ) ||
        name
          .split('.')
          .some((part) =>
            [
              'default',
              'inherit',
              'initial',
              'revert',
              'revert-layer',
              'unset',
            ].includes(part.toLowerCase()),
          )
      )
        throw new Error('Invalid layer name.')

      authored.add(name)

      const parts = name.split('.')

      for (let index = 0; index < parts.length; index++) {
        const graph = scope(parts.slice(0, index).join('.'))

        if (!graph.has(parts[index]!)) graph.set(parts[index]!, new Set())
      }
    }

    for (let index = 1; index < list.length; index++) {
      const before = list[index - 1]!.split('.'),
        after = list[index]!.split('.')
      const at = before.findIndex((value, index) => value !== after[index])

      if (at >= 0 && after[at] !== undefined)
        scope(before.slice(0, at).join('.')).get(before[at]!)!.add(after[at]!)
    }
  }

  const result: string[] = []

  function emit(parent: string) {
    const graph = scopes.get(parent)
    if (!graph) return

    while (graph.size) {
      const targets = new Set(
        [...graph.values()].flatMap((values) => [...values]),
      )
      const next = [...graph.keys()].find((name) => !targets.has(name))
      if (next === undefined)
        throw new Error('Conflicting layer order constraints.')

      const name = parent ? `${parent}.${next}` : next

      if (authored.has(name)) result.push(name)

      graph.delete(next)
      emit(name)
    }
  }

  emit('')

  return result
}
