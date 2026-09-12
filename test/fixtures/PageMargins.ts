/** Inputs covering each standard page-margin context through compiler and host workflows. @module */

/** Every margin box in the pinned paged-media inventory. */
export const boxes = [
  '@bottom-center',
  '@bottom-left',
  '@bottom-left-corner',
  '@bottom-right',
  '@bottom-right-corner',
  '@left-bottom',
  '@left-middle',
  '@left-top',
  '@right-bottom',
  '@right-middle',
  '@right-top',
  '@top-center',
  '@top-left',
  '@top-left-corner',
  '@top-right',
  '@top-right-corner',
] as const

/** Independent named pages expose source ownership and replacement of every margin box. */
export function source(version: 'before' | 'after') {
  return `import {page as printPage} from 'zyzz/web';\n${boxes
    .map(
      (box, index) =>
        `printPage({selector:'sheet${index}',descriptors:{size:'200px 300px',margin:'30px','${box}':{content:'"${version}-${index}"',color:'red'}}});`,
    )
    .join('\n')}`
}
