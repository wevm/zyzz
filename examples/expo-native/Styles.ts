/** Defines themed styles for the native example. @module */
import { style, variants } from './Theme.js'

/** Styles compiled independently for each native platform. */
export namespace styles {
  export const box = style({
    backgroundColor: 'accent',
    height: '64px',
    width: '96px',
    targets: { android: { borderRadius: 4 }, ios: { borderRadius: 16 } },
  })

  export const card = variants({
    base: { backgroundColor: 'surface', borderRadius: '8px', padding: '8px' },
    variants: {
      spacious: { false: { padding: '8px' }, true: { padding: '20px' } },
    },
    defaultVariants: { spacious: false },
  })

  export const description = style({ color: 'muted' })

  export const foreground = style({ color: 'ink' })

  export const meter = style((values: { width: `${number}px` }) => ({
    backgroundColor: 'accent',
    height: '16px',
    width: values.width,
  }))

  export const page = style({ backgroundColor: 'page' })
}
