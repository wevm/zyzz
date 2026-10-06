/** Chooses the light, dark, or system color scheme. @module */
import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import MonitorIcon from '~icons/lucide/monitor'
import MoonIcon from '~icons/lucide/moon'
import SunIcon from '~icons/lucide/sun'
import { style } from '../zyzz.config.js'

/** Renders the color schemes as a radio group. The parent applies the chosen scheme. */
export function ThemeToggle(props: ThemeToggle.Props) {
  const { onValueChange, value } = props

  return (
    <RadioGroup
      aria-label="Color scheme"
      onValueChange={onValueChange}
      value={value}
      {...styles.group()}
    >
      {schemes.map((scheme) => (
        <Radio.Root
          aria-label={scheme.label}
          key={scheme.value}
          title={`${scheme.label} color scheme`}
          value={scheme.value}
          {...styles.option()}
        >
          <scheme.icon aria-hidden="true" {...styles.icon()} />
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}

export declare namespace ThemeToggle {
  type Props = {
    /** Receives the scheme a viewer selects. */
    onValueChange: (value: Scheme) => void
    /** The selected scheme. */
    value: Scheme
  }

  /** A `color-scheme` value, where `light dark` follows the operating system preference. */
  type Scheme = 'light' | 'dark' | 'light dark'
}

// Display order, with the system preference last.
const schemes = [
  { icon: SunIcon, label: 'Light', value: 'light' },
  { icon: MoonIcon, label: 'Dark', value: 'dark' },
  { icon: MonitorIcon, label: 'System', value: 'light dark' },
] as const

namespace styles {
  export const group = style({
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '9999px !custom',
    display: 'flex',
    flexShrink: 0,
    padding: '2px !custom',
  })

  export const icon = style({ height: 4, width: 4 })

  export const option = style({
    alignItems: 'center',
    border: '1px solid transparent',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    height: 7,
    justifyContent: 'center',
    transition: 'background-color 150ms, color 150ms',
    width: 7,
    ':hover': { color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    '&[data-checked]': {
      backgroundColor: 'grayAlpha.200',
      borderColor: 'gray.400',
      color: 'foreground',
    },
  })
}
