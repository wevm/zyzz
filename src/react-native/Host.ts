/** Owns explicit native context, bound callables, and adapter subscription lifetime. @module */
import type * as StyleSheet from './StyleSheet.js'

/**
 * Creates an isolated native host without importing React Native or reading device state.
 * @param options - Initial inputs, fixed capabilities, and optional adapter wiring.
 * @returns Context controls, callable binding, and explicit property preprocessing.
 * @throws {InputError} For invalid inputs or non-callable bindings.
 * @throws {LifecycleError} For changes during notification or after disposal.
 */
export function create<
  const processors extends Readonly<Record<string, Preprocessor>> = {},
>(options: create.Options<processors>) {
  const { platform } = options
  if (platform !== 'ios' && platform !== 'android')
    throw new InputError('Platform must be ios or android.')
  const capabilities = Object.freeze({ ...options.capabilities })
  if (Object.values(capabilities).some((value) => typeof value !== 'boolean'))
    throw new InputError('Capabilities must be boolean values.')
  const preprocessors = { ...options.preprocessors }
  if (Object.values(preprocessors).some((value) => typeof value !== 'function'))
    throw new InputError('Preprocessors must be functions.')

  const keys = [
    'colorScheme',
    'density',
    'fontScale',
    'highContrast',
    'reducedMotion',
    'rtl',
    'theme',
  ] as const
  const bindings = new Set<(context: Snapshot) => () => void>()
  const listeners = new Set<(context: Snapshot) => void>()
  let busy = false
  let disposed = false
  let cleanup: (() => void) | undefined
  let snapshot = read(
    Object.fromEntries(keys.map((key) => [key, options[key]])),
  )

  function read(values: Record<string, unknown>): Snapshot {
    if (
      Object.keys(values).some(
        (key) => !keys.includes(key as (typeof keys)[number]),
      ) ||
      (values.colorScheme !== 'light' && values.colorScheme !== 'dark') ||
      typeof values.theme !== 'string' ||
      !values.theme.trim() ||
      typeof values.density !== 'number' ||
      !Number.isFinite(values.density) ||
      values.density <= 0 ||
      typeof values.fontScale !== 'number' ||
      !Number.isFinite(values.fontScale) ||
      values.fontScale <= 0 ||
      typeof values.highContrast !== 'boolean' ||
      typeof values.reducedMotion !== 'boolean' ||
      typeof values.rtl !== 'boolean'
    )
      throw new InputError(
        'Provide a theme, resolved scheme, positive finite scales, and boolean accessibility inputs.',
      )
    const hairlineWidth =
      Math.round(0.4 * values.density) / values.density || 1 / values.density
    if (!Number.isFinite(hairlineWidth) || hairlineWidth <= 0)
      throw new InputError(
        'Density must produce a finite positive hairline width.',
      )
    return Object.freeze({
      ...values,
      capabilities,
      hairlineWidth,
      platform,
    }) as Snapshot
  }

  function active() {
    if (disposed) throw new LifecycleError('The native host is disposed.')
  }
  function mutable() {
    active()
    if (busy) throw new LifecycleError('Native host changes cannot be nested.')
  }

  const host = {
    /** Binds a pure factory to context changes while retaining its callable signature. */
    bind<call extends (...args: never[]) => unknown>(
      resolve: (context: Snapshot) => call,
    ): call {
      mutable()
      function prepare(context: Snapshot) {
        const next = resolve(context)
        if (typeof next !== 'function')
          throw new InputError('Bindings must return a callable.')
        return next
      }
      busy = true
      let current: call
      try {
        current = prepare(snapshot)
      } finally {
        busy = false
      }
      bindings.add((context) => {
        const next = prepare(context)
        return () => {
          current = next
        }
      })
      return new Proxy(current, {
        apply(_target, receiver, args) {
          active()
          return Reflect.apply(current, receiver, args)
        },
      })
    },
    /** Releases adapter wiring once and invalidates bound callables. The last snapshot remains readable. */
    dispose() {
      if (disposed) return
      mutable()
      disposed = true
      bindings.clear()
      listeners.clear()
      const release = cleanup
      cleanup = undefined
      release?.()
    },
    /** Returns the same immutable object until a successful input change. */
    getSnapshot(): Snapshot {
      return snapshot
    },
    /** Converts configured own properties without traversing or freezing their values. */
    preprocess<const style extends object>(
      style: style,
    ): {
      [key in keyof style]: key extends keyof processors
        ? ReturnType<processors[key]>
        : style[key]
    } {
      active()
      if (
        !style ||
        typeof style !== 'object' ||
        (Object.getPrototypeOf(style) !== Object.prototype &&
          Object.getPrototypeOf(style) !== null)
      )
        throw new InputError('Preprocessing requires a plain style object.')
      const context = snapshot
      const result = { ...style }
      for (const key of Object.keys(style)) {
        if (!Object.hasOwn(preprocessors, key)) continue
        const convert = preprocessors[key]
        if (convert)
          Object.defineProperty(result, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: convert(style[key as keyof style], context),
          })
      }
      return result as {
        [key in keyof style]: key extends keyof processors
          ? ReturnType<processors[key]>
          : style[key]
      }
    },
    /** Listens to committed context changes. The returned cleanup is idempotent. */
    subscribe(listener: (context: Snapshot) => void): () => void {
      active()
      const entry = (context: Snapshot) => listener(context)
      listeners.add(entry)
      return () => {
        listeners.delete(entry)
      }
    },
    /** Atomically prepares bindings, commits changed inputs, and notifies subscribers. */
    update(patch: Partial<Inputs>): void {
      mutable()
      if (!patch || typeof patch !== 'object' || Array.isArray(patch))
        throw new InputError('Updates require an input object.')
      const values = Object.fromEntries(keys.map((key) => [key, snapshot[key]]))
      const next = read({ ...values, ...patch })
      if (keys.every((key) => Object.is(snapshot[key], next[key]))) return
      busy = true
      try {
        const commits = [...bindings].map((prepare) => prepare(next))
        snapshot = next
        for (const commit of commits) commit()
        const errors: unknown[] = []
        // New subscribers start with the next update.
        const subscribers = [...listeners]
        for (const listener of subscribers) {
          if (!listeners.has(listener)) continue
          try {
            listener(snapshot)
          } catch (error) {
            errors.push(error)
          }
        }
        if (errors.length)
          throw new AggregateError(
            errors,
            'Native host subscribers failed after the update committed.',
          )
      } finally {
        busy = false
      }
    },
  }
  try {
    cleanup = options.watch?.((patch) => {
      if (!disposed) host.update(patch)
    })
    if (options.watch && typeof cleanup !== 'function')
      throw new InputError('The device adapter must return a cleanup function.')
  } catch (error) {
    disposed = true
    bindings.clear()
    listeners.clear()
    throw error
  }
  return host
}

