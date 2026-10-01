/** Renders authored MDX within the shared documentation layout. @module */
import { AgentPrompt } from '../components/AgentPrompt.js'
import { DocumentationShell } from '../components/DocumentationShell.js'
import { Install } from '../components/Install.js'
import { Card } from '../components/mdx/Card.js'
import { FrameworkSetup } from '../components/mdx/FrameworkSetup.js'
import { Steps } from '../components/mdx/Steps.js'
import { SearchField } from '../components/SearchField.js'
import * as Docs from '../Docs.js'
import { style, vars } from '../zyzz.config.js'
import { isValidElement, type ReactNode, useEffect, useState } from 'react'
import ArrowLeftRightIcon from '~icons/lucide/arrow-left-right'
import BookOpenIcon from '~icons/lucide/book-open'
import BoxIcon from '~icons/lucide/box'
import BrainIcon from '~icons/lucide/brain'
import CheckIcon from '~icons/lucide/check'
import CircleHelpIcon from '~icons/lucide/circle-help'
import CodeXmlIcon from '~icons/lucide/code-xml'
import CopyIcon from '~icons/lucide/copy'
import FileIcon from '~icons/lucide/file'
import GaugeIcon from '~icons/lucide/gauge'
import LayersIcon from '~icons/lucide/layers'
import LightbulbIcon from '~icons/lucide/lightbulb'
import MonitorIcon from '~icons/lucide/monitor'
import PackageIcon from '~icons/lucide/package'
import PaintbrushIcon from '~icons/lucide/paintbrush'
import PaletteIcon from '~icons/lucide/palette'
import PlayIcon from '~icons/lucide/play'
import PlugIcon from '~icons/lucide/plug'
import RocketIcon from '~icons/lucide/rocket'
import ShieldCheckIcon from '~icons/lucide/shield-check'
import SmartphoneIcon from '~icons/lucide/smartphone'
import SparklesIcon from '~icons/lucide/sparkles'
import TerminalIcon from '~icons/lucide/terminal'
import TestTubeIcon from '~icons/lucide/test-tube'
import WorkflowIcon from '~icons/lucide/workflow'
import WrenchIcon from '~icons/lucide/wrench'
import BabelIcon from '~icons/simple-icons/babel'
import HtmlIcon from '~icons/simple-icons/html5'
import NextIcon from '~icons/simple-icons/nextdotjs'
import NodeIcon from '~icons/simple-icons/nodedotjs'
import NpmIcon from '~icons/simple-icons/npm'
import ReactIcon from '~icons/simple-icons/react'
import TypeScriptIcon from '~icons/simple-icons/typescript'
import ViteIcon from '~icons/simple-icons/vite'

const sidebarIcons: Record<string, typeof BookOpenIcon> = {
  'api/babel': BabelIcon,
  'api/cli': TerminalIcon,
  'api/compiler': WrenchIcon,
  'api/core': BoxIcon,
  'api/metro': SmartphoneIcon,
  'api/next': NextIcon,
  'api/node': NodeIcon,
  'api/oxlint': ShieldCheckIcon,
  'api/react-native': ReactIcon,
  'api/runtime': PlayIcon,
  'api/unplugin': PlugIcon,
  'api/vite': ViteIcon,
  'api/web': MonitorIcon,
  concepts: BookOpenIcon,
  'guides/compilation': PackageIcon,
  'guides/conditions': WorkflowIcon,
  'guides/css-output': CodeXmlIcon,
  'guides/native': ReactIcon,
  'guides/stylesheets': FileIcon,
  'guides/stylex': ArrowLeftRightIcon,
  'guides/styling': PaintbrushIcon,
  'guides/tailwind': ArrowLeftRightIcon,
  'guides/testing': TestTubeIcon,
  'guides/themes': PaletteIcon,
  'guides/variants': LayersIcon,
  Integrations: PlugIcon,
  'introduction/benchmarks': GaugeIcon,
  'introduction/comparisons': ArrowLeftRightIcon,
  'introduction/compatibility': ShieldCheckIcon,
  'introduction/editor-agents': SparklesIcon,
  'introduction/faq': CircleHelpIcon,
  'introduction/getting-started': RocketIcon,
  'introduction/thinking-in-zyzz': BrainIcon,
  'introduction/why-zyzz': LightbulbIcon,
}

