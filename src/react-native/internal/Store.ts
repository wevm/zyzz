/** Owns scoped React subscriptions and committed native style readers. @module */
import type * as NativeContext from '../../runtime/NativeContext.js'
import * as React from 'react'

/** Internal view update payload shared with the native bridge. */
export type Patch = {
  /** Runtime-local mounted view identifier. */
  readonly id: number
  /** Processed native style properties. */
  readonly props: Record<string, unknown>
}

type Selection = {
  readonly commit: () => void
  readonly patch?: Patch | undefined
}
type Reader = (value: NativeContext.Context) => Selection
type Writer = (patches: readonly Patch[]) => void

/** Nearest configuration-owned selection. */
export const context = React.createContext<
  ReturnType<typeof create> | undefined
>(undefined)

/** Creates subscriptions owned by a Provider or a provider-free style consumer. */
export function create(initial: NativeContext.Context) {
  let snapshot = Object.freeze(initial)
  const bindings = new Map<Reader, Writer>()
  const listeners = new Set<() => void>()

  return {
    bind(read: Reader, write: Writer) {
      bindings.set(read, write)
      return () => {
        bindings.delete(read)
      }
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      const entry = () => listener()
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    update(value: NativeContext.Context) {
      if (
        snapshot.colorScheme === value.colorScheme &&
        snapshot.set === value.set &&
        snapshot.viewport?.height === value.viewport?.height &&
        snapshot.viewport?.width === value.viewport?.width
      )
        return

      // Resolve every binding before applying a scope change that can fail.
      const selections: Selection[] = []
      const batches = new Map<Writer, Patch[]>()
      for (const [read, write] of bindings) {
        const selection = read(value)
        selections.push(selection)
        if (!selection.patch) continue
        let batch = batches.get(write)
        if (!batch) {
          batch = []
          batches.set(write, batch)
        }
        batch.push(selection.patch)
      }
      for (const [write, patches] of batches) write(patches)

      snapshot = Object.freeze(value)
      for (const selection of selections) selection.commit()
      // Subscriptions added during notification wait for the next change.
      for (const listener of Array.from(listeners))
        if (listeners.has(listener)) listener()
    },
  }
}
