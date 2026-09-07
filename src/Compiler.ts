import * as Crypto from 'node:crypto'
import { parse } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import MagicString, { type SourceMap } from 'magic-string'
import * as Tokens from './Tokens.js'
import * as Properties from './internal/Properties.js'

/** Compiles imported css() calls without evaluating source code.
 * Source locations are retained in errors and the returned source map.
 * @throws CompileError for unsupported macro references or nonliteral styles.
 */
export function compile(options: compile.Options): compile.ReturnType {
  const { code, id } = options
  const output = new MagicString(code)
  const rules = new Map<string, string>()
  let changed = false
  const ast = parse(code, {
    sourceType: 'module',
    sourceFilename: id,
    plugins: ['typescript', 'jsx'],
  })
  const fail = (node: t.Node, message: string): never => {
    throw new CompileError(
      `${id}:${node.loc?.start.line ?? 1}:${(node.loc?.start.column ?? 0) + 1}: ${message}`,
    )
  }
  traverse(ast, {
    ExportNamedDeclaration(path) {
      if (
        path.node.source?.value === 'typestyle' &&
        path.node.exportKind !== 'type'
      )
        fail(
          path.node,
          'Re-exporting the css macro is unsupported; import css directly from typestyle.',
        )
    },
    ImportDeclaration(path) {
      const node = path.node
      if (node.source.value !== 'typestyle' || node.importKind === 'type')
        return
      const macros = node.specifiers.filter(
        (specifier) =>
          t.isImportSpecifier(specifier) && specifier.importKind !== 'type',
      )
      if (node.specifiers.some((specifier) => !t.isImportSpecifier(specifier)))
        fail(node, 'Use a named import: import { css } from "typestyle".')
      for (const specifier of macros) {
        if (!t.isImportSpecifier(specifier)) continue
        const name = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value
        if (name !== 'css')
          fail(
            specifier,
            `Unknown runtime export ${name}. Use import type for style types.`,
          )
        const binding = path.scope.getBinding(specifier.local.name)
        if (!binding)
          return fail(specifier, 'Cannot resolve the css import binding.')
        for (const reference of binding.referencePaths) {
          const call = reference.parentPath
          if (!call?.isCallExpression() || call.node.callee !== reference.node)
            return fail(
              reference.node,
              'css can only be called directly; runtime aliases and passing it as a value are unsupported.',
            )
          if (call.node.arguments.length !== 1)
            fail(call.node, 'css() expects exactly one literal style object.')
          const argument = call.node.arguments[0]
          if (!argument || !t.isExpression(argument))
            return fail(call.node, 'css() expects a literal style object.')
          const style = readObject(argument, fail)
          const body = (() => {
            try {
              return emit(style, '&')
            } catch (error) {
              if (error instanceof CompileError)
                return fail(argument, error.message)
              throw error
            }
          })()
          const className = `cp_${Crypto.createHash('sha256').update(body).digest('hex').slice(0, 20)}`
          rules.set(className, emit(style, `.${className}`))
          output.overwrite(
            call.node.start!,
            call.node.end!,
            JSON.stringify(className),
          )
        }
      }
      // This entrypoint contains only the macro and erased types.
      output.remove(node.start!, node.end!)
      changed = true
    },
  })
  return {
    code: output.toString(),
    css: [...rules.values()].join('\n'),
    changed,
    map: output.generateMap({ source: id, includeContent: true, hires: true }),
  }
}

export declare namespace compile {
  /** A single TS, TSX, JS, or JSX module. */
  type Options = {
    /** Untransformed source text. */ readonly code: string
    /** Filename used in diagnostics and source maps, never in class hashes. */ readonly id: string
  }
  /** The transformed module and its independently loadable stylesheet. */
  type ReturnType = {
    /** Source with macro calls replaced by class-name literals. */ readonly code: string
    /** Only the styles declared in this module, deduplicated within the module. */ readonly css: string
    /** Whether a runtime typestyle import was removed. */ readonly changed: boolean
    /** High-resolution source map for the module transformation. */ readonly map: SourceMap
  }
}

