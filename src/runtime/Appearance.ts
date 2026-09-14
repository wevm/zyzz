/** Serializes root appearance restoration and controls the live root selection from compiled scope names. @module */
import type * as Config from '../Config.js'
import * as Scheme from '../internal/Scheme.js'

/**
 * Binds an HTML-safe script factory to compiled named theme classes.
 * The factory is server-safe; only its returned JavaScript accesses the DOM.
 * A saved scheme swaps the stylesheet scheme class and sets the inline `color-scheme`.
 * @param entries - Catalog names paired with compiled scope classes.
 * @param defaults - Configuration-level storage key applied when a call supplies none.
 * @returns A pure script factory that never reads or writes browser state itself.
 */
export function create(
  entries: readonly (readonly [string, string])[],
  defaults: create.Options = {},
): (options?: Config.ScriptOptions) => string {
  return (options = {}) => {
    const catalog = serialize(entries)
    const key = serialize(options.storageKey ?? defaults.storageKey ?? 'zyzz')
    const schemes = serialize(Object.entries(Scheme.classes))

    return `(()=>{try{const value=JSON.parse(localStorage.getItem(${key})||"null");if(!value||typeof value!=="object"||Array.isArray(value))return;const root=document.documentElement;const catalog=new Map(${catalog});if(Object.hasOwn(value,"theme")&&typeof value.theme==="string"&&catalog.has(value.theme)){root.classList.remove(...catalog.values());root.classList.add(catalog.get(value.theme))}const schemes=new Map(${schemes});if(Object.hasOwn(value,"colorScheme")&&schemes.has(value.colorScheme)){root.classList.remove(...schemes.values());root.classList.add(schemes.get(value.colorScheme));root.style.colorScheme=value.colorScheme}}catch{}})();`
  }
}

/** Script factory defaults. */
export declare namespace create {
  /** Configuration-level initialization settings. */
  type Options = {
    /** localStorage key shared with root controls; defaults to zyzz. */
    readonly storageKey?: string | undefined
  }
}

/**
 * Binds root selection controls to compiled named theme classes.
 * Creation touches no browser state; `get` and `set` read and write
 * `document.documentElement` and the record the initialization script restores.
 * @param entries - Catalog names paired with compiled scope classes.
 * @param options - Default theme reported without a root class and the storage key.
 * @returns Controls reading the applied root selection and applying saved changes.
 */
export function root<name extends string>(
  entries: readonly (readonly [string, string])[],
  options: root.Options = {},
): Root<name> {
  const catalog = new Map(entries)
  const key = options.storageKey ?? 'zyzz'
  const schemes = Object.entries(Scheme.classes) as [Scheme.Name, string][]

  function get(): Selection<name> {
    const classes = document.documentElement.classList
    const theme =
      [...catalog].find(([, className]) => classes.contains(className))?.[0] ??
      options.defaultTheme
    const colorScheme = schemes.find(([, className]) =>
      classes.contains(className),
    )?.[0]

    return {
      ...(theme === undefined ? {} : { theme }),
      ...(colorScheme === undefined ? {} : { colorScheme }),
    } as Selection<name>
  }

  function set(selection: Partial<Selection<name>>) {
    const element = document.documentElement
    const next = { ...get(), ...selection } as {
      colorScheme?: Scheme.Name | undefined
      theme?: string | undefined
    }
    const scopeClass =
      next.theme === undefined ? undefined : catalog.get(next.theme)

    if (next.theme !== undefined && scopeClass === undefined)
      throw new TypeError('Invalid theme selection.')

    element.classList.remove(
      ...catalog.values(),
      ...schemes.map(([, className]) => className),
    )

    if (scopeClass !== undefined) element.classList.add(scopeClass)

    if (next.colorScheme !== undefined) {
      if (!Object.hasOwn(Scheme.classes, next.colorScheme))
        throw new TypeError('Invalid theme selection.')

      element.classList.add(Scheme.classes[next.colorScheme])
      element.style.colorScheme = next.colorScheme
    } else element.style.removeProperty('color-scheme')

    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Blocked storage keeps the selection for this document only.
    }
  }

  return { get, set }
}

/** Root control contracts. */
export declare namespace root {
  /** Catalog defaults and storage settings. */
  type Options = {
    /** Theme reported by `get` when the root carries no catalog class. */
    readonly defaultTheme?: string | undefined
    /** localStorage key shared with the initialization script; defaults to zyzz. */
    readonly storageKey?: string | undefined
  }
}

/** Live root selection controls. */
export type Root<name extends string> = {
  /** Reads the theme and scheme classes the root carries. */
  readonly get: () => Selection<name>
  /** Applies fields over the current selection and saves the result. */
  readonly set: (selection: Partial<Selection<name>>) => void
}

/** A catalog theme with an optional scheme; an omitted scheme inherits. Token-free and single-theme configurations select only a scheme. */
export type Selection<name extends string> = [name] extends [never]
  ? { readonly colorScheme?: Scheme.Name | undefined }
  : {
      readonly colorScheme?: Scheme.Name | undefined
      readonly theme: name
    }

function serialize(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