/** Displays a documentation page and grouped navigation. */
export function Page(props: Page.Props) {
  const { path } = props

  const Content = Docs.pages[`./content/docs/${path}.mdx`]!
  const page = __DOCS__.pages[path]!
  return (
    <DocumentationShell
      mobileMenu
      search={
        <SearchField
          aria-label="Search docs"
          disabled
          placeholder="Search docs..."
        />
      }
      navigation={
        <a href="/vars" {...styles.variables()}>
          Variables
        </a>
      }
      sidebar={
        <nav aria-label="Documentation">
          {Docs.groups.map((group) => (
            <div key={group.title} {...styles.group()}>
              <h2 {...styles.groupHeading()}>{group.title}</h2>
              {group.pages.map((item) => (
                <SidebarItem item={item} key={item.title} path={path} />
              ))}
            </div>
          ))}
        </nav>
      }
    >
      <article {...styles.article()}>
        <header {...styles.heading()}>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </header>
        <Content
          components={{
            AgentPrompt,
            Card,
            FrameworkSetup,
            Install,
            Steps,
            pre: Code,
          }}
        />
      </article>
    </DocumentationShell>
  )
}

export declare namespace Page {
  /** Properties for the Page component. */
  type Props = { path: string }
}

function SidebarItem(props: SidebarItem.Props) {
  const { item, path } = props
  const enabled =
    item.path !== undefined && Object.hasOwn(__DOCS__.pages, item.path)
  const Icon = sidebarIcons[item.path ?? item.title] ?? BookOpenIcon
  const content = (
    <>
      <Icon aria-hidden="true" height="16" width="16" />
      {item.title}
    </>
  )

  return (
    <>
      {enabled ? (
        <a
          aria-current={item.path === path ? 'page' : undefined}
          href={`/docs/${item.path}`}
          {...styles.link()}
        >
          {content}
        </a>
      ) : (
        <span aria-disabled="true" role="link" {...styles.link()}>
          {content}
          <span
            aria-hidden="true"
            title="Under construction"
            {...styles.construction()}
          >
            🚧
          </span>
        </span>
      )}
      {item.children && (
        <div {...styles.nestedLinks()}>
          {item.children.map((child) => (
            <SidebarItem item={child} key={child.title} path={path} />
          ))}
        </div>
      )}
    </>
  )
}

declare namespace SidebarItem {
  type Props = { item: Docs.Item; path: string }
}

function Code(input: Code.Props) {
  const { children } = input
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )

  useEffect(() => {
    if (copyState !== 'copied') return
    const timer = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copyState])

  if (
    !isValidElement<{ children?: string; 'data-filename'?: string }>(children)
  )
    return <pre {...styles.code()}>{children}</pre>
  const filename = children.props['data-filename']
  const Icon = (() => {
    if (filename?.startsWith('vite.config.')) return ViteIcon
    if (filename?.startsWith('next.config.')) return NextIcon
    if (filename === 'package.json') return NpmIcon
    if (filename?.endsWith('.tsx') || filename?.endsWith('.jsx'))
      return ReactIcon
    if (filename?.endsWith('.ts')) return TypeScriptIcon
    if (filename?.endsWith('.html')) return HtmlIcon
    return FileIcon
  })()

  const source = children.props.children?.replace(/\n$/, '') ?? ''
  const lines = Object.hasOwn(__DOCS__.code, source)
    ? __DOCS__.code[source]
    : undefined
  const copyButton = (
    <button
      aria-label={
        copyState === 'copied'
          ? `Copied ${filename ?? 'code'}`
          : `Copy ${filename ?? 'code'}`
      }
      title={copyState === 'failed' ? 'Copy failed. Try again.' : 'Copy code'}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(source)
          setCopyState('copied')
        } catch {
          setCopyState('failed')
        }
      }}
      type="button"
      {...styles.copy()}
    >
      {copyState === 'copied' ? (
        <CheckIcon
          aria-hidden="true"
          width="16"
          height="16"
          {...styles.copySuccess()}
        />
      ) : (
        <CopyIcon aria-hidden="true" width="16" height="16" />
      )}
    </button>
  )

  return (
    <div {...styles.codeBlock()}>
      {filename && (
        <div {...styles.codeHeader()}>
          <Icon aria-hidden="true" height="14" width="14" />
          {filename}
          {copyButton}
        </div>
      )}
      {!filename && copyButton}
      {copyState === 'failed' && (
        <p role="alert" {...styles.copyFailure()}>
          Could not copy code. Select and copy it manually.
        </p>
      )}
      <pre {...styles.code()}>
        <code>
          {lines
            ? lines.map((line, index) => (
                <span key={index}>
                  {line.map((token, index) => (
                    <span key={index} style={{ color: token.color }}>
                      {token.content}
                    </span>
                  ))}
                  {'\n'}
                </span>
              ))
            : source}
        </code>
      </pre>
    </div>
  )
}

