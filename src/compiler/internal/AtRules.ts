/** Adapts standard descriptor extensions that precede the pinned parser's grammar. @module */
import * as Lightning from 'lightningcss'
import * as Results from './Results.js'

/** A stylesheet whose newer at-keywords travel through the parser under markers. */
type Transport = {
  readonly code: string
  readonly features: string
  readonly import: string
  readonly palette: string
  readonly property: string
}

/**
 * Parses structured contributions while retaining newer font descriptors.
 * The engine validates newer at-rules and renames the at-keywords the parser cannot round-trip.
 */
export function transform<C extends Lightning.CustomAtRules>(
  options: Lightning.TransformOptions<C>,
): Lightning.TransformResult {
  // Stylesheets without an @ byte cannot require at-keyword transport.
  if (!options.code.includes(64)) return Lightning.transform(options)

  const transport = Results.call<Transport | null>('css.transport', {
    code: new TextDecoder().decode(options.code),
    visitor: Boolean(options.visitor),
  })

  if (!transport) return Lightning.transform(options)

  const result = Lightning.transform({
    ...options,
    code: new TextEncoder().encode(transport.code),
  })

  return {
    ...result,
    code: new TextEncoder().encode(
      rename(
        rename(
          rename(
            new TextDecoder()
              .decode(result.code)
              .replaceAll(`layer(${transport.import})`, 'layer'),
            transport.property,
            'property',
          ),
          transport.features,
          'font-feature-values',
        ),
        transport.palette,
        'font-palette-values',
      ),
    ),
  }
}

/** Renames actual at-keywords without touching strings, comments, or function arguments. */
export function rename(source: string, before: string, after: string): string {
  let output = ''
  let quote = ''
  let parentheses = 0
  for (let index = 0; index < source.length; index++) {
    const char = source[index]!
    if (char === '\\') {
      output += char + (source[++index] ?? '')
      continue
    }
    if (quote) {
      output += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      if (end < 0) return source
      output += source.slice(index, end + 2)
      index = end + 1
      continue
    } else if (char === '(') parentheses++
    else if (char === ')') parentheses--
    else if (
      !parentheses &&
      char === '@' &&
      source.slice(index + 1, index + 1 + before.length).toLowerCase() ===
        before &&
      !/[\w-]/.test(source[index + 1 + before.length] ?? '')
    ) {
      output += `@${after}`
      index += before.length
      continue
    }
    output += char
  }
  return output
}

/** Relocates an import while omitting absent conditions in the parser's visitor return format. */
export function relocateImport(
  value: Lightning.ImportRule,
  url: string,
): Lightning.ReturnedRule {
  const { layer, supports, ...rest } = value
  return {
    type: 'import',
    value: {
      ...rest,
      url,
      ...(layer ? { layer } : {}),
      ...(supports ? { supports } : {}),
    },
  }
}
