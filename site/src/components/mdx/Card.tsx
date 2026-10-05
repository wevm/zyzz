/** Provides linked next-step cards and responsive card groups for MDX. @module */
import type { ReactNode } from 'react'
import ALargeSmallIcon from '~icons/lucide/a-large-small'
import AnchorIcon from '~icons/lucide/anchor'
import ArrowLeftRightIcon from '~icons/lucide/arrow-left-right'
import AtSignIcon from '~icons/lucide/at-sign'
import BoxesIcon from '~icons/lucide/boxes'
import BracesIcon from '~icons/lucide/braces'
import CodeIcon from '~icons/lucide/code'
import CodeXmlIcon from '~icons/lucide/code-xml'
import CombineIcon from '~icons/lucide/combine'
import CopyPlusIcon from '~icons/lucide/copy-plus'
import FileCodeIcon from '~icons/lucide/file-code'
import FileInputIcon from '~icons/lucide/file-input'
import FileSearchIcon from '~icons/lucide/file-search'
import FileTypeIcon from '~icons/lucide/file-type'
import FilmIcon from '~icons/lucide/film'
import GitBranchIcon from '~icons/lucide/git-branch'
import GlobeIcon from '~icons/lucide/globe'
import LayersIcon from '~icons/lucide/layers'
import ListIcon from '~icons/lucide/list'
import ListOrderedIcon from '~icons/lucide/list-ordered'
import MonitorSmartphoneIcon from '~icons/lucide/monitor-smartphone'
import NetworkIcon from '~icons/lucide/network'
import PackageIcon from '~icons/lucide/package'
import PaintbrushIcon from '~icons/lucide/paintbrush'
import PaintBucketIcon from '~icons/lucide/paint-bucket'
import PaletteIcon from '~icons/lucide/palette'
import PanelsIcon from '~icons/lucide/panels-top-left'
import PipetteIcon from '~icons/lucide/pipette'
import PrinterIcon from '~icons/lucide/printer'
import ScrollTextIcon from '~icons/lucide/scroll-text'
import Settings2Icon from '~icons/lucide/settings-2'
import SettingsIcon from '~icons/lucide/settings'
import SlidersIcon from '~icons/lucide/sliders-horizontal'
import SmartphoneIcon from '~icons/lucide/smartphone'
import SquareFunctionIcon from '~icons/lucide/square-function'
import SunMoonIcon from '~icons/lucide/sun-moon'
import SwatchBookIcon from '~icons/lucide/swatch-book'
import TableIcon from '~icons/lucide/table'
import TagIcon from '~icons/lucide/tag'
import TerminalIcon from '~icons/lucide/terminal'
import TypeIcon from '~icons/lucide/type'
import VariableIcon from '~icons/lucide/variable'
import WandSparklesIcon from '~icons/lucide/wand-sparkles'
import WorkflowIcon from '~icons/lucide/workflow'
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
  'a-large-small': ALargeSmallIcon,
  anchor: AnchorIcon,
  'arrow-left-right': ArrowLeftRightIcon,
  'at-sign': AtSignIcon,
  boxes: BoxesIcon,
  braces: BracesIcon,
  code: CodeIcon,
  'code-xml': CodeXmlIcon,
  combine: CombineIcon,
  'copy-plus': CopyPlusIcon,
  'file-code': FileCodeIcon,
  'file-input': FileInputIcon,
  'file-search': FileSearchIcon,
  'file-type': FileTypeIcon,
  film: FilmIcon,
  'git-branch': GitBranchIcon,
  globe: GlobeIcon,
  layers: LayersIcon,
  list: ListIcon,
  'list-ordered': ListOrderedIcon,
  'monitor-smartphone': MonitorSmartphoneIcon,
  network: NetworkIcon,
  next: NextIcon,
  package: PackageIcon,
  'paint-bucket': PaintBucketIcon,
  paintbrush: PaintbrushIcon,
  palette: PaletteIcon,
  panels: PanelsIcon,
  pipette: PipetteIcon,
  printer: PrinterIcon,
  react: ReactIcon,
  rollup: RollupIcon,
  'scroll-text': ScrollTextIcon,
  settings: SettingsIcon,
  'settings-2': Settings2Icon,
  sliders: SlidersIcon,
  smartphone: SmartphoneIcon,
  'square-function': SquareFunctionIcon,
  'sun-moon': SunMoonIcon,
  'swatch-book': SwatchBookIcon,
  table: TableIcon,
  tag: TagIcon,
  terminal: TerminalIcon,
  type: TypeIcon,
  variable: VariableIcon,
  vite: ViteIcon,
  'wand-sparkles': WandSparklesIcon,
  workflow: WorkflowIcon,
  zap: ZapIcon,
}