declare namespace Code {
  /** Properties for the Code component. */
  type Props = { children?: ReactNode }
}

namespace styles {
  export const article = style({
    typography: 'copy.16',
    padding: 12,
    overflowWrap: 'anywhere',
    '@media (max-width: 1023px)': {
      paddingBlock: 3,
      paddingInline: 4,
      '& h2': { marginTop: 6 },
      '& > header + h2': { marginTop: 0 },
    },
    '& p, & aside': { color: 'gray.900', marginBlock: 4, maxWidth: '3xl' },
    '& h2': {
      typography: 'heading.24',
      marginTop: 10,
      marginBottom: 4,
      scrollMarginTop: 24,
    },
    '& a:not([data-card])': {
      color: 'foreground',
      textDecoration: 'underline',
    },
    '& ul, & ol:not([data-steps])': {
      color: 'gray.900',
      marginBlock: 4,
      maxWidth: '3xl',
      paddingLeft: 6,
    },
    '& strong, & b': { fontWeight: 'medium' },
    '& ul': { listStyleType: 'disc' },
    '& ol:not([data-steps])': { listStyleType: 'decimal' },
    '& li:not([data-step])': { marginBlock: 2 },
    '& p code, & aside code, & li > code': {
      typography: 'label.14.mono',
      fontSize: '15px !custom',
      color: 'foreground',
      backgroundColor: 'gray.100',
      borderRadius: 'sm',
      paddingInline: 1,
    },
  })

  export const code = style({
    typography: 'copy.13.mono',
    fontSize: '15px !custom',
    lineHeight: '24px !custom',
    backgroundColor: 'background.primary',
    margin: 0,
    overflowX: 'auto',
    padding: 6,
    paddingRight: 12,
    '& code': {
      font: 'inherit',
      display: 'block',
      minWidth: 'max-content !custom',
    },
  })

  export const codeBlock = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginBlock: 6,
    overflow: 'hidden',
    position: 'relative',
  })

  export const codeHeader = style({
    typography: 'label.14',
    alignItems: 'center',
    backgroundColor: 'light-dark(#f5f5f5, #111) !custom',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    color: 'gray.900',
    display: 'flex',
    gap: 2,
    paddingBlock: 3,
    paddingInline: 6,
    paddingRight: 12,
  })

  export const construction = style({
    flexShrink: 0,
    marginLeft: 'auto !custom',
  })

  export const copy = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: 'none',
    borderRadius: 'sm',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    height: 7,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 2,
    width: 7,
    ':hover': { backgroundColor: 'gray.200', color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const copyFailure = style({
    typography: 'copy.14',
    paddingInline: 6,
  })

  export const copySuccess = style({ color: '#3be0af !custom' })

  export const group = style({ marginBottom: 8 })

  export const groupHeading = style({
    typography: 'label.14',
    fontWeight: 'semibold',
    marginBottom: 3,
    paddingInline: 3,
  })

  export const heading = style({
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    marginTop: `calc(${vars.spacing[12]} * -1) !custom`,
    marginInline: `calc(${vars.spacing[12]} * -1) !custom`,
    marginBottom: 8,
    paddingBlock: 8,
    paddingInline: 12,
    '& h1': { typography: 'heading.32' },
    '& p': {
      typography: 'copy.16',
      fontSize: '18px !custom',
      lineHeight: '28px !custom',
      marginTop: 2,
      marginBottom: 0,
    },
    '@media (max-width: 1023px)': {
      marginTop: `calc(${vars.spacing[3]} * -1) !custom`,
      marginInline: `calc(${vars.spacing[4]} * -1) !custom`,
      marginBottom: 4,
      paddingBlock: 4,
      paddingInline: 4,
      '& p': { fontSize: '16px !custom', lineHeight: '24px !custom' },
    },
  })

  export const link = style({
    typography: 'label.14',
    alignItems: 'center',
    borderRadius: 'md',
    color: 'gray.900',
    display: 'flex',
    gap: 3,
    paddingBlock: 2,
    paddingInline: 3,
    textDecoration: 'none',
    ':hover:not([aria-disabled])': {
      backgroundColor: 'gray.100',
      color: 'foreground',
    },
    '&[aria-disabled]': { color: 'gray.700', cursor: 'default' },
    '&[aria-current="page"]': {
      backgroundColor: 'gray.200',
      color: 'foreground',
    },
  })

  export const nestedLinks = style({ paddingLeft: 6 })

  export const variables = style({
    typography: 'label.14',
    fontWeight: 'medium',
    color: 'gray.900',
    display: 'block',
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })
}
