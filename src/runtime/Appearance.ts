/** Serializes root appearance restoration and controls the live root selection from compiled scope names. @module */
import * as Scheme from '../internal/Scheme.js'

/**
 * Binds an HTML-safe script factory to compiled named set classes.
 * The factory is server-safe; only its returned JavaScript accesses the DOM.
 * A saved scheme swaps the stylesheet scheme class and sets the inline `color-scheme`;
 * a saved `null` scheme removes both so a cleared selection survives reloads.
 * @param entries - Catalog names paired with compiled scope classes.
 * @param options - Storage key shared with the configuration's root controls.
 * @returns A pure script factory that never reads or writes browser state itself.
 */
export function create(
  entries: readonly (readonly [string, string])[],
  options: create.Options = {},
): () => string {
  return () => {
    const catalog = serialize(entries)
    const key = serialize(options.storageKey ?? 'zyzz')
    const schemes = serialize(Object.entries(Scheme.classes))

    return `(()=>{try{const value=JSON.parse(localStorage.getItem(${key})||"null");if(!value||typeof value!=="object"||Array.isArray(value))return;const root=document.documentElement;const catalog=new Map(${catalog});if(Object.hasOwn(value,"set")&&typeof value.set==="string"&&catalog.has(value.set)){root.classList.remove(...catalog.values());root.classList.add(catalog.get(value.set))}const schemes=new Map(${schemes});if(Object.hasOwn(value,"colorScheme")){if(value.colorScheme===null){root.classList.remove(...schemes.values());root.style.removeProperty("color-scheme")}else if(schemes.has(value.colorScheme)){root.classList.remove(...schemes.values());root.classList.add(schemes.get(value.colorScheme));root.style.colorScheme=value.colorScheme}}}catch{}})();`
  }
}

/** Script factory settings. */
export declare namespace create {
  /** Configuration-level initialization settings. */
  type Options = {
    /** localStorage key shared with root controls; defaults to zyzz. */
    readonly storageKey?: string | undefined
  }
}

/**
 * Binds root selection controls to compiled named set classes.
 * Creation touches no browser state; `get` and `set` read and write
 * `document.documentElement` and the record the initialization script restores.
 * @param entries - Catalog names paired with compiled scope classes.
 * @param options - Default set reported without a root class and the storage key.
 * @returns Controls reading the applied root selection and applying saved changes.
 * @throws {TypeError} If a named catalog receives no default or one outside its entries.
 */
export function root<const name extends string>(
  entries: readonly (readonly [name, string])[],
  options: root.Options<name> = {},
): Root<name> {
  const catalog = new Map<string, string>(entries)
  const key = options.storageKey ?? 'zyzz'
  const schemes = Object.entries(Scheme.classes) as [Scheme.Name, string][]

  // Named catalogs always report a set, so the fallback must be one of them.
  if (
    catalog.size &&
    (options.defaultVars === undefined || !catalog.has(options.defaultVars))
  )
    throw new TypeError('defaultVars must name a catalog set.')

  function get(): Selection<name> {
    const classes = document.documentElement.classList
    const set =
      [...catalog].find(([, className]) => classes.contains(className))?.[0] ??
      options.defaultVars
    const colorScheme = schemes.find(([, className]) =>
      classes.contains(className),
    )?.[0]

    return {
      ...(set === undefined ? {} : { set }),
      ...(colorScheme === undefined ? {} : { colorScheme }),
    } as Selection<name>
  }

  function set(selection: Partial<Selection<name>>) {
    const element = document.documentElement
    const next = { ...get(), ...selection } as {
      colorScheme?: Scheme.Name | undefined
      set?: string | undefined
    }
    const scopeClass =
      next.set === undefined ? undefined : catalog.get(next.set)

    // Rejected input leaves the document and the saved record untouched.
    if (next.set !== undefined && scopeClass === undefined)
      throw new TypeError('Invalid set selection.')

    if (
      next.colorScheme !== undefined &&
      !Object.hasOwn(Scheme.classes, next.colorScheme)
    )
      throw new TypeError('Invalid set selection.')

    element.classList.remove(
      ...catalog.values(),
      ...schemes.map(([, className]) => className),
    )

    if (scopeClass !== undefined) element.classList.add(scopeClass)

    if (next.colorScheme !== undefined) {
      element.classList.add(Scheme.classes[next.colorScheme])
      element.style.colorScheme = next.colorScheme
    } else element.style.removeProperty('color-scheme')

    // The record mirrors the applied root, so a cleared scheme saves as null
    // and the script removes a server-rendered scheme on the next load.
    const record = {
      ...(next.set === undefined ? {} : { set: next.set }),
      colorScheme: next.colorScheme ?? null,
    }

    try {
      localStorage.setItem(key, JSON.stringify(record))
    } catch {
      // Blocked storage keeps the selection for this document only.
    }
  }

  return { get, set }
}

/** Root control contracts. */
export declare namespace root {
  /** Catalog defaults and storage settings. */
  type Options<name extends string = string> = {
    /** Theme reported by `get` when the root carries no catalog class; required with a named catalog. */
    readonly defaultVars?: NoInfer<name> | undefined
    /** localStorage key shared with the initialization script; defaults to zyzz. */
    readonly storageKey?: string | undefined
  }
}

/** Live root selection controls. */
export type Root<name extends string> = {
  /** Reads the set and scheme classes the root carries. */
  readonly get: () => Selection<name>
  /** Applies fields over the current selection and saves the result. */
  readonly set: (selection: Partial<Selection<name>>) => void
}

/** A catalog set with an optional scheme; an omitted scheme inherits. Token-free and single-set configurations select only a scheme. */
export type Selection<name extends string> = [name] extends [never]
  ? { readonly colorScheme?: Scheme.Name | undefined }
  : {
      readonly colorScheme?: Scheme.Name | undefined
      readonly set: name
    }

function serialize(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}
