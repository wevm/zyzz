/** Adapts standard descriptor extensions that precede the pinned parser's grammar. @module */
import * as Lightning from 'lightningcss'

/** Parses structured contributions while retaining the font-display extension to font feature values. */
export function transform<C extends Lightning.CustomAtRules>(
  options: Lightning.TransformOptions<C>,
): Lightning.TransformResult {
  const source = new TextDecoder().decode(options.code)
  const renamed = rename(
    source,
    'font-feature-values',
    '-zyzz-font-feature-values',
  )
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
        '-zyzz-font-feature-values',
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
