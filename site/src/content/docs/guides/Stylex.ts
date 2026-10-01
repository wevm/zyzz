/** Styles the migration guide's nested headings and comparison tables. @module */
import { style } from '../../../zyzz.config.js'

export namespace stylexStyles {
  export const guide = style({
    selectors: {
      '& h3': {
        typography: 'heading.16',
        marginBottom: 3,
        marginTop: 6,
        scrollMarginTop: 24,
      },
      '& table': {
        borderCollapse: 'collapse',
        marginBlock: 6,
        tableLayout: 'fixed',
        width: '100% !custom',
      },
      '& th, & td': {
        borderBottom: '1px solid',
        borderColor: 'gray.300',
        padding: 3,
        textAlign: 'left',
        typography: 'copy.14',
        verticalAlign: 'top',
      },
      '& th': { color: 'foreground', fontWeight: 'medium' },
      '& td': { color: 'gray.900' },
      '& td code': { typography: 'label.13.mono' },
    },
  })
}
