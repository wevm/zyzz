/**
 * Validates compositional grid track lists without expanding repetitions.
 * @module
 */

import * as Component from './Component.js'
import * as Identifier from './Identifier.js'
import * as MathExpression from './Math.js'

/** Refines simple span counts while named combinations receive compiler validation. */
export type Checked<value> = value extends readonly unknown[]
  ? { [key in keyof value]: Checked<value[key]> }
  : value extends `${infer body}!important` | `${infer body}!`
    ? Checked<Trim<body>> extends never
      ? never
      : value
    : value extends `span ${infer count extends number}`
      ? `${count}` extends `${bigint}`
        ? `${count}` extends `-${string}` | '0'
          ? never
          : value
        : never
      : value

type Trim<value extends string> =
  value extends `${infer body}${' ' | '\n' | '\r' | '\t' | '\f'}`
    ? Trim<body>
    : value

/** Checks named or numbered grid lines and slash-separated placement shorthands. */
export function line(value: unknown, options: line.Options = {}): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false
  const lines = Component.split(String(value), { separator: 'slash' })
  if (!lines || lines.length > (options.items ?? 1)) return false
  return lines.every((text) => {
    const parts = Component.split(text, { separator: 'space' })
    if (!parts || parts.length > 3) return false
    if (parts.length === 1 && parts[0]!.toLowerCase() === 'auto') return true
    let span = false
    let number: number | undefined
    let name = false
    for (const part of parts) {
      if (part.toLowerCase() === 'span') {
        if (span) return false
        span = true
      } else if (/^[+-]?\d+$/.test(part)) {
        if (number !== undefined) return false
        number = Number(part)
        if (!Number.isSafeInteger(number) || number === 0) return false
      } else {
        if (
          name ||
          !Identifier.valid(part, { excluded: ['auto', 'span'], keywords: [] })
        )
          return false
        name = true
      }
    }
    return (
      (!span || number !== undefined || name) &&
      (!span || number === undefined || number > 0)
    )
  })
}

export declare namespace line {
  /** Maximum number of independently validated grid lines. */
  type Options = {
    /** Slash-separated components; omission permits one line. */
    readonly items?: 2 | 4
  }
}

/** Checks track functions, repetition constraints, and optional line-name groups. */
export function tracks(value: unknown, options: tracks.Options): boolean {
  if (value === 0) return true
  if (typeof value !== 'string' || /[;{}!"'\\]/.test(value)) return false
  const text = trim(value)
  if (options.explicit && /^(?:none|subgrid)$/i.test(text)) return true
  const units = new Set(options.units.map((unit) => unit.toLowerCase()))

  function length(text: string) {
    if (/^(calc|clamp|max|min)\(/i.test(text))
      return MathExpression.valid(text, {
        kind: 'length',
        percentage: true,
        units: options.units,
      })
    const match = /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)([a-z]+|%)?$/i.exec(
      text,
    )
    if (!match) return false
    const number = Number(match[1])
    return (
      Number.isFinite(number) &&
      number >= 0 &&
      (match[2] ? units.has(match[2].toLowerCase()) : number === 0)
    )
  }

  function breadth(text: string, flexible: boolean) {
    if (length(text) || /^(?:auto|min-content|max-content)$/i.test(text))
      return true
    const match = flexible
      ? /^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)fr$/i.exec(text)
      : null
    return !!match && Number.isFinite(Number(match[1])) && Number(match[1]) >= 0
  }

  function size(text: string): { fixed: boolean } | undefined {
    if (breadth(text, true)) return { fixed: length(text) }
    const fn = /^(minmax|fit-content)\((.*)\)$/is.exec(text)
    if (!fn) return undefined
    const args = split(fn[2]!, ',')
    if (!args) return undefined
    if (fn[1]!.toLowerCase() === 'fit-content')
      return args.length === 1 && length(args[0]!)
        ? { fixed: false }
        : undefined
    if (
      args.length !== 2 ||
      !breadth(args[0]!, false) ||
      !breadth(args[1]!, true)
    )
      return undefined
    return { fixed: length(args[0]!) || length(args[1]!) }
  }

  function list(
    text: string,
    repeat: boolean,
  ): { automatic: number; fixed: boolean } | undefined {
    const items = split(text)
    if (!items?.length) return undefined
    let automatic = 0
    let fixed = true
    let count = 0
    let previousNames = false
    for (const item of items) {
      if (item.startsWith('[')) {
        if (!options.explicit || previousNames || !/^\[[^[\]]*\]$/.test(item))
          return undefined
        const names = trim(item.slice(1, -1))
          .split(/[ \t\n\r\f]+/)
          .filter(Boolean)
        if (
          names.some(
            (name) =>
              !/^-?(?:[a-z_]|[\u0080-\uffff])(?:[\w-]|[\u0080-\uffff])*$/i.test(
                name,
              ) ||
              /^(?:auto|span|inherit|initial|unset|revert|revert-layer|default)$/i.test(
                name,
              ),
          )
        )
          return undefined
        previousNames = true
        continue
      }
      previousNames = false
      const track = size(item)
      if (track) {
        count++
        fixed &&= track.fixed
        continue
      }
      const fn = repeat ? /^repeat\((.*)\)$/is.exec(item) : null
      const args = fn ? split(fn[1]!, ',') : undefined
      if (!args || args.length !== 2) return undefined
      const auto = /^(?:auto-fill|auto-fit)$/i.test(args[0]!)
      if (
        !auto &&
        (!/^\+?\d+$/.test(args[0]!) ||
          !Number.isSafeInteger(Number(args[0])) ||
          Number(args[0]) < 1)
      )
        return undefined
      const inner = list(args[1]!, false)
      if (!inner || (auto && !inner.fixed)) return undefined
      automatic += auto ? 1 : 0
      fixed &&= inner.fixed
      count++
    }
    if (!count || automatic > 1 || (automatic && !fixed)) return undefined
    return { automatic, fixed }
  }

  return !!list(text, options.explicit)
}

/** Track grammar configuration supplied by the owning property domain. */
export declare namespace tracks {
  /** Explicit grids allow line names and repetitions; implicit grids accept sizes only. */
  type Options = {
    readonly explicit: boolean
    readonly units: readonly string[]
  }
}

function split(text: string, separator?: ','): string[] | undefined {
  const output: string[] = []
  const stack: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index++) {
    const char = text[index]!
    if (char === '(' || char === '[') stack.push(char)
    else if (char === ')' || char === ']') {
      if (stack.pop() !== (char === ')' ? '(' : '[')) return undefined
    } else if (
      !stack.length &&
      (separator ? char === separator : /[ \t\n\r\f]/.test(char))
    ) {
      const part = trim(text.slice(start, index))
      if (part) output.push(part)
      else if (separator) return undefined
      start = index + 1
    }
  }
  if (stack.length) return undefined
  const part = trim(text.slice(start))
  if (part) output.push(part)
  else if (separator) return undefined
  return output
}

function trim(text: string): string {
  return text.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '')
}
