/** Selects compiler-owned variable scope classes without evaluating authoring code. @module */
import * as Scheme from '../internal/Scheme.js'
import * as Html from './CompositionHtml.js'

/**
 * Creates a validated selector with the compatible named set catalog.
 * A selected scheme adds its stylesheet class beside the scope class and an inline `color-scheme`.
 * @param entries Compatible set names paired with compiler-owned scope classes.
 * @param html Whether selection returns HTML class/serialized-style props. Defaults to false (React className/object-style props).
 * @returns A callable selector returning scope props.
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
): (input?: { set?: string | undefined; colorScheme?: string | undefined }) => {
  className?: string
  class?: string
  style?: unknown
}
export function create(
  entries: readonly (readonly [string, string])[],
  html = false,
  key: 'set' = 'set',
  defaultSet?: string,
): unknown {
  const catalog = Object.fromEntries(entries)

  const select = (
    input: {
      set?: string | undefined
      colorScheme?: string | undefined
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
      throw new TypeError('Invalid variable selection.')

    const scheme = input.colorScheme as Scheme.Name | undefined

    const props = {
      className: scheme
        ? `${catalog[selected!]} ${Scheme.classes[scheme]}`
        : catalog[selected!]!,
      ...(scheme ? { style: { colorScheme: scheme } } : {}),
    }
    return html ? Html.from(props) : props
  }

  return select as create.ReturnType<string, boolean>
}

/** Typed compiler-owned scope selection. */
export declare namespace create {
  type ReturnType<name extends string, html extends boolean = false> = {
    <
      const input extends {
        readonly set: name
        readonly colorScheme?: 'light' | 'dark' | 'light dark' | undefined
      },
    >(
      input: input & Record<Exclude<keyof input, 'set' | 'colorScheme'>, never>,
    ): html extends true
      ? { readonly class: string; readonly style?: string | undefined }
      : {
          readonly className: string
          readonly style?:
            | { readonly colorScheme: 'light' | 'dark' | 'light dark' }
            | undefined
        }
  }
}
