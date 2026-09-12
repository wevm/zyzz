/** Full font-feature descriptor corpus shared by compiler and real host workflows. @module */
export const blocks = [
  '@annotation',
  '@character-variant',
  '@ornaments',
  '@styleset',
  '@stylistic',
  '@swash',
] as const

/** Emits every alias block with a distinct name and replaceable index. */
export function source(index: number, display = 'swap'): string {
  return `import {fontFeatureValues} from 'zyzz/web';\nfontFeatureValues({families:['Body','Fallback'],fontDisplay:${JSON.stringify(display)},features:{${blocks.map((block, i) => `${JSON.stringify(block)}:{${JSON.stringify('alias' + i)}:${block === '@styleset' ? `[${index},${index + 1},${index + 2}]` : block === '@character-variant' ? `[${index},${index + 1}]` : index}}`).join(',')}}},{within:['@layer fonts','@media screen']});`
}
