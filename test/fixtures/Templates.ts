/** Static template declarations shared by compiler integrations and benchmarks. @module */

/** Source with cooked escapes, nested primitives, fallbacks, and importance. */
export const source = [
  "import { css } from 'zyzz'",
  'export const box = css({',
  '  color: `r${"ed"}`,',
  '  content: `"${true}:${null}:${12n}"`,',
  '  marginLeft: `${-2n}px`,',
  '  padding: [`${4}px`, `${8 as const}px!`],',
  '  width: `calc(100% - ${`${+16}`}px)`,',
  '})()',
].join('\n')
