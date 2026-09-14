/** Names atomic declarations with readable values and scoped conflict identities. @module */
import * as Literal from '../../internal/Literal.js'

/** Creates a CSS identifier without embedding arbitrary CSS syntax. */
export function create(options: create.Options): string {
  const property = Object.hasOwn(aliases, options.property)
    ? aliases[options.property]!
    : Literal.name(options.property)
  const condition =
    /^&:(hover|focus|focus-visible|active|disabled)\{([^{}]+)\}$/.exec(
      options.body,
    )
  const body = condition?.[2] ?? options.body
  const prefix = `${Literal.name(options.property)}:`
  const literal =
    body.startsWith(prefix) && body.endsWith(';')
      ? body.slice(prefix.length, -1)
      : ''
  const simple = /^[a-zA-Z0-9-]{1,24}$/.test(literal)
  const label =
    options.property === 'display' && displays.has(literal)
      ? literal
      : `${property}${simple ? `-${literal}` : ''}`

  const suffix = (() => {
    if (options.context !== undefined)
      return `-${hash(options.context)}${options.slot === undefined ? '' : `-${options.slot}`}`
    if (!simple) return `-${hash(options.body)}`
    return ''
  })()

  if (options.stable) return `z-${encode(property)}${suffix}`

  // Custom properties and vendor spellings can contain identifier punctuation.
  return `z-${condition ? `${condition[1]}-` : ''}${encode(label)}${suffix}`
}

/** Atomic naming inputs; context retains declaration ordering and module ownership. */
export declare namespace create {
  /** Serialized declaration and its optional stable slot identity. */
  type Options = {
    /** Complete declaration, including fallbacks and conditions. */
    readonly body: string
    /** Identity required when the declaration cannot share a global rule. */
    readonly context?: string | undefined
    /** Authoring property spelling. */
    readonly property: string
    /** Ordered declaration slot inside a contextual style. */
    readonly slot?: number | undefined
    /** Keep names independent of values for CSS-only development updates. */
    readonly stable?: boolean | undefined
  }
}

const aliases: Readonly<Record<string, string>> = {
  backgroundColor: 'bg',
  color: 'text',
  height: 'h',
  margin: 'm',
  marginBottom: 'mb',
  marginLeft: 'ml',
  marginRight: 'mr',
  marginTop: 'mt',
  opacity: 'opacity',
  padding: 'p',
  paddingBottom: 'pb',
  paddingLeft: 'pl',
  paddingRight: 'pr',
  paddingTop: 'pt',
  width: 'w',
}

const displays = new Set([
  'block',
  'flex',
  'grid',
  'inline',
  'inline-block',
  'inline-flex',
  'inline-grid',
  'none',
])

function encode(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9-]/g,
    (character) => `_${character.charCodeAt(0).toString(16)}_`,
  )
}

// Two independent streams keep identities deterministic without host APIs.
function hash(value: string): string {
  let first = 2166136261
  let second = 5381

  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second, 33) ^ code
  }

  return (first >>> 0).toString(36) + (second >>> 0).toString(36)
}
