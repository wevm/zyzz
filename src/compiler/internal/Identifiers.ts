/** Decodes CSS identifier spellings at source and packed compiler boundaries. @module */
import * as Lightning from 'lightningcss'

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
