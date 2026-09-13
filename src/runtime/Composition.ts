/** Merges bindings and attributes over a compiler-resolved ordered CSS group. @module */
import type { css } from '../css.js'

/** Private ownership retained in generated initialization data, never DOM props. */
export type Owner = {
  /** Recipe attributes replaced together for repeated applications. */
  readonly attributes: readonly string[]
  /** Stable authoring definition identity. */
  readonly identity: string
  /** Private callback slots replaced together for repeated applications. */
  readonly slots: readonly string[]
}

/** Binds a fixed composition class to runtime styling inputs without generating rules. */
type Entry =
  | (css.Props & { readonly [key: `data-${string}`]: string | undefined })
  | false
  | null
  | undefined

/**
 * Binds compiled classes and ownership metadata to a props-merging callable.
 * @param options - Fixed classes, conditional cases, and ordered input owners.
 * @returns A callable that merges application props without mutating its inputs.
 * Initialization allocates class lookup sets; calls allocate fresh props and emit no CSS.
 */
export function create(options: create.Options) {
  const inputs = options.inputs.map((input) => ({
    ...input,
    classes: new Set(input.className.split(/\s+/).filter(Boolean)),
  }))

  return (...entries: readonly Entry[]) => {
    let mask = 0
    for (const [index, input] of inputs.entries())
      if (input.condition !== undefined && entries[index])
        mask |= 1 << input.condition
    const className = options.cases?.[mask] ?? options.className
    const result: css.Props & Record<string, unknown> = {
      className,
    }
    const external: string[] = []
    const style: Record<string, string | number | undefined> = {}
    for (const [index, entry] of entries.entries()) {
      if (!entry) continue
      const input = inputs[index]!
      for (const owner of input.owners) {
        for (const attribute of owner.attributes) delete result[attribute]
        for (const slot of owner.slots) delete style[slot]
      }
      for (const name of entry.className.split(/\s+/))
        if (name && !input.classes.has(name)) external.push(name)
      for (const [name, value] of Object.entries(entry))
        if (name.startsWith('data-')) result[name] = value
      for (const [name, value] of Object.entries(entry.style ?? {})) {
        // Reinsert overwritten keys so inline shorthand/longhand ordering follows arguments.
        delete style[name]
        style[name] = value
      }
    }
    return {
      ...result,
      className: [className, ...external].filter(Boolean).join(' '),
      ...(Object.keys(style).length ? { style } : {}),
    }
  }
}

/** Fixed composition initialization inputs. */
export declare namespace create {
  /** Compiler-selected rules and ownership for each application. */
  type Options = {
    /** Optional precompiled class lists indexed by argument-presence mask. */
    readonly cases?: readonly string[] | undefined
    /** Complete precompiled composition class list. */
    readonly className: string
    /** Ordered application class lists and private ownership. */
    readonly inputs: readonly {
      /** Presence bit assigned to a conditional argument. */
      readonly condition?: number | undefined
      /** Generated classes superseded by the composition class. */
      readonly className: string
      /** Original definitions whose bindings and attributes this application owns. */
      readonly owners: readonly Owner[]
    }[]
  }
}
