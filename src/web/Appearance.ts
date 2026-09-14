/** Applies, reads, and persists the root theme selection on the document element. @module */
import * as Scheme from '../internal/Scheme.js'

/**
 * Binds root appearance operations to a compiled named theme catalog.
 * Creation touches no browser state; each returned operation reads or writes
 * `document.documentElement` and the same localStorage record `script()` restores.
 * @param options - Catalog members, the default selection, and the storage key.
 * @returns Operations that apply, read, restore, and persist the root selection.
 */
export function create<const name extends string>(
  options: create.Options<name>,
): create.ReturnType<name> {
  const key = options.storageKey ?? 'zyzz'
  const names = Object.keys(options.themes) as (keyof typeof options.themes)[]
  const catalog = Object.fromEntries(
    names.map((name) => [name, options.themes[name].className]),
  ) as Readonly<Record<name, string>>
  const schemes = Object.keys(Scheme.classes) as readonly Scheme.Name[]

  function apply(selection: Selection<name>) {
    const root = document.documentElement

    root.classList.remove(
      ...Object.values<string>(catalog),
      ...Object.values(Scheme.classes),
    )
    root.classList.add(catalog[selection.theme])

    if (selection.colorScheme) {
      root.classList.add(Scheme.classes[selection.colorScheme])
      root.style.colorScheme = selection.colorScheme
    } else root.style.removeProperty('color-scheme')
  }

  function current(): Selection<name> {
    const root = document.documentElement
    const theme =
      names.find((name) => root.classList.contains(catalog[name])) ??
      options.defaults.theme
    const colorScheme = schemes.find((scheme) =>
      root.classList.contains(Scheme.classes[scheme]),
    )

    return colorScheme ? { colorScheme, theme } : { theme }
  }

  function restore(): Selection<name> {
    const saved = (() => {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (!value || typeof value !== 'object' || Array.isArray(value))
          return {}

        const record = value as { colorScheme?: unknown; theme?: unknown }
        const theme = names.find((name) => name === record.theme)
        const colorScheme = schemes.find(
          (scheme) => scheme === record.colorScheme,
        )

        return {
          ...(theme ? { theme } : {}),
          ...(colorScheme ? { colorScheme } : {}),
        }
      } catch {
        return {}
      }
    })()
    const selection: Selection<name> = { ...options.defaults, ...saved }

    apply(selection)

    return selection
  }

  function select(selection: Selection<name>) {
    apply(selection)

    try {
      localStorage.setItem(key, JSON.stringify(selection))
    } catch {
      // Blocked storage keeps the selection for this document only.
    }
  }

  return { apply, current, restore, select }
}

/** Root appearance contracts. */
export declare namespace create {
  /** Catalog, defaults, and storage inputs. */
  type Options<name extends string> = {
    /** Selection applied when storage holds no valid record. Catalog names infer from `themes`. */
    readonly defaults: Selection<NoInfer<name>>
    /** localStorage key shared with the config's `script()`. Defaults to `zyzz`. */
    readonly storageKey?: string | undefined
    /** Named catalog from `Config.create`; members expose their compiled scope classes. */
    readonly themes: { readonly [key in name]: { readonly className: string } }
  }

  /** Operations over the document element and storage. */
  type ReturnType<name extends string> = {
    /** Replaces the root theme and scheme classes and the inline `color-scheme` without saving. */
    readonly apply: (selection: Selection<name>) => void
    /** Reads the selection the root carries, falling back to the defaults. */
    readonly current: () => Selection<name>
    /** Applies the saved selection over the defaults and returns it. */
    readonly restore: () => Selection<name>
    /** Applies a selection and saves it for the next visit. */
    readonly select: (selection: Selection<name>) => void
  }
}

/** A catalog theme with an optional scheme; an omitted scheme inherits. */
export type Selection<name extends string> = {
  readonly colorScheme?: Scheme.Name | undefined
  readonly theme: name
}
