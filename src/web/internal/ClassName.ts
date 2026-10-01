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
  const namespace = options.namespace ? `${options.namespace}-` : ''
  if (options.context !== undefined)
    return `z-${namespace}${options.context}-${encode(property)}${options.slot === undefined ? '' : `-${options.slot}`}`

  const value = simple ? literal : `[${literal || body}]`
  const readable =
    options.property === 'display' && displays.has(literal)
      ? literal
      : property.startsWith('--')
        ? `[${property}:${literal || body}]`
        : `${property}-${value}`
  // DOM class tokens cannot contain whitespace; preserve its spelling reversibly.
  return `z-${namespace}${condition ? `${condition[1]}-` : ''}${readable.replace(/[\s_"'<>]/gu, (character) => `_${character.codePointAt(0)!.toString(16)}_`)}`
}

/** Atomic naming inputs; context retains declaration ordering and module ownership. */
export declare namespace create {
  /** Serialized declaration and its optional stable slot identity. */
  type Options = {
    /** Complete declaration, including fallbacks and conditions. */
    readonly body: string
    /** Identity required when the declaration cannot share a global rule. */
    readonly context?: string | undefined
    /** Optional consumer-owned configuration namespace. */
    readonly namespace?: string | undefined
    /** Authoring property spelling. */
    readonly property: string
    /** Ordered declaration slot inside a contextual style. */
    readonly slot?: number | undefined
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

// Flex and grid also name shorthand properties, so retain their display prefix.
const displays = new Set([
  'block',
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

/** Escapes a generated class token for use as a CSS selector. */
export function selector(value: string): string {
  return value.replace(
    /[^a-zA-Z0-9_-]/gu,
    (character) => `\\${character.codePointAt(0)!.toString(16)} `,
  )
}

/** Carries exact emitted rule bodies for graph-wide collision checks. */
export const rules = Symbol('zyzz.css.rules')

/** Carries authored names between source extraction and CSS emission. */
export const labels = Symbol('zyzz.css.labels')

/** Authored names retained on extracted style data. */
export type Labels = Readonly<
  Record<
    string,
    { readonly name: string; readonly namespace?: string | undefined }
  >
>
