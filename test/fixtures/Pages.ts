/** Page selector and descriptor grammar productions. @module */
export const descriptors = [
  { bleed: 'auto', marks: 'none', pageOrientation: 'upright', size: 'auto' },
  {
    bleed: '1em',
    marks: 'crop',
    pageOrientation: 'rotate-left',
    size: 'A4 landscape',
  },
  {
    bleed: 'calc(1em + 2px)',
    marks: 'cross',
    pageOrientation: 'rotate-right',
    size: 'calc(10cm + 2mm) 20cm',
  },
  {
    bleed: '-1px',
    marks: 'cross crop',
    pageOrientation: 'upright',
    size: 'portrait letter',
  },
  { bleed: 0, marks: 'crop cross', pageOrientation: 'upright', size: '10cm' },
] as const

/** Builds page descriptors and margin content through an alias. */
export function source(after = false): string {
  return (
    `import {page as sheet} from 'zyzz/web';\n` +
    descriptors
      .map(
        (value, i) =>
          `sheet({'@layer print':{'@media print':${JSON.stringify({ selector: ['book:first', ':left', ':right', ':blank', 'book:left, appendix:right'][i], descriptors: { ...value, ...(after ? { bleed: '3px', marks: 'none', pageOrientation: 'rotate-right', size: 'B5' } : {}), color: after ? 'blue' : 'red', '@top-center': { content: after ? '"After"' : '"Before"' } } })}}});`,
      )
      .join('\n')
  )
}
