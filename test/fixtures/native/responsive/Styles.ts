/** Provides shared responsive layouts for source and packed native consumers. @module */
import { defineConfig } from 'zyzz'

export const { style, variants, vars } = defineConfig({
  vars: {
    breakpoint: { md: '768px' },
    spacing: { gutter: { default: '16px', '@media md': '24px' } },
  },
})

export const panel = style({
  padding: 'gutter',
  flexDirection: 'column',
  '@media md': { flexDirection: 'row' },
  '@media (height < 600px)': { display: 'none' },
})

export const card = variants({
  base: { opacity: 0.5, paddingTop: 'gutter' },
  variants: {
    expanded: {
      false: { paddingBottom: '4px !custom' },
      true: {
        paddingBottom: '8px !custom',
        '@media md': { paddingBottom: '12px !custom' },
      },
    },
  },
  defaultVariants: { expanded: false },
})

export const meter = style((values: { ratio: number }) => ({
  width: `calc(${vars.spacing.gutter} * ${values.ratio}) !custom`,
  '@media md': { height: '12px !custom' },
}))
