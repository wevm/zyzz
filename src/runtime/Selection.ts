/** Selects compiler-owned theme classes without evaluating authoring code. @module */
import * as Scheme from '../internal/Scheme.js'

/**
 * Creates a validated selector with the compatible named theme catalog.
 * A selected scheme adds its stylesheet class beside the scope class and an inline `color-scheme`.
 * @param entries Compatible theme names paired with compiler-owned scope classes.
 * @param html Whether selection returns HTML class/serialized-style props. Defaults to false (React className/object-style props).
 * @returns A callable selector with catalog members exposing their scope class names.
 * @throws {TypeError} When selection names, schemes, or option keys are invalid.
 */
export function create<
  const entries extends readonly (readonly [string, string])[],
  const html extends boolean = false,
>(entries: entries, html?: html): create.ReturnType<entries[number][0], html>
export function create(
  entries: readonly (readonly [string, string])[],
  html: boolean,
  key: 'set',
  defaultSet?: string,
): (input?: { set?: string; colorScheme?: string }) => {
  className?: string
  class?: string
  style?: unknown
}
export function create(
  entries: readonly (readonly [string, string])[],
  html = false,
  key: 'set' | 'theme' = 'theme',
  defaultSet?: string,
): unknown {
  const catalog = Object.fromEntries(entries)

  const select = (
    input: {
      theme?: string
      set?: string
      colorScheme?: string
    } = {},
  ) => {
    const selected =
      input && typeof input === 'object'
        ? (input[key] ?? defaultSet)
        : undefined
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      (!Object.hasOwn(input, key) && defaultSet === undefined) ||
      typeof selected !== 'string' ||
      !Object.hasOwn(catalog, selected!) ||
      Object.keys(input).some(
        (field) => field !== key && field !== 'colorScheme',
      ) ||
      (input.colorScheme !== undefined &&
        !['light', 'dark', 'light dark'].includes(input.colorScheme))
    )
      throw new TypeError(
        key === 'set'
          ? 'Invalid variable selection.'
          : 'Invalid theme selection.',
      )

    const scheme = input.colorScheme as Scheme.Name | undefined

    return {
      [html ? 'class' : 'className']: scheme
        ? `${catalog[selected!]} ${Scheme.classes[scheme]}`
        : catalog[selected!],
      ...(scheme
        ? {
            style: html ? `color-scheme:${scheme}` : { colorScheme: scheme },
          }
        : {}),
    }
  }

  return Object.defineProperties(
    select,
    Object.getOwnPropertyDescriptors(
      Object.fromEntries(
        entries.map(([name, className]) => [name, { className }]),
      ),
    ),
  ) as unknown as create.ReturnType<string, boolean>
}

/** Typed compiler-owned selection and compatible catalog members. */
export declare namespace create {
  type ReturnType<name extends string, html extends boolean = false> = {
    <
      const input extends {
        readonly theme: name
        readonly colorScheme?: 'light' | 'dark' | 'light dark' | undefined
      },
    >(
      input: input &
        Record<Exclude<keyof input, 'theme' | 'colorScheme'>, never>,
    ): html extends true
      ? { readonly class: string; readonly style?: string | undefined }
      : {
          readonly className: string
          readonly style?:
            | { readonly colorScheme: 'light' | 'dark' | 'light dark' }
            | undefined
        }
  } & { readonly [key in name]: { readonly className: string } }
}
