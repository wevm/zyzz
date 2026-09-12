/** Adapts standard descriptor extensions that precede the pinned parser's grammar. @module */
import * as Lightning from 'lightningcss'

/** Parses structured contributions while retaining newer font descriptors. */
export function transform<C extends Lightning.CustomAtRules>(
  options: Lightning.TransformOptions<C>,
): Lightning.TransformResult {
  const source = new TextDecoder().decode(options.code)
  validateFeatures(source)
  // The pinned visitor cannot round-trip the nested Option used for anonymous import layers.
  // Give emitted anonymous layers a temporary name while URL visitors run, then restore them.
  let importMarker = 'zyzz-anonymous-import'
  while (source.includes(importMarker)) importMarker += '-x'
  const imports = options.visitor
    ? source.replace(
        /^(\s*@import\s+(?:url\()?"(?:\\.|[^"\\])*"\)?\s+)layer(?=[\s;])/gm,
        `$1layer(${importMarker})`,
      )
    : source
  let marker = '-zyzz-ffv-000000000'
  let suffix = 0
  while (source.toLowerCase().includes(marker))
    marker = `-zyzz-ffv-${(++suffix).toString(36).padStart(9, '0')}`
  let paletteMarker = '-zyzz-fpv-000000000'
  let paletteSuffix = 0
  while (source.toLowerCase().includes(paletteMarker))
    paletteMarker = `-zyzz-fpv-${(++paletteSuffix).toString(36).padStart(9, '0')}`
  // The pinned parser silently drops font-family lists from palette rules.
  const features = rename(imports, 'font-feature-values', marker)
  const renamed = source.toLowerCase().includes('@font-palette-values')
    ? rename(features, 'font-palette-values', paletteMarker)
    : features
  if (source === renamed) return Lightning.transform(options)
  const result = Lightning.transform({
    ...options,
    code: new TextEncoder().encode(renamed),
  })
  return {
    ...result,
    code: new TextEncoder().encode(
      rename(
        rename(
          new TextDecoder()
            .decode(result.code)
            .replaceAll(`layer(${importMarker})`, 'layer'),
          marker,
          'font-feature-values',
        ),
        paletteMarker,
        'font-palette-values',
      ),
    ),
  }
}

// Contribution extraction validates feature blocks and their descriptors before this adapter.
// At-keyword substitution keeps Lightning's token/URL traversal without discarding newer descriptors.
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

// Validate the standard rule before shielding the newer font-display descriptor.
function validateFeatures(source: string): void {
  if (!source.toLowerCase().includes('@font-feature-values')) return
  const masked = source.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\//g,
    (value) => ' '.repeat(value.length),
  )
  for (const match of masked.matchAll(/@font-feature-values(?=[\s{])/gi)) {
    const start = match.index
    const open = masked.indexOf('{', start)
    if (open < 0) throw new Error('Invalid font-feature-values block.')
    let depth = 1
    let end = open + 1
    let plain = source.slice(start, open + 1)
    let cursor = open + 1
    for (; end < masked.length && depth; end++) {
      const char = masked[end]
      if (char === '{') depth++
      else if (char === '}') depth--
      else if (depth === 1 && masked.slice(end).match(/^font-display\s*:/i)) {
        const finish = masked.indexOf(';', end)
        const close = masked.indexOf('}', end)
        const boundary = finish >= 0 && finish < close ? finish : close
        if (boundary < 0) throw new Error('Invalid font-display descriptor.')
        const descriptor = masked.slice(end, boundary)
        if (
          !/^font-display\s*:\s*(?:auto|block|fallback|optional|swap)\s*$/i.test(
            descriptor,
          )
        )
          throw new Error('Invalid font-display descriptor.')
        plain += source.slice(cursor, end)
        cursor = boundary + (boundary === finish ? 1 : 0)
        end = cursor - 1
      }
    }
    if (depth) throw new Error('Invalid font-feature-values block.')
    plain += source.slice(cursor, end)
    Lightning.transform({
      filename: 'font-feature-values.css',
      code: new TextEncoder().encode(plain),
      errorRecovery: false,
    })
  }
}
