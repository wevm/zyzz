/** Merges bindings and attributes over a compiler-resolved ordered CSS group. @module */
import type { style } from '../styleFunction.js'

/** Private ownership that extraction reports for composed applications, never DOM props. */
export type Owner = {
  /** Recipe attributes replaced together for repeated applications. */
  readonly attributes: readonly string[]
  /** Stable authoring definition identity. */
  readonly identity: string
  /** Choice-class prefixes of a class-selection recipe, replaced together for repeated applications. */
  readonly prefixes?: readonly string[] | undefined
  /** Private callback slots replaced together for repeated applications. */
  readonly slots: readonly string[]
}

/**
 * Binds a fixed composition class to runtime styling inputs without generating rules.
 * `true` stands for an application whose props the compiler already merged into the class.
 */
type Entry =
  | (style.Props & { readonly [key: `data-${string}`]: string | undefined })
  | true
  | false
  | null
  | undefined

/**
 * Binds compiled classes and ownership metadata to a props-merging callable.
 * @param options - Fixed classes, conditional cases, and ordered input ownership.
 * @returns A callable that merges application props without mutating its inputs.
 * Initialization allocates class lookup sets; calls allocate fresh props and emit no CSS.
 */
export function create(options: create.Options) {
  const inputs = options.inputs.map((input) => ({
    ...input,
    classes: new Set(input.className?.split(/\s+/).filter(Boolean)),
  }))
  // Only conditional arguments select a precompiled case.
  const conditional = inputs.some((input) => input.condition !== undefined)

  return (...entries: readonly Entry[]) => {
    let mask = 0
    if (conditional)
      for (let index = 0; index < inputs.length; index++) {
        const condition = inputs[index]!.condition
        if (condition !== undefined && entries[index]) mask |= 1 << condition
      }
    const className = options.cases?.[mask] ?? options.className ?? ''
    // Mutable while entries merge, then returned as immutable props.
    const result: {
      className: string
      style?: Record<string, string | number | undefined>
    } & Record<string, unknown> = { className }
    let attributes = false
    let external: string[] | undefined
    let style: Record<string, string | number | undefined> | undefined
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index]
      // Known entries own no attributes or bindings beyond their class.
      if (!entry || entry === true) continue
      const input = inputs[index]!
      // Owners replace only what earlier entries added, so the first contributions skip deletion.
      if (attributes && input.attributes)
        for (const attribute of input.attributes) delete result[attribute]
      if (style && input.slots)
        for (const slot of input.slots) delete style[slot]
      const prefixes = input.prefixes
      if (external && prefixes)
        external = external.filter(
          (name) => !prefixes.some((prefix) => name.startsWith(prefix)),
        )
      // An application's own class list adds nothing beyond the composition class.
      if (entry.className !== input.className)
        for (const name of entry.className.split(/\s+/))
          if (name && !input.classes.has(name)) (external ??= []).push(name)
      for (const name in entry)
        if (name.startsWith('data-') && Object.hasOwn(entry, name)) {
          result[name] = entry[name as `data-${string}`]
          attributes = true
        }
      const inline = entry.style
      if (inline) {
        style ??= {}
        for (const name in inline) {
          if (!Object.hasOwn(inline, name)) continue
          // Reinsert overwritten keys so inline shorthand/longhand ordering follows arguments.
          delete style[name]
          style[name] = inline[name as keyof typeof inline]
        }
      }
    }
    result.className = external
      ? [className, ...external].filter(Boolean).join(' ')
      : className || ''
    if (style && Object.keys(style).length) result.style = style
    return result as style.Props & {
      readonly [name: `data-${string}`]: string | undefined
    }
  }
}

/** Fixed composition initialization inputs. */
export declare namespace create {
  /** Compiler-selected rules and ownership for each application. */
  type Options = {
    /** Precompiled class lists indexed by argument-presence mask. The last is the complete list. */
    readonly cases?: readonly (string | null)[] | undefined
    /** Complete precompiled composition class list of a call without conditional arguments. */
    readonly className?: string | undefined
    /** Ordered application class lists and private ownership. */
    readonly inputs: readonly {
      /** Recipe attributes replaced together for repeated applications. */
      readonly attributes?: readonly string[] | undefined
      /** Generated classes superseded by the composition class. Known inputs omit it. */
      readonly className?: string | undefined
      /** Presence bit assigned to a conditional argument. */
      readonly condition?: number | undefined
      /** Choice-class prefixes replaced together for repeated applications. */
      readonly prefixes?: readonly string[] | undefined
      /** Private callback slots replaced together for repeated applications. */
      readonly slots?: readonly string[] | undefined
    }[]
  }
}
