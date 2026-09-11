/** Selects compiler-owned theme classes without evaluating authoring code. @module */
/** Creates a validated selector with the compatible named theme catalog. */
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
    return {
      [html ? 'class' : 'className']: catalog[input.theme],
      ...(input.colorScheme
        ? {
            style: html
              ? `color-scheme:${input.colorScheme}`
              : { colorScheme: input.colorScheme },
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
  )
}
