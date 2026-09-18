/** Applies compiler replacements without reparsing unaffected authoring. @module */
import type * as Babel from '@babel/core'
import type * as Edits from '../compiler/internal/Edits.js'
import * as NativeJsx from './NativeJsx.js'

/** Retains original nodes and locations outside compiler-owned spans. */
export function apply(
  api: typeof Babel,
  ast: Babel.types.File,
  options: Babel.TransformOptions,
  edits: readonly Edits.Edit[],
  callables: WeakSet<Babel.types.Node>,
) {
  const expressions = edits.filter((edit) => edit.expression)
  const parse = (source: string) => {
    const ast = api.parseSync(source, {
      babelrc: false,
      configFile: false,
      filename: options.filename,
      parserOpts: options.parserOpts,
    })
    if (!ast) throw new Error('Babel did not parse native replacements.')
    return ast.program.body
  }
  const compiled = expressions.length
    ? parse(expressions.map((edit) => `(${edit.code});`).join('\n'))
    : []
  const replacements = new Map<
    number,
    { end: number; node: Babel.types.Expression }
  >()
  for (const [index, edit] of expressions.entries()) {
    const statement = compiled[index]
    if (!statement || !api.types.isExpressionStatement(statement))
      throw new Error('Invalid compiled native expression.')
    callables.add(statement.expression)
    replacements.set(edit.start, { end: edit.end, node: statement.expression })
  }
  // Generated expressions map to their authoring call; unaffected nodes retain precise locations.
  function locate(node: Babel.types.Node, original: Babel.types.Node) {
    api.types.traverseFast(node, (child) => {
      child.loc = original.loc ?? null
      child.start = original.start ?? null
      child.end = original.end ?? null
    })
  }
  function rewrite(node: Babel.types.Node): Babel.types.Node {
    const replacement =
      api.types.isCallExpression(node) && replacements.get(node.start!)
    if (replacement && replacement.end === node.end) {
      locate(replacement.node, node)
      api.types.inheritsComments(replacement.node, node)
      return replacement.node
    }
    for (const key of api.types.VISITOR_KEYS[node.type] ?? []) {
      const value: unknown = Reflect.get(node, key)
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index++)
          if (api.types.isNode(value[index]))
            value[index] = rewrite(value[index])
      } else if (api.types.isNode(value)) Reflect.set(node, key, rewrite(value))
    }
    return node
  }
  rewrite(ast)
  for (const edit of edits) {
    if (edit.expression) continue
    const nodes = edit.code ? parse(edit.code) : []
    if (edit.start === edit.end) {
      for (const node of nodes) {
        api.types.traverseFast(node, (child) => {
          if (child.loc) {
            child.loc.start = { line: 1, column: 0, index: 0 }
            child.loc.end = { line: 1, column: 0, index: 0 }
          }
        })
      }
      ast.program.body.unshift(...nodes)
      continue
    }
    const index = ast.program.body.findIndex(
      (node) => node.start === edit.start && node.end === edit.end,
    )
    if (index < 0) throw new Error('Missing native statement replacement.')
    for (const node of nodes) locate(node, ast.program.body[index]!)
    ast.program.body.splice(index, 1, ...nodes)
  }
  merge(api, ast, expressions)
}

function merge(
  api: typeof Babel,
  ast: Babel.types.File,
  expressions: readonly Edits.Edit[],
) {
  const starts = new Set(expressions.map((edit) => edit.start))
  const body: Babel.types.Statement[] = []
  let previous: Babel.types.VariableDeclaration | undefined
  let merged = false
  for (const statement of ast.program.body) {
    const declaration =
      api.types.isVariableDeclaration(statement) &&
      statement.declarations.every(
        (entry) => entry.init && starts.has(entry.init.start!),
      )
        ? statement
        : undefined
    if (declaration && previous?.kind === declaration.kind) {
      previous.declarations.push(...declaration.declarations)
      api.types.inheritsComments(previous, declaration)
      previous.end = declaration.end ?? null
      if (previous.loc && declaration.loc)
        previous.loc = { ...previous.loc, end: declaration.loc.end }
      merged = true
    } else {
      body.push(statement)
      previous = declaration
    }
  }
  if (merged) {
    // Babel's block-scoping transform scans the scope once per declaration, regardless of its number of bindings.
    ast.program.body = body
  }
}

