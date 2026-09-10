/** Carries compile-time query metadata separately from declaration variables. @module */
import * as Literal from './Literal.js'

/** Named thresholds and eligible container identities. */
export type Metadata = {
  readonly breakpoints: Readonly<Record<string, string>>
  readonly containerNames: readonly string[]
  readonly containers: Readonly<Record<string, string>>
}

/** Supported fixed nonnegative threshold lengths. */
export type Length = Exclude<Literal.Length, `${number}%` | number | '0'>

/** Checks threshold structure without converting relative CSS units. */
export function threshold(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^([+]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)([a-z]+)$/i.exec(value)
  return (
    !!match &&
    Number.isFinite(Number(match[1])) &&
    Literal.lengthUnits.some(
      (unit) => unit.toLowerCase() === match[2]!.toLowerCase(),
    ) &&
    match[2] !== '%'
  )
}

/** Resolves exact named width comparisons and ranges; raw conditions pass through. */
export function resolve(key: string, metadata: Metadata): string {
  const match = /^@(media|container) (.+)$/.exec(key)
  if (!match) return key
  const kind = match[1]!
  const text = match[2]!
  if (
    text.includes('(') ||
    (kind === 'media' &&
      /^(?:(?:only|not)\s+)?(?:all|print|screen)(?:\s|,|$)/.test(text))
  )
    return key
  const pieces = text.split(' ')
  const name =
    kind === 'container' && pieces.length === 2 ? pieces.shift() : undefined
  if (name && !metadata.containerNames.includes(name))
    throw new Error('Unknown container name.')
  if (pieces.length !== 1) throw new Error('Malformed query alias.')
  const alias = pieces[0]!
  const values = kind === 'media' ? metadata.breakpoints : metadata.containers
  const read = (name: string) => {
    const value = Object.hasOwn(values, name) ? values[name] : undefined
    if (value === undefined) throw new Error('Unknown query threshold.')
    return value
  }
  const condition = (() => {
    if (alias.includes('..')) {
      const range = alias.split('..')
      if (range.length !== 2) throw new Error('Malformed query range.')
      const lower = read(range[0]!)
      const upper = read(range[1]!)
      const unit = (value: string) =>
        value
          .replace(/^[+]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/, '')
          .toLowerCase()
      if (unit(lower) === unit(upper) && parseFloat(lower) >= parseFloat(upper))
        throw new Error('Query range must increase.')
      return `${lower} <= width < ${upper}`
    }
    if (alias.startsWith('<')) return `width < ${read(alias.slice(1))}`
    return `width >= ${read(alias.startsWith('>=') ? alias.slice(2) : alias)}`
  })()
  return `@${kind} ${name ? `${name} ` : ''}(${condition})`
}
