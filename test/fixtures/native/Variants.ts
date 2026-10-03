/** Defines a themed Button recipe with 576 finite native selections. @module */
import { defineConfig } from 'zyzz'

const { style, variants } = defineConfig({
  defaultVars: 'base',
  vars: {
    alternate: {
      color: { background: { dark: '#ffff00', light: '#0000ff' } },
      spacing: { size: '160px' },
    },
    base: {
      color: { background: { dark: '#00ff00', light: '#ff0000' } },
      spacing: { size: '100px' },
    },
  },
})

export namespace styles {
  export const button = variants({
    base: {
      backgroundColor: 'background',
      fontSize: '10px !custom',
      height: '24px !custom',
      lineHeight: 1.5,
      opacity: 0.2,
      padding: '2px !custom',
      width: 'size',
      targets: { native: { transform: [{ scale: 1 }] } },
    },
    defaultVariants: {
      appearance: 'base',
      disabled: false,
      loading: false,
      scale: 'medium',
      variant: 'primary',
    },
    variants: {
      appearance: {
        base: {},
        inverse: { color: '#112233 !custom' },
        overlay: { color: '#334455 !custom' },
      },
      scale: {
        large: {
          fontSize: '20px !custom',
          height: '48px !custom',
          padding: '8px !custom',
          '@media (width >= 768px)': { height: '64px !custom' },
        },
        medium: {
          fontSize: '16px !custom',
          height: '40px !custom',
          padding: '6px !custom',
        },
        small: {
          fontSize: '12px !custom',
          height: '32px !custom',
          padding: '4px !custom',
        },
      },
      variant: {
        primary: {},
        secondary: { opacity: 0.8 },
        tertiary: { opacity: 0.6 },
      },
      disabled: { false: {}, true: { opacity: 0.4 } },
      loading: { false: {}, true: { opacity: 0.3 } },
    },
    compoundVariants: [
      {
        when: { appearance: ['inverse', 'overlay'], variant: 'primary' },
        style: {
          opacity: 0.7,
          paddingLeft: '9px !custom',
          targets: {
            android: { opacity: 0.65 },
            ios: { opacity: 0.75 },
            native: { transform: [{ rotate: '90deg' }] },
          },
        },
      },
      {
        when: { disabled: true, loading: true },
        style: {
          opacity: 0.1,
          targets: { native: { transform: [{ scale: 2 }] } },
        },
      },
    ],
  })

  export const overlay = style({ opacity: 0.9 })
}