/** Parses rewritten source once and restores original locations from ordered edits. */
export function parse(
  api: typeof Babel,
  source: string,
  options: Babel.ParserOptions,
  edits: readonly Edits.Edit[],
  parser: (source: string, options: Babel.ParserOptions) => Babel.types.File,
  callables: WeakSet<Babel.types.Node>,
): Babel.types.File | undefined {
  if (
    options.tokens ||
    options.ranges ||
    (options.startLine !== undefined && options.startLine !== 1) ||
    (options.startColumn !== undefined && options.startColumn !== 0) ||
    (options.startIndex !== undefined && options.startIndex !== 0)
  )
    return undefined
  if (!edits.length) return parser(source, options)

  type Segment = {
    start: number
    original: number
    replacement?: Edits.Edit
  }
  const segments: Segment[] = []
  const chunks: string[] = []
  let length = 0
  let cursor = 0
  for (const edit of [...edits].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  )) {
    if (edit.start < cursor) return undefined
    if (edit.start > cursor) {
      const chunk = source.slice(cursor, edit.start)
      segments.push({
        start: length,
        original: cursor,
      })
      chunks.push(chunk)
      length += chunk.length
    }
    if (edit.code) {
      segments.push({
        start: length,
        original: edit.start,
        replacement: edit,
      })
      chunks.push(edit.code)
      length += edit.code.length
    }
    cursor = edit.end
  }
  segments.push({
    start: length,
    original: cursor,
  })
  chunks.push(source.slice(cursor))
  const ast = parser(chunks.join(''), options)
  const lines = [0]
  for (let index = 0; index < source.length; index++) {
    const character = source.charCodeAt(index)
    if (character === 13 && source.charCodeAt(index + 1) === 10) index++
    if (
      character === 10 ||
      character === 13 ||
      character === 0x2028 ||
      character === 0x2029
    )
      lines.push(index + 1)
  }
  function segmentAt(value: number): number {
    let low = 0
    let high = segments.length - 1
    while (low < high) {
      const middle = (low + high + 1) >>> 1
      if (segments[middle]!.start <= value) low = middle
      else high = middle - 1
    }
    return low
  }
  function offset(
    value: number,
    end: boolean,
    index = segmentAt(value),
  ): number {
    const segment = segments[index]!
    if (segment.replacement) {
      if (end && value > segment.start) return segment.replacement.end
      return segment.original
    }
    return segment.original + value - segment.start
  }
  function position(index: number) {
    let low = 0
    let high = lines.length - 1
    while (low < high) {
      const middle = (low + high + 1) >>> 1
      if (lines[middle]! <= index) low = middle
      else high = middle - 1
    }
    return { line: low + 1, column: index - lines[low]!, index }
  }
  function locate(node: Babel.types.Node | Babel.types.Comment) {
    if (
      node.start === undefined ||
      node.start === null ||
      node.end === undefined ||
      node.end === null
    )
      return
    const index = segmentAt(node.start)
    const segment = segments[index]!
    if (
      node.type === 'CallExpression' &&
      segment.replacement?.expression &&
      node.start === segment.start &&
      node.end === segment.start + segment.replacement.code.length
    )
      callables.add(node)
    const endIndex =
      node.end < (segments[index + 1]?.start ?? Infinity)
        ? index
        : segmentAt(node.end)
    node.start = offset(node.start, false, index)
    node.end = offset(node.end, true, endIndex)
    if (node.loc)
      node.loc = {
        ...node.loc,
        start: position(node.start),
        end: position(node.end),
      }
    if ('extra' in node && typeof node.extra?.parenStart === 'number')
      node.extra.parenStart = offset(node.extra.parenStart, false)
  }
  const jsx = NativeJsx.prepare(api, ast, callables)
  api.types.traverseFast(ast, (node) => {
    locate(node)
    jsx?.enter(node)
  })
  for (const comment of ast.comments ?? []) locate(comment)
  merge(
    api,
    ast,
    edits.filter((edit) => edit.expression),
  )
  jsx?.finish()
  return ast
}
