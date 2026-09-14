/** Converts compiled styling props to DOM attributes and HTML text. @module */
import type { css } from '../css.js'
import * as Props from './Props.js'

/** DOM attributes ready for a framework spread or setAttribute. */
export type Attributes = {
  /** Compiled and external classes. */
  readonly class: string
  /** Serialized CSS declarations. Renderers own HTML escaping. */
  readonly style?: string | undefined
} & { readonly [name: `data-${string}`]: string | undefined }

/**
 * Converts compiled styling props without generating CSS rules or mutating inputs.
 * Values retain explicit CSS units. Custom properties retain their spelling.
 * @param props - Applied style or theme props, including owned data attributes.
 * @returns Unescaped DOM attribute values. Never insert them into HTML directly.
 */
export function from(
  props: css.Props & { readonly [name: `data-${string}`]: string | undefined },
): Attributes {
  const result: {
    class: string
    style?: string
    [name: `data-${string}`]: string | undefined
  } = { class: props.className }

  if (props.style !== undefined) {
    const declarations: string[] = []

    for (const [property, value] of Object.entries(props.style)) {
      if (value === undefined || value === null) continue

      const name = property.startsWith('--')
        ? property
        : property
            .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
            .replace(/^ms-/, '-ms-')

      declarations.push(`${name}:${value}`)
    }

    result.style = declarations.join(';')
  }

  for (const [name, value] of Object.entries(props))
    if (name.startsWith('data-'))
      result[name as `data-${string}`] = value as string | undefined

  return result
}

/**
 * Serializes styling attributes for insertion inside an HTML opening tag.
 * @param attributes - DOM attributes returned by from.
 * @returns Space-separated attributes with quoted, HTML-escaped values.
 */
export function serialize(attributes: Attributes): string {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${escape(name)}="${escape(value!)}"`)
    .join(' ')
}

function escape(value: string): string {
  return value.replace(/[&<>"'\s]/g, (character) => {
    if (character === '&') return '&amp;'
    if (character === '<') return '&lt;'
    if (character === '>') return '&gt;'
    if (character === '"') return '&quot;'
    if (character === "'") return '&#39;'

    return `&#${character.charCodeAt(0)};`
  })
}

/** Binds compiler-generated props to native HTML attributes. */
export function bind<input>(
  fn: (input: input) => css.Props,
): (input: input) => css.Props<'html'> {
  return (input) => from(fn(input))
}

/** Creates a static HTML style callable without CSS generation. */
export function create(options: Props.create.Options): css.ReturnType<'html'> {
  return bind(Props.create(options)) as css.ReturnType<'html'>
}
