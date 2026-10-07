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

/** Carries a compilation's unit naming scope in, and its naming decisions out. */
export const units = Symbol('zyzz.css.units')

/**
 * Marks a graph compiled once with every module, whose stylesheets load together.
 * Only its modules may reuse names that unrelated modules introduce.
 */
export const complete = Symbol('zyzz.css.complete')

/** One compilation's unit names. */
export type Units = {
  /** Names a declaration unit, reusing a visible earlier name for an equal body. */
  readonly name: (body: string, namespace: string | undefined) => string
  /** Names chosen so far, keyed by namespace and body, and whether each was reused. */
  readonly used: ReadonlyMap<string, Decision>
}

/** A naming decision recorded so cached output can be validated against a later build. */
export type Decision = {
  /** Whether the name was introduced by an earlier compilation. */
  readonly borrowed: boolean
  /** Emitted class name. */
  readonly name: string
}

/** Shares unit names across the compilations of one graph. */
export function registry(): registry.ReturnType {
  const names = new Map<string, { name: string; owner: string }>()

  // A borrowed name stays tied to its first owner, so later modules can resolve it.
  function borrow(key: string, visible?: (owner: string) => boolean) {
    const previous = names.get(key)
    if (previous && (visible?.(previous.owner) ?? true)) return previous.name
    return undefined
  }

  return {
    restore(options) {
      for (const [key, decision] of options.used) {
        const name = borrow(key, options.visible)
        if ((name !== undefined) !== decision.borrowed) return false
        if (name !== undefined && name !== decision.name) return false
      }

      for (const [key, decision] of options.used)
        if (!names.has(key))
          names.set(key, { name: decision.name, owner: options.owner })

      return true
    },
    scope(options) {
      const local = new Map<string, number>()
      const used = new Map<string, Decision>()

      return {
        name(body, namespace) {
          const key = `${namespace ?? ''}\n${body}`

          // Every distinct body consumes a slot, so own names never depend on reuse.
          let index = local.get(key)
          if (index === undefined) {
            index = local.size
            local.set(key, index)
          }

          const borrowed = borrow(key, options.visible)
          // The underscore keeps unit names apart from readable names and anonymous scopes.
          const name =
            borrowed ??
            `z_${namespace ? `${namespace}-` : ''}${options.qualifier}${index.toString(36)}`

          if (!names.has(key)) names.set(key, { name, owner: options.owner })
          used.set(key, { borrowed: borrowed !== undefined, name })

          return name
        },
        used,
      }
    },
  }
}

/** Graph-wide unit naming contracts. */
export declare namespace registry {
  /** Visibility and identity of one compilation in the shared name table. */
  type Options = {
    /** Compilation identity recorded on the names it introduces. */
    readonly owner: string
    /** Limits reuse to names introduced by these owners. Defaults to every owner. */
    readonly visible?: ((owner: string) => boolean) | undefined
  }

  /** Creates per-compilation naming scopes over one shared name table. */
  type ReturnType = {
    /**
     * Registers a cached compilation's names. Returns false, registering nothing,
     * when compiling it now would choose different names.
     */
    readonly restore: (
      options: Options & {
        /** Decisions recorded by the cached compilation. */
        readonly used: ReadonlyMap<string, Decision>
      },
    ) => boolean
    /** Names units for one compilation, whose qualifier keeps new names distinct. */
    readonly scope: (
      options: Options & {
        /** Fixed prefix distinguishing this compilation's new names. */
        readonly qualifier: string
      },
    ) => Units
  }
}

/** Carries authored names between source extraction and CSS emission. */
export const labels = Symbol('zyzz.css.labels')

/** Authored names retained on extracted style data. */
export type Labels = Readonly<
  Record<
    string,
    { readonly name: string; readonly namespace?: string | undefined }
  >
>
