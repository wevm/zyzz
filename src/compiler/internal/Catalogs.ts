/** Reads configuration theme catalogs from packed contracts and serializes their root initialization. @module */
import * as Appearance from '../../runtime/Appearance.js'
import * as ThemeValues from '../../web/internal/Themes.js'

/** Initialization inputs read from one compiled configuration. */
export type Catalog = {
  /** Theme names paired with the compiled scope classes the stylesheet emits. */
  readonly entries: readonly (readonly [string, string])[]
  /** Configuration identity that prefixes every scope key. */
  readonly identity: string
  /** localStorage key shared by the configuration's script and root controls. */
  readonly storageKey: string | undefined
}

/** Reads each configuration's theme catalog and storage key from a contract, one per configuration identity. */
export function read(contract: string): readonly Catalog[] {
  const parsed = JSON.parse(contract) as {
    exports?: Record<
      string,
      {
        kind?: string
        members?: Record<string, { theme?: string }>
        options?: { storageKey?: string; themes?: Record<string, unknown> }
        selection?: boolean
        theme?: string
      }
    >
    themes?: Record<string, { identity?: string }>
  }
  const configurations = new Map<
    string,
    { entries: Map<string, string>; storageKey: string | undefined }
  >()

  for (const binding of Object.values(parsed.exports ?? {})) {
    if (binding.kind !== 'config' || binding.theme === undefined) continue

    // A binding names its selected default scope; the theme metadata carries
    // the configuration identity that prefixes every scope key.
    const identity = parsed.themes?.[binding.theme]?.identity ?? binding.theme
    let configuration = configurations.get(identity)

    if (!configuration) {
      configuration = {
        entries: new Map(),
        storageKey: binding.options?.storageKey,
      }
      configurations.set(identity, configuration)
    }

    // Script and root bindings carry no members, so the catalog derives their scope keys.
    for (const name of Object.keys(binding.options?.themes ?? {}))
      configuration.entries.set(name, `${identity}-${name}`)

    for (const [path, member] of Object.entries(binding.members ?? {})) {
      const names = JSON.parse(path) as readonly string[]
      const name = (() => {
        if (binding.selection) return names.length === 1 ? names[0] : undefined
        return names.length === 2 && names[0] === 'themes'
          ? names[1]
          : undefined
      })()

      if (name !== undefined && member.theme)
        configuration.entries.set(name, member.theme)
    }
  }

  // Scope keys become classes through the same escaping the emitted stylesheet used.
  return [...configurations].map(([identity, { entries, storageKey }]) => ({
    entries: [...entries].map(
      ([name, scope]) =>
        [name, `z_theme-${ThemeValues.encode(scope)}`] as const,
    ),
    identity,
    storageKey,
  }))
}

/**
 * Serializes the initialization script of every configuration, once per
 * distinct script so configurations sharing a catalog and key run once.
 * @param catalogs - Configurations read from the contracts a document loads.
 * @returns Self-contained scripts that restore a saved selection before paint.
 */
export function scripts(catalogs: readonly Catalog[]): readonly string[] {
  return [
    ...new Set(
      catalogs.map(({ entries, storageKey }) =>
        Appearance.create(entries, { storageKey })(),
      ),
    ),
  ]
}
