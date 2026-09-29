/** Derives portable identifiers without source locations or process-global counters. @module */
import * as Binding from './Binding.js'
import * as Token from './Token.js'
import type * as Style from '../Style.js'

/** Encodes both hash streams in eleven CSS identifier characters. */
export function compact(value: string): string {
  let first = 2166136261
  let second = 5381
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }

  const alphabet =
    '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-'
  let bits = (BigInt(first >>> 0) << 32n) | BigInt(second >>> 0)
  let result = ''
  for (let index = 0; index < 11; index++) {
    result = alphabet[Number(bits & 63n)]! + result
    bits >>= 6n
  }

  return result
}

/** Encodes an explicit identity without losing punctuation or Unicode distinctions. */
export function encode(value: string): string {
  return Array.from(value, (character) =>
    character.codePointAt(0)!.toString(16),
  ).join('-')
}

/** Keeps an authored label readable while its separate hash disambiguates spelling. */
export function label(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'value'
  )
}

/** Requires an explicit identity at an uncompiled authoring boundary. */
export function requireId(id: string | undefined, kind: string): string {
  if (!id)
    throw new Error(
      `${kind} requires an explicit id without the compiler plugin.`,
    )
  return `id-${encode(id)}`
}

/** Names one callback input independently of its declaration order. */
export function slot(id: string, field: string): `--${string}` {
  return `--z-d${id}-${encode(field)}`
}

/** Hashes a canonical value using two independent 32-bit accumulators. */
export function hash(value: string): string {
  let a = 2166136261
  let b = 5381
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    a = Math.imul(a ^ code, 16777619)
    b = Math.imul(b, 33) ^ code
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`
}

/** Names ordered style data consistently in runtime and extraction. */
export function style(input: Style.NamedStyle): string {
  function value(input: Style.Declaration['value']): unknown {
    if (Binding.is(input)) return ['variable', input.name]
    if (Token.is(input))
      return ['token', input.contract[Token.identity], input.path, input.value]
    if (Token.isExpression(input))
      return [
        'expression',
        input.parts.map((part) =>
          typeof part === 'string' ? part : value(part),
        ),
      ]
    return input
  }
  function shape(style: Style.NamedStyle): unknown {
    if (style.targets) {
      const { targets, ...shared } = style
      return [
        shape(shared),
        targets.native ?? null,
        targets.ios ?? null,
        targets.android ?? null,
        targets.web ? shape(targets.web) : null,
      ]
    }
    if (style.rules)
      return style.rules.map((rule) => [
        rule.condition ?? '',
        shape(rule.style),
      ])
    return style.declarations.map((declaration) => [
      declaration.property,
      value(declaration.value),
      !!declaration.important,
    ])
  }
  return `z-content-${hash(JSON.stringify(shape(input)))}`
}

/** Names a complete ordered composition, including repeated definitions. */
export function composition(names: readonly string[]): string {
  return `z-compose-${hash(JSON.stringify(names))}`
}

/** Names a stylesheet declaration with a caller-owned identity. */
export function contribution(kind: string, id: string | undefined): string {
  const identity = requireId(id, kind)
  if (kind === 'keyframes') return `z-k${identity}`
  return `${kind === 'counterStyle' ? '' : '--'}z-${kind.toLowerCase()}${identity}`
}
