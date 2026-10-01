/** Styles the Compatibility page's authored support matrices. @module */
import type { ReactNode } from 'react'
import CheckIcon from '~icons/lucide/check'
import TargetIcon from '~icons/lucide/target'
import WarningIcon from '~icons/lucide/triangle-alert'
import FirefoxIcon from '~icons/simple-icons/firefoxbrowser'
import ChromeIcon from '~icons/simple-icons/googlechrome'
import HtmlIcon from '~icons/simple-icons/html5'
import EdgeIcon from '~icons/simple-icons/microsoftedge'
import NextIcon from '~icons/simple-icons/nextdotjs'
import ReactIcon from '~icons/simple-icons/react'
import SafariIcon from '~icons/simple-icons/safari'
import SolidIcon from '~icons/simple-icons/solid'
import SvelteIcon from '~icons/simple-icons/svelte'
import VueIcon from '~icons/simple-icons/vuedotjs'
import { style } from '../../zyzz.config.js'

const icons = {
  chrome: ChromeIcon,
  edge: EdgeIcon,
  firefox: FirefoxIcon,
  html: HtmlIcon,
  next: NextIcon,
  react: ReactIcon,
  safari: SafariIcon,
  solid: SolidIcon,
  svelte: SvelteIcon,
  target: TargetIcon,
  unverified: WarningIcon,
  verified: CheckIcon,
  vue: VueIcon,
}

/** Adds a decorative compatibility icon beside its text label. */
export function CompatibilityIcon(props: CompatibilityIcon.Props) {
  const Icon = icons[props.name]

  return (
    <span
      aria-hidden="true"
      data-unverified={props.name === 'unverified' || undefined}
      data-verified={props.name === 'verified' || undefined}
      {...styles.icon()}
    >
      <Icon height="16" width="16" />
    </span>
  )
}

export declare namespace CompatibilityIcon {
  /** Properties for a compatibility icon. */
  type Props = {
    /** Compatibility indicator to display. */
    name: keyof typeof icons
  }
}

/** Sizes inline code relative to the Compatibility page's surrounding text. */
export function CompatibilityContent(props: CompatibilityContent.Props) {
  return (
    <div data-compatibility-content {...styles.content()}>
      {props.children}
    </div>
  )
}

export declare namespace CompatibilityContent {
  /** Properties for the page content. */
  type Props = {
    /** Authored documentation content. */
    children: ReactNode
  }
}

/** Keeps support tables readable and keyboard-scrollable on narrow screens. */
export function CompatibilityMatrix(props: CompatibilityMatrix.Props) {
  return (
    <div
      aria-label={props.label}
      role="region"
      tabIndex={0}
      {...styles.matrix()}
    >
      {props.children}
    </div>
  )
}

export declare namespace CompatibilityMatrix {
  /** Properties for the page-specific matrix. */
  type Props = {
    /** Authored table content, also retained in the Markdown route. */
    children: ReactNode
    /** Accessible name for the scrollable table region. */
    label: string
  }
}

namespace styles {
  export const content = style({
    '&[data-compatibility-content] :is(p, aside, li) code': {
      fontSize: '0.9em !custom',
    },
  })

  export const icon = style({
    display: 'inline-flex',
    marginRight: 2,
    verticalAlign: 'text-bottom',
    '&[data-unverified]': { color: 'amber.900' },
    '&[data-verified]': { color: 'green.700' },
  })

  export const matrix = style({
    borderColor: 'gray.400',
    borderRadius: 'lg',
    borderStyle: 'solid !custom',
    borderWidth: '1px',
    marginBlock: 6,
    overflowX: 'auto',
    typography: 'copy.14',
    lineHeight: '22px !custom',
    '&:focus-visible': {
      outlineColor: 'blue.700',
      outlineOffset: '2px',
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
    '& table': {
      borderCollapse: 'collapse',
      tableLayout: 'fixed',
      width: '100% !custom',
    },
    '& thead th': { borderTopWidth: 0 },
    '& th, & td': {
      borderTopColor: 'gray.400',
      borderTopStyle: 'solid !custom',
      borderTopWidth: '1px',
      padding: 3,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '& th': { color: 'gray.900', fontWeight: 'normal' },
    '& th:first-child': { width: '32% !custom' },
    '& td': { color: 'gray.900' },
    '& table p': { margin: 0 },
    '@media (max-width: 600px)': {
      '& th:first-child': { width: '36% !custom' },
    },
  })
}
