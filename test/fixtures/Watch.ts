/**
 * Provides bounded completion notifications for real filesystem watch workflows.
 * @module
 */
import type { Host } from 'zyzz/node'

/** Bounded notifications for real host integration fixtures and benchmarks. */
export function create(options: create.Options) {
  type Pending = {
    reject: (error: unknown) => void
    resolve: () => void
    timer: ReturnType<typeof setTimeout>
  }
  let pending: Pending | undefined

  function next(action?: () => Promise<void>) {
    if (pending) throw new Error('A watch build is already pending.')
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pending !== current) return
        pending = undefined
        reject(new Error('Watch build timed out.'))
      }, options.timeoutMs ?? 5000)
      const current = { reject, resolve, timer }
      pending = current
      if (action)
        void Promise.resolve()
          .then(action)
          .catch((error: unknown) => {
            if (pending !== current) return
            clearTimeout(pending.timer)
            pending = undefined
            reject(error)
          })
    })
  }

  function onResult(event: Host.Event) {
    if (
      !pending ||
      ('result' in event && !event.result.changed.includes(options.path))
    )
      return
    const current = pending
    clearTimeout(current.timer)
    pending = undefined
    if ('error' in event) current.reject(event.error)
    else current.resolve()
  }

  return { next, onResult }
}

/** Real notification fixture configuration. */
export declare namespace create {
  /** Artifact and deadline used by integration tests and benchmarks. */
  type Options = {
    /** Output artifact whose successful change completes the wait. */
    readonly path: string
    /** Failure deadline, defaulting to five seconds. */
    readonly timeoutMs?: number | undefined
  }
}
