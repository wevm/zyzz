/** Pure ordered stylesheet contribution data and layer ordering. @module */
import * as Block from './Block.js'
import * as Namespace from './Namespace.js'
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

/**
 * Merges declared ordering constraints into one canonical layer order.
 *
 * Consecutive names in each list constrain the result; dotted names order
 * within their parent. Names left unconstrained at any step follow UTF-16 code
 * unit order, so the result depends only on the set of constraints, not on
 * list order, module traversal, or chunk completion. Throws on invalid or
 * duplicated names and on contradictory constraint cycles.
 */
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
      const next = [...graph.keys()]
        .filter((name) => !targets.has(name))
        .sort()[0]
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

/** Renders static contributions without registration or environment access. */
export function render(
  definitions: readonly Definition[],
  style: (value: Style.NamedStyle) => string,
): string {
  const layers = order(
    definitions.flatMap((value) =>
      value.kind === 'layers' ? [value.names] : [],
    ),
  )

  return [
    layers.length ? `@layer ${layers.join(',')};` : '',
    ...definitions
      .toSorted((a, b) => rank(a) - rank(b))
      .map((value) => {
        if (value.kind === 'layers') return ''
        const css = (() => {
          if (value.kind === 'namespace') return Namespace.statement(value)
          if (value.kind === 'custom-media')
            return `@custom-media ${value.name} ${value.query};`
          if (value.kind === 'import')
            return `@import url(${JSON.stringify(value.url)})${value.layer === true ? ' layer' : value.layer ? ` layer(${value.layer})` : ''}${value.supports ? ` supports(${value.supports})` : ''}${value.media ? ` ${value.media}` : ''};`
          if (value.kind === 'block')
            return `${value.header}{${Block.render(value.entries, style)}}`
          if (value.kind === 'rule')
            return `${value.selector}{${style(value.style)}}`
          if (value.kind === 'property')
            return `@property ${value.name}{syntax:${JSON.stringify(value.syntax)};inherits:${value.inherits};${value.initialValue === undefined ? '' : `initial-value:${value.initialValue};`}}`
          if (value.kind === 'font-face' || value.kind === 'descriptor')
            return `@${value.kind === 'font-face' ? 'font-face' : `${value.rule} ${value.name}`}{${Object.entries(
              value.declarations,
            )
              .map(
                ([key, value]) =>
                  `${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`,
              )
              .join('')}}`
          return `@keyframes ${value.name}{${value.frames.map((frame) => `${frame.stop}{${style(frame.style)}}`).join('')}}`
        })()
        return (value.within ?? []).reduceRight(
          (body, header) => `${header}{${body}}`,
          css,
        )
      }),
  ]
    .filter(Boolean)
    .join('\n')
}

function rank(value: Definition): number {
  if (value.kind === 'import') return 0
  if (value.kind === 'namespace') return 1
  return 2
}
