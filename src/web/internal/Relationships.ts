/** Composes css definition interpolations into scoped relationship selectors. @module */
import type { css } from '../../css.js'
import * as Conditions from '../../internal/Condition.js'

/** Opaque compiler condition key; cannot introduce an arbitrary property index. */
export type Key = Conditions.Relationship

/** A compiled `css` definition; its identity class marks every element it styles. */
export type Definition = (
  ...args: never[]
) => css.Props<'html'> | css.Props<'react'>

/** Class identity emitted for every css definition, derived from its extracted name. */
export function identity(name: string): string {
  return `z-${name.replace(
    /[^a-zA-Z0-9-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )}`
}

/** Resolved definition interpolation awaiting selector composition. */
export type Part = {
  readonly className: string
}

/** Joins template text with definition classes and wraps each ref compound in `:where()`. */
export function compose(
  quasis: readonly string[],
  parts: readonly Part[],
): string {
  if (quasis.length !== parts.length + 1)
    throw new Error('where templates require text around every interpolation.')
  if (!parts.length)
    throw new Error(
      'where selectors require at least one css definition interpolation.',
    )

  let text = ''
  const ranges: (readonly [number, number])[] = []

  quasis.forEach((quasi, index) => {
    text += quasi

    const part = parts[index]
    if (!part) return

    const start = text.length
    text += `.${part.className}`
    ranges.push([start, text.length])
  })

  if (!Conditions.nested(text) && !text.startsWith(':'))
    throw new Error('where selectors require & for the styled element.')

  const { depth, skip } = scan(text, ranges)
  const isBreak = (index: number) =>
    !skip[index] && /[\s>~+,]/.test(text[index]!)
  const compounds = new Map<number, number>()

  for (const [start, end] of ranges) {
    const level = depth[start]!
    let from = start
    let to = end

    while (from > 0) {
      const index = from - 1
      if (!skip[index]) {
        if (depth[index]! < level) break
        if (depth[index] === level && isBreak(index)) break
      }
      from = index
    }

    while (to < text.length) {
      if (!skip[to]) {
        if (depth[to]! < level) break
        if (depth[to] === level && isBreak(to)) break
      }
      to++
    }

    compounds.set(from, Math.max(compounds.get(from) ?? 0, to))
  }

  // Only the compound's own nesting selector moves outside :where(); nested
  // ampersands inside functional pseudo-classes keep their positions.
  const subject = (index: number, from: number) =>
    !skip[index] && text[index] === '&' && depth[index] === depth[from]

  const hasSubject = (from: number, to: number) => {
    for (let index = from; index < to; index++)
      if (subject(index, from)) return true

    return false
  }

  // Pseudo-elements cannot be :where() arguments, so they trail the wrapper.
  const pseudoElement = (from: number, to: number) => {
    for (let index = from; index < to; index++) {
      if (skip[index] || depth[index] !== depth[from] || text[index] !== ':')
        continue

      if (
        text[index + 1] === ':' ||
        /^:(?:before|after|first-line|first-letter)(?![\w-])/i.test(
          text.slice(index, to),
        )
      )
        return index
    }

    return to
  }

  // Compounds nest through functional pseudo-classes, so render recursively.
  function render(from: number, to: number, drop: boolean): string {
    let output = ''
    let index = from

    while (index < to) {
      const end = compounds.get(index)

      if (
        end !== undefined &&
        end <= to &&
        !(drop && index === from && end === to)
      ) {
        const split = pseudoElement(index, end)

        output += `${hasSubject(index, split) ? '&' : ''}:where(${render(index, split, true)})${render(split, end, false)}`
        index = end
        continue
      }

      if (!(drop && subject(index, from))) output += text[index]
      index++
    }

    return output
  }

  return render(0, text.length, false)
}

/** Records parenthesis depth per character and marks definition, quoted, bracketed, escaped, and comment text. */
function scan(text: string, ranges: readonly (readonly [number, number])[]) {
  const opaque = new Map(ranges)
  const depth: number[] = []
  const skip: boolean[] = []
  let level = 0
  let quote = ''
  let bracket = false
  let comment = false

  for (let index = 0; index < text.length; index++) {
    const end = opaque.get(index)

    if (end !== undefined) {
      if (quote || bracket || comment)
        throw new Error(
          'Definition interpolations cannot appear inside quoted, bracketed, or comment text.',
        )

      for (; index < end; index++) {
        depth[index] = level
        skip[index] = true
      }

      index--
      continue
    }

    const char = text[index]!

    if (comment) {
      depth[index] = level
      skip[index] = true
      if (char === '*' && text[index + 1] === '/') {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
        comment = false
      }
      continue
    }

    if (quote) {
      depth[index] = level
      skip[index] = true
      if (char === '\\' && index + 1 < text.length) {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
      } else if (char === quote) quote = ''
      continue
    }

    if (bracket) {
      depth[index] = level
      skip[index] = true
      if (char === '\\' && index + 1 < text.length) {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
      } else if (char === '"' || char === "'") quote = char
      else if (char === ']') bracket = false
      continue
    }

    if (char === '\\') {
      depth[index] = level
      skip[index] = true
      if (index + 1 < text.length) {
        depth[index + 1] = level
        skip[index + 1] = true
        index++
      }
      continue
    }

    if (char === '/' && text[index + 1] === '*') {
      comment = true
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '[') {
      bracket = true
      depth[index] = level
      skip[index] = true
      continue
    }

    if (char === '(') {
      depth[index] = level
      skip[index] = false
      level++
      continue
    }

    if (char === ')') {
      level = Math.max(0, level - 1)
      depth[index] = level
      skip[index] = false
      continue
    }

    depth[index] = level
    skip[index] = false
  }

  return { depth, skip }
}
