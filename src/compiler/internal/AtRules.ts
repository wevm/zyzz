/** Adapts standard descriptor extensions that precede the pinned parser's grammar. @module */
import * as Lightning from 'lightningcss'

/** Parses structured contributions while retaining the font-display extension to font feature values. */
export function transform<C extends Lightning.CustomAtRules>(
  options: Lightning.TransformOptions<C>,
): Lightning.TransformResult {
  const source = new TextDecoder().decode(options.code)
  validateFeatures(source)
  let marker = '-zyzz-ffv-000000000'
  let suffix = 0
  while (source.toLowerCase().includes(marker))
    marker = `-zyzz-ffv-${(++suffix).toString(36).padStart(9, '0')}`
  const renamed = rename(source, 'font-feature-values', marker)
  if (source === renamed) return Lightning.transform(options)
  const result = Lightning.transform({
    ...options,
    code: new TextEncoder().encode(renamed),
  })
  return {
    ...result,
    code: new TextEncoder().encode(
      rename(
        new TextDecoder().decode(result.code),
        marker,
        'font-feature-values',
      ),
    ),
  }
}

// Contribution extraction validates feature blocks and their descriptors before this adapter.
// At-keyword substitution keeps Lightning's token/URL traversal without discarding newer descriptors.
function rename(source: string, before: string, after: string): string {
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
