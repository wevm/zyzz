/** Checks complete keyframe selectors, including named timeline ranges. @module */
import * as Lightning from 'lightningcss'

/** Rejects invalid ordinary offsets and importance in transported keyframes. */
export function validate(source: string): void {
  Lightning.transform({
    filename: 'keyframes.css',
    code: new TextEncoder().encode(source),
    visitor: {
      Rule(rule) {
        if (rule.type !== 'keyframes') return
        for (const frame of rule.value.keyframes) {
          if (
            frame.selectors.some(
              (selector) =>
                selector.type === 'percentage' &&
                (selector.value < 0 || selector.value > 1),
            )
          )
            throw new Error('Ordinary keyframe offsets must be within 0–100%.')
          if (frame.declarations.importantDeclarations?.length)
            throw new Error('Keyframes forbid important declarations.')
        }
      },
    },
  })
}

/** Named timeline percentages are unrestricted. Ordinary offsets remain within 0–100%. */
export function accepts(selector: string): boolean {
  try {
    let valid = false
    Lightning.transform({
      filename: 'keyframe.css',
      code: new TextEncoder().encode(
        `@keyframes zyzz {${selector}{opacity:0}}`,
      ),
      visitor: {
        StyleSheet(sheet) {
          const rule = sheet.rules[0]
          if (
            sheet.rules.length !== 1 ||
            rule?.type !== 'keyframes' ||
            rule.value.keyframes.length !== 1
          )
            return
          const frame = rule.value.keyframes[0]!
          valid =
            frame.selectors.length > 0 &&
            frame.selectors.every(
              (selector) =>
                selector.type !== 'percentage' ||
                (selector.value >= 0 && selector.value <= 1),
            )
        },
      },
    })
    return valid
  } catch {
    return false
  }
}
