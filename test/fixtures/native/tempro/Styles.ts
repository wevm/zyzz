/** Migrates geometry from Tempro's six dynamic styles using portable authoring. @module */
import { defineConfig } from 'zyzz'
import { dimension } from './Dimensions.js'

const { style, variants, vars } = defineConfig({ vars: dimension })

export const headerArtwork = style((input: { aspectRatio: number }) => ({
  height: `calc((${vars.dimension.section.xl} * 2 + ${vars.dimension.spacing['80']}) / ${input.aspectRatio})`,
  position: 'absolute',
  right: 0,
  top: 0,
  width: `calc(${vars.dimension.section.xl} * 2 + ${vars.dimension.spacing['80']})`,
}))

export const avatarContainer = variants({
  base: {
    alignItems: 'center',
    borderRadius: vars.dimension.cornerRadius.full,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  variants: {
    size: {
      large: { height: '68px', width: '68px' },
      small: {
        height: vars.dimension.spacing['40'],
        width: vars.dimension.spacing['40'],
      },
    },
  },
})

export const statusContent = variants({
  base: { alignItems: 'center', flexGrow: 1, justifyContent: 'flex-start' },
  variants: {
    variant: {
      default: { paddingTop: vars.dimension.spacing['16'] },
      send: {
        paddingTop: `calc(${vars.dimension.spacing['64']} + ${vars.dimension.spacing['24']} + ${vars.dimension.spacing['48']})`,
      },
    },
  },
})

export const statusCopy = variants({
  base: {
    alignItems: 'center',
    marginTop: vars.dimension.spacing['24'],
    paddingLeft: vars.dimension.spacing['48'],
    paddingRight: vars.dimension.spacing['48'],
  },
  variants: {
    variant: {
      default: { gap: vars.dimension.spacing['16'] },
      send: { gap: vars.dimension.spacing['8'] },
    },
  },
})

export const statusGraphic = variants({
  base: { alignItems: 'center', justifyContent: 'center' },
  variants: {
    variant: {
      default: { height: '160px' },
      send: { height: vars.dimension.spacing['64'] },
    },
  },
})

export const statusSymbol = variants({
  base: { position: 'relative', width: '128px' },
  variants: {
    variant: {
      default: { height: '120px' },
      send: { height: vars.dimension.spacing['64'] },
    },
  },
})
