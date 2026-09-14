/** Decodes CSS identifier spellings at source and packed compiler boundaries. @module */
import * as Lightning from 'lightningcss'

/** Reads an entire CSS identifier list, including escaped delimiters and comments. */
export function list(
  value: string,
  separator: 'comma' | 'space',
): readonly string[] | undefined {
  const input = tokens(value)
  if (!input) return undefined
  const names: string[] = []
  let needName = true
  for (const token of input) {
    if (token.type === 'token' && token.value.type === 'comma') {
      if (separator !== 'comma' || needName) return undefined
      needName = true
      continue
    }
    const name =
      token.type === 'dashed-ident'
        ? token.value
        : token.type === 'token' && token.value.type === 'ident'
          ? token.value.value
          : undefined
    if (name === undefined || (!needName && separator === 'comma'))
      return undefined
    names.push(name)
    needName = false
  }
  return !needName && names.length ? names : undefined
}

/** Checks a complete CSS URL value without accepting an injected declaration. */
export function url(value: string): boolean {
  const input = tokens(value)
  return input?.length === 1 && input[0]?.type === 'url'
}

function tokens(value: string): readonly Lightning.TokenOrValue[] | undefined {
  try {
    let result: readonly Lightning.TokenOrValue[] | undefined
    Lightning.transform({
      filename: 'tokens.css',
      code: new TextEncoder().encode(`@zyzz-tokens ${value};`),
      visitor: {
        StyleSheet(sheet) {
          const rule = sheet.rules[0]
          if (
            sheet.rules.length === 1 &&
            rule?.type === 'unknown' &&
            rule.value.name === 'zyzz-tokens' &&
            rule.value.block === null
          )
            result = rule.value.prelude.filter(
              (token) =>
                !(
                  token.type === 'token' &&
                  ['white-space', 'comment'].includes(token.value.type)
                ),
            )
        },
      },
    })
    return result
  } catch {
    return undefined
  }
}

/** Returns the identifier token value, or undefined for malformed input. */
export function read(value: string): string | undefined {
  if (/^(?:--|-?[_a-zA-Z])[\w-]*$/.test(value)) return value

  try {
    let decoded: string | undefined
    Lightning.transform({
      filename: 'identifier.css',
      code: new TextEncoder().encode(
        `@namespace ${value}\n"urn:zyzz:identifier";`,
      ),
      visitor: {
        StyleSheet(sheet) {
          const rule = sheet.rules[0]
          if (
            sheet.rules.length === 1 &&
            rule?.type === 'namespace' &&
            rule.value.url === 'urn:zyzz:identifier'
          )
            decoded = rule.value.prefix ?? undefined
        },
      },
    })
    return decoded
  } catch {
    return undefined
  }
}

/** Reads an explicit authoring identity shared with uncompiled execution. */
export function explicit(
  call: import('@oxc-project/types').CallExpression,
): string | undefined {
  const argument = call.arguments[1]
  if (!argument) return undefined
  if (argument.type !== 'ObjectExpression' || argument.properties.length !== 1)
    throw new Error('Definition options require one literal id.')
  const property = argument.properties[0]!
  if (
    property.type !== 'Property' ||
    property.computed ||
    property.kind !== 'init' ||
    property.method ||
    (property.key.type === 'Identifier'
      ? property.key.name
      : property.key.type === 'Literal'
        ? property.key.value
        : undefined) !== 'id' ||
    property.value.type !== 'Literal' ||
    typeof property.value.value !== 'string' ||
    !property.value.value
  )
    throw new Error('Definition options require one nonempty literal id.')
  return property.value.value
}
