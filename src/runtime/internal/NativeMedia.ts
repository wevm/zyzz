/** Selects precompiled media alternatives using native logical dimensions. @module */

/** Comparison data emitted by the compiler, with no CSS parsing at application time. */
export type Query =
  | { readonly kind: 'and'; readonly queries: readonly Query[] }
  | {
      readonly kind: 'compare'
      readonly left: number | 'height' | 'width'
      readonly operator: '<' | '<=' | '=' | '>' | '>='
      readonly right: number | 'height' | 'width'
    }
  | { readonly kind: 'not'; readonly query: Query }
  | { readonly kind: 'or'; readonly queries: readonly Query[] }

/** Window measurements supplied by the native React adapter. */
export type Viewport = {
  readonly height: number
  readonly width: number
}

/** Computes the selected alternative without interpreting authoring code. */
export function select(
  queries: readonly Query[],
  viewport: Viewport | undefined,
): string {
  if (!viewport)
    throw new Error(
      'Native media queries require the native Provider window dimensions.',
    )
  if (
    !Number.isFinite(viewport.height) ||
    viewport.height < 0 ||
    !Number.isFinite(viewport.width) ||
    viewport.width < 0
  )
    throw new Error('Native window dimensions must be finite and nonnegative.')

  const dimensions = viewport
  function matches(query: Query): boolean {
    if (query.kind === 'and') return query.queries.every(matches)
    if (query.kind === 'or') return query.queries.some(matches)
    if (query.kind === 'not') return !matches(query.query)

    const left =
      typeof query.left === 'number' ? query.left : dimensions[query.left]
    const right =
      typeof query.right === 'number' ? query.right : dimensions[query.right]
    switch (query.operator) {
      case '<':
        return left < right
      case '<=':
        return left <= right
      case '=':
        return left === right
      case '>':
        return left > right
      case '>=':
        return left >= right
    }
  }

  return queries.map((query) => (matches(query) ? '1' : '0')).join('')
}