type Value = string | number | StyleObject
type StyleObject = { readonly [key: string]: Value }
type Fail = (node: t.Node, message: string) => never

function readObject(node: t.Expression, fail: Fail): StyleObject {
  if (
    t.isTSAsExpression(node) ||
    t.isTSSatisfiesExpression(node) ||
    t.isTSNonNullExpression(node)
  )
    return readObject(node.expression, fail)
  if (!t.isObjectExpression(node))
    return fail(
      node,
      'Styles must be literal objects. Move runtime choices outside css() and select between compiled classes.',
    )
  const entries: [string, Value][] = []
  const seen = new Set<string>()
  for (const property of node.properties) {
    if (
      !t.isObjectProperty(property) ||
      property.computed ||
      property.shorthand
    )
      fail(
        property,
        'Only explicit literal properties are supported; spreads, computed keys, and shorthand values are not yet supported.',
      )
    const key = t.isIdentifier(property.key)
      ? property.key.name
      : t.isStringLiteral(property.key)
        ? property.key.value
        : fail(property, 'Style keys must be identifiers or string literals.')
    if (seen.has(key)) fail(property, `Duplicate style key ${key}.`)
    seen.add(key)
    const value = property.value
    if (t.isObjectExpression(value))
      entries.push([key, readObject(value, fail)])
    else if (t.isStringLiteral(value) || t.isNumericLiteral(value))
      entries.push([key, value.value])
    else if (
      t.isUnaryExpression(value) &&
      value.operator === '-' &&
      t.isNumericLiteral(value.argument)
    )
      entries.push([key, -value.argument.value])
    else
      fail(
        value,
        `Value for ${key} must be a string, number, or literal nested style object.`,
      )
  }
  return Object.fromEntries(entries)
}

function lookup(
  table: Readonly<Record<string, string>>,
  value: string | number,
  property: string,
): string {
  if (Object.hasOwn(table, value)) return table[value]!
  throw new CompileError(`Unknown ${property} token ${JSON.stringify(value)}.`)
}

function declaration(property: string, value: string | number): string {
  if (!Object.hasOwn(Properties.domains, property))
    throw new CompileError(`Unknown CSS property ${property}.`)
  const domain = Properties.domains[property as keyof typeof Properties.domains]
  const name = property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
  if (typeof value === 'string') {
    if (value.startsWith('[') && value.endsWith(']')) {
      const raw = value.slice(1, -1)
      if (!raw.trim() || /[{};\n\r]|\/\*|!important/i.test(raw))
        throw new CompileError(`Invalid arbitrary CSS value for ${property}.`)
      return `${name}:${raw}`
    }
    if (
      ['inherit', 'initial', 'revert', 'revert-layer', 'unset'].includes(value)
    )
      return `${name}:${value}`
  }
  let resolved: string
  switch (domain) {
    case 'color':
      resolved =
        typeof value === 'string' &&
        ['transparent', 'currentColor', 'black', 'white'].includes(value)
          ? value
          : lookup(Tokens.colors, value, property)
      break
    case 'radius':
      resolved = lookup(Tokens.radius, value, property)
      break
    case 'shadow':
      resolved = lookup(Tokens.shadows, value, property)
      break
    case 'font':
      resolved = lookup(Tokens.fonts, value, property)
      break
    case 'easing':
      resolved = lookup(Tokens.easing, value, property)
      break
    case 'space':
    case 'offset':
    case 'size': {
      if (typeof value === 'number' && Number.isFinite(value)) {
        if (value < 0 && domain !== 'offset')
          throw new CompileError(`${property} cannot use negative spacing.`)
        resolved = `${value * Tokens.spacing}rem`
      } else if (value === 'px') resolved = '1px'
      else if (value === 'auto' && domain !== 'space') resolved = 'auto'
      else if (
        domain === 'size' &&
        ['full', 'min-content', 'max-content', 'fit-content', 'none'].includes(
          String(value),
        )
      )
        resolved = value === 'full' ? '100%' : String(value)
      else
        throw new CompileError(
          `Invalid spacing value for ${property}: ${JSON.stringify(value)}.`,
        )
      break
    }
    case 'pixels':
    case 'duration': {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new CompileError(`${property} expects a finite number.`)
      if (
        value < 0 &&
        property !== 'outlineOffset' &&
        property !== 'transitionDelay'
      )
        throw new CompileError(`${property} cannot be negative.`)
      resolved = `${value}${domain === 'pixels' ? 'px' : 'ms'}`
      break
    }
    case 'unitless':
    case 'weight': {
      if (typeof value === 'number' && Number.isFinite(value))
        resolved = String(value)
      else if (
        typeof value === 'string' &&
        ['auto', 'normal', 'bold'].includes(value)
      )
        resolved = value
      else throw new CompileError(`${property} expects a unitless value.`)
      break
    }
    case 'keyword': {
      if (
        typeof value !== 'string' ||
        !/^[a-zA-Z-]+(?: [a-zA-Z-]+)*$/.test(value)
      )
        throw new CompileError(`${property} expects a CSS keyword.`)
      resolved = value
      break
    }
    case 'arbitrary':
      throw new CompileError(`${property} requires an explicit [CSS value].`)
  }
  return `${name}:${resolved}`
}

