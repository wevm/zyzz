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
  html = false,
) {
  const catalog = Object.fromEntries(entries)

  const select = (input: { theme: string; colorScheme?: string }) => {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      !Object.hasOwn(input, 'theme') ||
      typeof input.theme !== 'string' ||
      !Object.hasOwn(catalog, input.theme) ||
      Object.keys(input).some(
        (key) => key !== 'theme' && key !== 'colorScheme',
      ) ||
      (input.colorScheme !== undefined &&
        !['light', 'dark', 'light dark'].includes(input.colorScheme))
    )
      throw new TypeError('Invalid theme selection.')

    const scheme = input.colorScheme as Scheme.Name | undefined

    return {
      [html ? 'class' : 'className']: scheme
        ? `${catalog[input.theme]} ${Scheme.classes[scheme]}`
        : catalog[input.theme],
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