/** Native host construction contract. */
export declare namespace create {
  /** Explicit device inputs and application-owned adapter hooks. */
  type Options<
    processors extends Readonly<Record<string, Preprocessor>> = Readonly<
      Record<string, Preprocessor>
    >,
  > = Inputs & {
    /** Fixed feature flags. Defaults to an empty capability map. */
    readonly capabilities?: Readonly<Record<string, boolean>> | undefined
    /** Fixed compilation destination. Switching requires another host and compatible compiled definitions. */
    readonly platform: 'android' | 'ios'
    /** Instance-local property converters. No global registration or implicit processing occurs. */
    readonly preprocessors?:
      | (processors & Readonly<Record<string, Preprocessor>>)
      | undefined
    /** Installs device listeners. Must return their cleanup and may synchronously supply initial updates. */
    readonly watch?:
      | ((update: (patch: Partial<Inputs>) => void) => () => void)
      | undefined
  }
}

/** Invalid native host inputs or binding results. */
export class InputError extends Error {
  /** Stable diagnostic name. */
  override name = 'Host.InputError'
}

/** Inputs supplied by an application or device adapter. */
export type Inputs = {
  /** Resolved appearance, without a system sentinel. */
  readonly colorScheme: StyleSheet.ColorScheme
  /** Physical pixels per logical unit. Must be positive and finite. */
  readonly density: number
  /** System font scale. Must be positive and finite. */
  readonly fontScale: number
  /** Whether the host requests higher-contrast content. */
  readonly highContrast: boolean
  /** Whether the host requests reduced motion. */
  readonly reducedMotion: boolean
  /** Whether layout follows a right-to-left direction. */
  readonly rtl: boolean
  /** Compiled theme label selected by binding factories. */
  readonly theme: string
}

/** An operation attempted to change a disposed or currently updating host. */
export class LifecycleError extends Error {
  /** Stable diagnostic name. */
  override name = 'Host.LifecycleError'
}

/** An explicitly supplied native property converter. */
export type Preprocessor = (value: unknown, context: Snapshot) => unknown

/** Immutable context shared by bindings and subscribers. */
export type Snapshot = Inputs & {
  /** Adapter-provided capabilities, fixed for this host's lifetime. */
  readonly capabilities: Readonly<Record<string, boolean>>
  /** React Native's density-dependent rounded hairline width. */
  readonly hairlineWidth: number
  /** Compilation destination, fixed for this host's lifetime. */
  readonly platform: 'android' | 'ios'
}
