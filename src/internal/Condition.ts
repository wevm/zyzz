/** Typed nested selector and condition keys without a general string index. @module */
import type * as Theme from '../Theme.js'

/** Explicit scoped selectors and standard conditional rule forms. */
export type Raw =
  | `${string}&${string}`
  | `:${string}`
  | '@starting-style'
  | `@supports ${string}`
  | `@media (${string}`
  | `@media ${'all' | 'print' | 'screen'}`
  | `@media ${'all' | 'print' | 'screen'} ${string}`
  | `@media ${'all' | 'print' | 'screen'},${string}`
  | `@media ${'only' | 'not'} ${string}`
  | `@container style(${string}`
  | `@container ${string} style(${string}`
  | `@container (${string}`
  | `@container ${string} (${string}`
type Names<tokens, group extends PropertyKey> = group extends keyof tokens
  ? `${Extract<keyof NonNullable<tokens[group]>, string | number>}`
  : never
type Alias<name extends string> =
  | name
  | `>=${name}`
  | `<${name}`
  | `${name}..${name}`
type Containers<tokens> = tokens extends {
  containerNames: readonly (infer name extends string)[]
}
  ? name
  : never
/** Keys inferred from the bound theme's own threshold groups. */
export type Keys<tokens extends Theme.Tokens = {}> =
  | Raw
  | `@media ${Alias<Names<tokens, 'breakpoints'>>}`
  | `@container ${Alias<Names<tokens, 'containers'>>}`
  | `@container ${Containers<tokens>} ${Alias<Names<tokens, 'containers'>>}`
/** Recognizes structured rule keys before declaration parsing. */
export function is(key: string): boolean {
  if (key.startsWith('--')) return false
  return (
    key.includes('&') ||
    key.startsWith(':') ||
    key === '@starting-style' ||
    /^@(media|supports|container) /.test(key)
  )
}

/** Normalizes rule whitespace and rejects unbalanced delimiters and unscoped selector lists. */
export function normalize(key: string): string {
  const stack: string[] = []
  let quote = ''
  let output = ''
  for (let index = 0; index < key.length; index++) {
    const char = key[index]!
    if (!quote && char === '/' && key[index + 1] === '*') {
      const end = key.indexOf('*/', index + 2)
      if (end === -1) throw new Error('Unterminated condition comment.')
      output += key.slice(index, end + 2).replace(/[\n\r\f]/g, ' ')
      index = end + 1
      continue
    }
    if (char === '\\') {
      const next = key[++index]
      if (next === undefined) throw new Error('Incomplete condition escape.')
      if (next !== '\n' && next !== '\r' && next !== '\f') output += char + next
      else if (next === '\r' && key[index + 1] === '\n') index++
      continue
    }
    if (quote) {
      output += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') stack.push(char === '(' ? ')' : ']')
    else if (char === ')' || char === ']') {
      if (stack.pop() !== char)
        throw new Error('Unbalanced condition delimiters.')
    } else if (char === '{' || char === '}')
      throw new Error('Unexpected condition block delimiter.')
    else if (char === ',' && !stack.length && key.startsWith(':'))
      throw new Error('Selector lists require explicit & selectors.')
    output += /[\n\r\f]/.test(char) ? ' ' : char
  }
  if (quote || stack.length) throw new Error('Unbalanced condition delimiters.')
  return output
}
