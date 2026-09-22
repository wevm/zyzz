/** Partitions named recipe queries into mutually exclusive CSS regions. @module */
import type * as Ast from '@oxc-project/types'
import * as CssTree from 'css-tree'
import * as Query from '../../internal/Query.js'
import * as Themes from './Themes.js'

/** One named condition and its positive/negative grouping rules. */
export type Condition = {
  /** Negated query list, represented as an intersection of grouping rules. */
  readonly inactive: readonly string[]
  /** Authored name used by the selection callable. */
  readonly name: string
  /** Authored value span retained for diagnostics and mapping. */
  readonly node: Ast.Node
  /** Resolved positive grouping rule. */
  readonly rule: string
}

/** Resolves theme thresholds and derives a logical complement without evaluation. */
export function read(options: read.Options): Condition {
  const { name, node } = options
  if (name === '__proto__')
    throw new Themes.InvalidError(
      'Recipe condition names cannot use __proto__.',
      node,
    )
  if (node.type !== 'Literal' || typeof node.value !== 'string')
    throw new Themes.InvalidError(
      'Recipe conditions require static media or supports strings.',
      node,
    )

  try {
    const rule = Query.resolve(
      node.value,
      options.queries ?? {
        breakpoints: {},
        containerNames: [],
        containers: {},
      },
    )
    const match = /^@(media|supports)(?=[\s(])\s*([\s\S]+)$/.exec(
      rule.replace(/\/\*[\s\S]*?\*\//g, ' '),
    )
    if (!match)
      throw new Error('Recipe conditions support only @media and @supports.')

    const text = match[2]!
    if (match[1] === 'supports') {
      // Parse the complete rule so malformed braces or trailing rules cannot
      // become part of a synthesized condition.
      const parsed = CssTree.parse(`@supports ${text}{}`)
      if (parsed.type !== 'StyleSheet' || parsed.children.size !== 1)
        throw new Error('Malformed supports condition.')
      const entry = parsed.children.first
      if (
        entry?.type !== 'Atrule' ||
        !entry.prelude ||
        !entry.block ||
        !entry.block.children.isEmpty
      )
        throw new Error('Malformed supports condition.')
      CssTree.walk(entry.prelude, (node) => {
        if (node.type === 'Raw')
          throw new Error('Malformed supports condition.')
      })
      return { inactive: [`@supports not (${text})`], name, node, rule }
    }

    const list = CssTree.parse(text, { context: 'mediaQueryList' })
    if (list.type !== 'MediaQueryList' || list.children.isEmpty)
      throw new Error('Malformed media condition.')
    const inactive = list.children.toArray().map((query) => {
      if (query.type !== 'MediaQuery')
        throw new Error('Malformed media condition.')
      if (query.mediaType)
        return `@media ${CssTree.generate({ ...query, modifier: query.modifier?.toLowerCase() === 'not' ? null : 'not' })}`
      if (!query.condition) throw new Error('Malformed media condition.')
      return `@media not (${CssTree.generate(query.condition)})`
    })
    return { inactive, name, node, rule }
  } catch (error) {
    throw new Themes.InvalidError(
      error instanceof Error ? error.message : 'Invalid recipe condition.',
      node,
    )
  }
}

/** Inputs for static condition resolution. */
export declare namespace read {
  /** Named condition and optional bound query metadata. */
  type Options = {
    /** Author-facing condition name. */
    readonly name: string
    /** Literal query source. */
    readonly node: Ast.Node
    /** Theme-owned query thresholds. */
    readonly queries?: Query.Metadata | undefined
  }
}

/** One satisfiable candidate truth region; CSS discards impossible intersections. */
export type Region = {
  /** Active condition indexes in authored priority order. */
  readonly active: readonly number[]
  /** Nested grouping rules defining this region. */
  readonly rules: readonly { readonly node: Ast.Node; readonly rule: string }[]
}

/** Enumerates only condition states, never combinations of axis choices. */
export function regions(conditions: readonly Condition[]): readonly Region[] {
  // A compile-time ceiling bounds generated output before allocating regions.
  if (conditions.length > 8)
    throw new Themes.InvalidError(
      'Recipes support at most eight named conditions (256 CSS regions).',
      conditions[8]!.node,
    )

  let result: readonly Region[] = [{ active: [], rules: [] }]
  for (const [index, condition] of conditions.entries())
    result = result.flatMap((region) => [
      {
        active: region.active,
        rules: [
          ...region.rules,
          ...condition.inactive.map((rule) => ({ node: condition.node, rule })),
        ],
      },
      {
        active: [...region.active, index],
        rules: [
          ...region.rules,
          { node: condition.node, rule: condition.rule },
        ],
      },
    ])
  return result
}
