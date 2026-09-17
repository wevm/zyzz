/** Defines shared authoring inputs for native comparisons. @module */
import { style, variants } from 'zyzz'

/** Styles compiled independently for each native platform. */
export namespace styles {
  export const box = style({
    backgroundColor: '#2563eb',
    height: '64px',
    width: '96px',
    targets: { android: { borderRadius: 4 }, ios: { borderRadius: 16 } },
  })

  export const card = variants({
    base: { backgroundColor: '#dbeafe', borderRadius: '8px', padding: '8px' },
    variants: {
      spacious: { false: { padding: '8px' }, true: { padding: '20px' } },
    },
    defaultVariants: { spacious: false },
  })

  export const meter = style((values: { width: `${number}px` }) => ({
    backgroundColor: '#2563eb',
    height: '16px',
    width: values.width,
  }))
}
