/** Renders MDX blockquotes, labeling GitHub alert syntax such as `> [!NOTE]`. @module */
import type { ReactNode } from 'react'
import InfoIcon from '~icons/lucide/info'
import LightbulbIcon from '~icons/lucide/lightbulb'
import MessageSquareWarningIcon from '~icons/lucide/message-square-warning'
import OctagonAlertIcon from '~icons/lucide/octagon-alert'
import TriangleAlertIcon from '~icons/lucide/triangle-alert'
import { style, variants } from '../../zyzz.config.js'

const tones = {
  caution: { Icon: OctagonAlertIcon, label: 'Caution' },
  important: { Icon: MessageSquareWarningIcon, label: 'Important' },
  note: { Icon: InfoIcon, label: 'Note' },
  tip: { Icon: LightbulbIcon, label: 'Tip' },
  warning: { Icon: TriangleAlertIcon, label: 'Warning' },
} as const

/** Renders a labeled callout for a marked blockquote, or a plain blockquote otherwise. */
export function Callout(props: Callout.Props) {
  const { children } = props
  const tone = props['data-callout']

  if (!tone || !Object.hasOwn(tones, tone))
    return <blockquote>{children}</blockquote>
  const { Icon, label } = tones[tone]
  return (
    <aside aria-label={label} data-callout="" {...styles.callout({ tone })}>
      <Icon aria-hidden="true" height="14" width="14" {...styles.icon()} />
      <div {...styles.content()}>{children}</div>
    </aside>
  )
}

export declare namespace Callout {
  /** Properties for the Callout component. */
  type Props = {
    children?: ReactNode
    /** Alert type parsed from a leading marker such as `[!NOTE]`. */
    'data-callout'?: keyof typeof tones | undefined
  }
}

namespace styles {
  export const callout = variants({
    base: {
      typography: 'copy.14',
      alignItems: 'flex-start',
      border: '1px solid',
      borderRadius: 'md',
      display: 'flex',
      gap: 3,
      paddingBlock: 4,
      paddingInline: 5,
      '&[data-callout] p': {
        typography: 'copy.14',
        color: 'inherit !custom',
        margin: 0,
      },
      '&[data-callout] :not(pre) > code': { fontSize: '0.9em !custom' },
      '&[data-callout] > div > * + *': { marginTop: 3 },
      '&[data-callout] > div > :last-child': { marginBottom: 0 },
      '&[data-callout] pre': {
        fontSize: '13px !custom',
        lineHeight: '20px !custom',
        paddingBlock: 3,
        paddingLeft: 4,
      },
    },
    // The attribute outranks the article's aside color, so text and icon follow the tone.
    variants: {
      tone: {
        caution: {
          backgroundColor: 'red.100',
          borderColor: 'red.400',
          '&[data-callout]': { color: 'red.900' },
          '&[data-callout] :not(pre) > code': {
            backgroundColor: 'red.300',
            color: 'red.900',
          },
        },
        important: {
          backgroundColor: 'purple.100',
          borderColor: 'purple.400',
          '&[data-callout]': { color: 'purple.900' },
          '&[data-callout] :not(pre) > code': {
            backgroundColor: 'purple.300',
            color: 'purple.900',
          },
        },
        note: {
          backgroundColor: 'blue.100',
          borderColor: 'blue.400',
          '&[data-callout]': { color: 'blue.900' },
          '&[data-callout] :not(pre) > code': {
            backgroundColor: 'blue.300',
            color: 'blue.900',
          },
        },
        tip: {
          backgroundColor: 'green.100',
          borderColor: 'green.400',
          '&[data-callout]': { color: 'green.900' },
          '&[data-callout] :not(pre) > code': {
            backgroundColor: 'green.300',
            color: 'green.900',
          },
        },
        warning: {
          backgroundColor: 'amber.100',
          borderColor: 'amber.400',
          '&[data-callout]': { color: 'amber.900' },
          '&[data-callout] :not(pre) > code': {
            backgroundColor: 'amber.300',
            color: 'amber.900',
          },
        },
      },
    },
  })

  export const content = style({ flex: 1, minWidth: 0 })

  export const icon = style({ flexShrink: 0, marginTop: '3px !custom' })
}
