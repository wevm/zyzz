/** Shared button and link treatments for site actions. @module */
import type { ComponentProps } from 'react'
import type { Props } from 'zyzz'
import { variants } from '../zyzz.config.js'
import { Link } from './Link.js'

/** Renders an action as a native button or a link when `href` is supplied. */
export function Button(input: Button.Props) {
  const { variant, size, className, style, ...props } = input

  const appearance = buttonStyles.button({ variant, size, className, style })
  if (typeof props.href === 'string') return <Link {...props} {...appearance} />
  return <button type="button" {...props} {...appearance} />
}

export declare namespace Button {
  type Props = Props.Variants<typeof buttonStyles.button> &
    (
      | (ComponentProps<'button'> & { href?: never })
      | (ComponentProps<'a'> & { href: string })
    )
}

namespace buttonStyles {
  export const button = variants({
    base: {
      typography: 'button.16',
      alignItems: 'center',
      border: '1px solid transparent',
      borderRadius: 'lg',
      cursor: 'pointer',
      display: 'inline-flex',
      gap: 3,
      justifyContent: 'center',
      textDecoration: 'none',
      transition:
        'background-color 150ms ease-in-out, border-color 150ms ease-in-out, color 150ms ease-in-out, box-shadow 150ms ease-in-out',
      userSelect: 'none',
      ':focus-visible': {
        outline: '2px solid',
        outlineColor: 'blue.900',
        outlineOffset: '2px',
        transition: 'none',
      },
      ':disabled': {
        backgroundColor: 'gray.100',
        borderColor: 'gray.400',
        color: 'gray.700',
        cursor: 'not-allowed',
      },
      '& svg': { flexShrink: 0 },
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    },
    variants: {
      variant: {
        primary: {
          backgroundColor: 'foreground',
          color: 'background.primary',
          ':hover:not(:disabled)': {
            backgroundColor: 'light-dark(hsl(0 0% 22%), hsl(0 0% 80%)) !custom',
          },
        },
        secondary: {
          backgroundColor: 'background.primary',
          borderColor: 'gray.400',
          color: 'foreground',
          ':hover:not(:disabled)': {
            backgroundColor: 'gray.100',
            '@media (prefers-color-scheme: dark)': {
              backgroundColor: 'gray.200',
            },
          },
        },
        ghost: {
          backgroundColor: 'transparent !custom',
          color: 'foreground',
          ':hover:not(:disabled)': { backgroundColor: 'grayAlpha.200' },
        },
      },
      size: {
        default: { paddingBlock: 4, paddingInline: 6 },
        icon: { borderRadius: 'md', height: 8, width: 8 },
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  })
}
