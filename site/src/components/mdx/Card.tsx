/** Provides linked next-step cards and responsive card groups for MDX. @module */
import type { ReactNode } from 'react'
import BoxesIcon from '~icons/lucide/boxes'
import BracesIcon from '~icons/lucide/braces'
import CodeIcon from '~icons/lucide/code'
import CombineIcon from '~icons/lucide/combine'
import CopyPlusIcon from '~icons/lucide/copy-plus'
import FileCodeIcon from '~icons/lucide/file-code'
import FileSearchIcon from '~icons/lucide/file-search'
import FileTypeIcon from '~icons/lucide/file-type'
import LayersIcon from '~icons/lucide/layers'
import ListIcon from '~icons/lucide/list'
import NetworkIcon from '~icons/lucide/network'
import PaintbrushIcon from '~icons/lucide/paintbrush'
import PaletteIcon from '~icons/lucide/palette'
import PanelsIcon from '~icons/lucide/panels-top-left'
import Settings2Icon from '~icons/lucide/settings-2'
import SettingsIcon from '~icons/lucide/settings'
import SlidersIcon from '~icons/lucide/sliders-horizontal'
import SmartphoneIcon from '~icons/lucide/smartphone'
import SunMoonIcon from '~icons/lucide/sun-moon'
import SwatchBookIcon from '~icons/lucide/swatch-book'
import TagIcon from '~icons/lucide/tag'
import TerminalIcon from '~icons/lucide/terminal'
import TypeIcon from '~icons/lucide/type'
import VariableIcon from '~icons/lucide/variable'
import WandSparklesIcon from '~icons/lucide/wand-sparkles'
import ZapIcon from '~icons/lucide/zap'
import NextIcon from '~icons/simple-icons/nextdotjs'
import ReactIcon from '~icons/simple-icons/react'
import RollupIcon from '~icons/simple-icons/rollupdotjs'
import ViteIcon from '~icons/simple-icons/vite'
import { style } from '../../zyzz.config.js'
import { Link } from '../Link.js'

/** Links to a related guide with a title and description. */
export function Card(props: Card.Props) {
  const { children, disabled, href, icon, onClick, selected, title } = props

  const Icon = icon && icons[icon]
  const Element = onClick ? 'button' : Link
  return (
    <Element
      data-card=""
      disabled={onClick ? disabled : undefined}
      href={href}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={selected}
      aria-controls={onClick ? 'framework-setup' : undefined}
      {...styles.card()}
    >
      {Icon && (
        <span {...styles.icon()}>
          <Icon
            aria-hidden="true"
            width={icon === 'vite' ? 12 : 18}
            height="18"
            preserveAspectRatio={icon === 'vite' ? 'none' : undefined}
          />
        </span>
      )}
      <span {...styles.title()}>{title}</span>
      <div {...styles.description()}>{children}</div>
    </Element>
  )
}

export declare namespace Card {
  /** Properties for the Card component. */
  type Props = {
    children: ReactNode
    disabled?: boolean | undefined
    href?: string
    icon?: keyof typeof icons
    onClick?: (() => void) | undefined
    selected?: boolean | undefined
    title: string
  }
}

/** Responsive layout for related documentation cards. */
export namespace Card {
  /** Arranges cards in two columns, or one on narrow screens. */
  export function Group(props: Group.Props) {
    const { children } = props

    return <div {...styles.group()}>{children}</div>
  }

  export declare namespace Group {
    /** Properties for the Group component. */
    type Props = { children: ReactNode }
  }
}

namespace styles {
  export const card = style({
    backgroundColor: 'light-dark(#f5f5f5, #111) !custom',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    padding: 5,
    textDecoration: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    '&[data-card] p': { margin: 0 },
    '&[aria-pressed="true"]': {
      backgroundColor: 'gray.200',
      borderColor: 'gray.600',
    },
    ':hover:not(:disabled)': {
      backgroundColor: 'gray.200',
      borderColor: 'gray.600',
    },
    ':disabled': { cursor: 'not-allowed', opacity: 0.5 },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const description = style({
    typography: 'copy.14',
    color: 'gray.900',
    height: '2lh !custom',
    overflow: 'hidden',
  })

  export const group = style({
    display: 'grid',
    gap: 4,
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    marginBlock: 6,
    '@media (max-width: 700px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  })

  export const icon = style({
    borderRadius: 'md',
    alignItems: 'center',
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    color: 'foreground',
    display: 'flex',
    height: 9,
    justifyContent: 'center',
    width: 9,
  })

  export const title = style({
    typography: 'label.16',
    alignItems: 'center',
    color: 'foreground',
    display: 'flex',
    fontWeight: 'medium',
    justifyContent: 'space-between',
  })
}

const icons = {
  boxes: BoxesIcon,
  braces: BracesIcon,
  code: CodeIcon,
  combine: CombineIcon,
  'copy-plus': CopyPlusIcon,
  'file-code': FileCodeIcon,
  'file-search': FileSearchIcon,
  'file-type': FileTypeIcon,
  layers: LayersIcon,
  list: ListIcon,
  network: NetworkIcon,
  next: NextIcon,
  paintbrush: PaintbrushIcon,
  palette: PaletteIcon,
  panels: PanelsIcon,
  react: ReactIcon,
  rollup: RollupIcon,
  settings: SettingsIcon,
  'settings-2': Settings2Icon,
  sliders: SlidersIcon,
  smartphone: SmartphoneIcon,
  'sun-moon': SunMoonIcon,
  'swatch-book': SwatchBookIcon,
  tag: TagIcon,
  terminal: TerminalIcon,
  type: TypeIcon,
  variable: VariableIcon,
  vite: ViteIcon,
  'wand-sparkles': WandSparklesIcon,
  zap: ZapIcon,
}