function condition(key: string): string | undefined {
  if (key.startsWith('@') && Object.hasOwn(Tokens.breakpoints, key.slice(1)))
    return `(min-width:${Tokens.breakpoints[key.slice(1) as keyof typeof Tokens.breakpoints]})`
  if (key === '@motion-reduce') return '(prefers-reduced-motion:reduce)'
  if (key === '@hover') return '(hover:hover) and (pointer:fine)'
  return undefined
}

function rank(key: string): number {
  const breakpoint = Object.keys(Tokens.breakpoints).indexOf(key.slice(1))
  if (key.startsWith('@') && breakpoint >= 0) return 100 + breakpoint
  const pseudo = (Properties.pseudos as readonly string[]).indexOf(key)
  return pseudo >= 0 ? pseudo : key === '@motion-reduce' ? 200 : 50
}

function emit(style: StyleObject, selector: string): string {
  const declarations: string[] = []
  const nested: [string, StyleObject][] = []
  const typography = style.typography
  if (typography !== undefined) {
    if (typeof typography !== 'string')
      throw new CompileError('typography expects a preset name.')
    declarations.push(lookup(Tokens.typography, typography, 'typography'))
  }
  for (const [key, value] of Object.entries(style)) {
    if (key === 'typography') continue
    if (typeof value === 'object') nested.push([key, value])
    else declarations.push(declaration(key, value))
  }
  let result = declarations.length
    ? `${selector}{${declarations.join(';')}}`
    : ''
  if (
    typeof typography === 'string' &&
    Object.hasOwn(Tokens.typographyStrong, typography)
  ) {
    result += `${selector}>strong{${Tokens.typographyStrong[typography as keyof typeof Tokens.typographyStrong]}}`
  }
  for (const [key, value] of nested.sort(
    ([a], [b]) => rank(a) - rank(b) || a.localeCompare(b, 'en'),
  )) {
    const media = condition(key)
    if (media) result += `@media ${media}{${emit(value, selector)}}`
    else if ((Properties.pseudos as readonly string[]).includes(key))
      result += emit(value, `${selector}${key}`)
    else if (
      /^&\[data-[a-zA-Z0-9_-]+(?:=(?:"[a-zA-Z0-9_-]+"|'[a-zA-Z0-9_-]+'|[a-zA-Z0-9_-]+))?\]$/.test(
        key,
      )
    )
      result += emit(value, `${selector}${key.slice(1)}`)
    else
      throw new CompileError(
        `Unsupported condition ${key}. Use a typed pseudo-class, data attribute, or breakpoint.`,
      )
  }
  return result
}

/** Compilation failure. Unsupported source is never evaluated or silently emitted. */
export class CompileError extends Error {
  override name = 'Compiler.CompileError'
}
