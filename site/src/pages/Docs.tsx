/** Renders authored MDX within the shared documentation layout. @module */
import { AgentPrompt } from '../components/AgentPrompt.js'
import { DocumentationShell } from '../components/DocumentationShell.js'
import { Install } from '../components/Install.js'
import { Link } from '../components/Link.js'
import { Callout } from '../components/mdx/Callout.js'
import { Card } from '../components/mdx/Card.js'
import { FrameworkSetup } from '../components/mdx/FrameworkSetup.js'
import { Steps } from '../components/mdx/Steps.js'
import { SearchField } from '../components/SearchField.js'
import * as Docs from '../Docs.js'
import * as Manifest from '../Manifest.js'
import { style, variants, vars } from '../zyzz.config.js'
import {
  isValidElement,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useId,
  useState,
} from 'react'
import ALargeSmallIcon from '~icons/lucide/a-large-small'
import AnchorIcon from '~icons/lucide/anchor'
import ArrowLeftRightIcon from '~icons/lucide/arrow-left-right'
import AtSignIcon from '~icons/lucide/at-sign'
import BookOpenIcon from '~icons/lucide/book-open'
import BoxIcon from '~icons/lucide/box'
import BracesIcon from '~icons/lucide/braces'
import BrainIcon from '~icons/lucide/brain'
import CheckIcon from '~icons/lucide/check'
import ChevronRightIcon from '~icons/lucide/chevron-right'
import CircleHelpIcon from '~icons/lucide/circle-help'
import CodeXmlIcon from '~icons/lucide/code-xml'
import CombineIcon from '~icons/lucide/combine'
import CopyIcon from '~icons/lucide/copy'
import CopyPlusIcon from '~icons/lucide/copy-plus'
import FileCodeIcon from '~icons/lucide/file-code'
import FileIcon from '~icons/lucide/file'
import FileInputIcon from '~icons/lucide/file-input'
import FileTypeIcon from '~icons/lucide/file-type'
import FilmIcon from '~icons/lucide/film'
import GaugeIcon from '~icons/lucide/gauge'
import GlobeIcon from '~icons/lucide/globe'
import LayersIcon from '~icons/lucide/layers'
import LightbulbIcon from '~icons/lucide/lightbulb'
import ListIcon from '~icons/lucide/list'
import ListOrderedIcon from '~icons/lucide/list-ordered'
import MonitorIcon from '~icons/lucide/monitor'
import MonitorSmartphoneIcon from '~icons/lucide/monitor-smartphone'
import PackageIcon from '~icons/lucide/package'
import PaintbrushIcon from '~icons/lucide/paintbrush'
import PaintBucketIcon from '~icons/lucide/paint-bucket'
import PaletteIcon from '~icons/lucide/palette'
import PipetteIcon from '~icons/lucide/pipette'
import PlayIcon from '~icons/lucide/play'
import PlugIcon from '~icons/lucide/plug'
import PrinterIcon from '~icons/lucide/printer'
import RocketIcon from '~icons/lucide/rocket'
import RotateCcwIcon from '~icons/lucide/rotate-ccw'
import ScrollTextIcon from '~icons/lucide/scroll-text'
import Settings2Icon from '~icons/lucide/settings-2'
import SettingsIcon from '~icons/lucide/settings'
import ShieldCheckIcon from '~icons/lucide/shield-check'
import SmartphoneIcon from '~icons/lucide/smartphone'
import SparklesIcon from '~icons/lucide/sparkles'
import SquareFunctionIcon from '~icons/lucide/square-function'
import SquareStackIcon from '~icons/lucide/square-stack'
import SunMoonIcon from '~icons/lucide/sun-moon'
import SwatchBookIcon from '~icons/lucide/swatch-book'
import TagIcon from '~icons/lucide/tag'
import TerminalIcon from '~icons/lucide/terminal'
import TestTubeIcon from '~icons/lucide/test-tube'
import TypeIcon from '~icons/lucide/type'
import VariableIcon from '~icons/lucide/variable'
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
import { keyframes } from 'zyzz/web'

const blink = keyframes({ '50%': { opacity: 0 } })

const sidebarIcons: Record<string, typeof BookOpenIcon> = {
  'api/babel': BabelIcon,
  'api/cli': TerminalIcon,
  'api/compiler': WrenchIcon,
  'api/core': BookOpenIcon,
  'api/core/cx': CombineIcon,
  'api/core/defineConfig': SettingsIcon,
  'api/core/defineConfig/appearance': SunMoonIcon,
  'api/core/defineConfig/script': FileCodeIcon,
  'api/core/defineConfig/vars': BracesIcon,
  'api/core/defineVars': PaletteIcon,
  'api/core/extendVars': CopyPlusIcon,
  'api/core/namespaces/Config': Settings2Icon,
  'api/core/namespaces/Props': TagIcon,
  'api/core/namespaces/Style': FileTypeIcon,
  'api/core/namespaces/Vars': SwatchBookIcon,
  'api/core/style': PaintbrushIcon,
  'api/core/values': ListIcon,
  'api/core/variable': VariableIcon,
  'api/core/variants': LayersIcon,
  'api/metro': SmartphoneIcon,
  'api/next': NextIcon,
  'api/node': NodeIcon,
  'api/oxlint': ShieldCheckIcon,
  'api/react-native': ReactIcon,
  'api/runtime': PlayIcon,
  'api/unplugin': PlugIcon,
  'api/vite': ViteIcon,
  'api/web': MonitorIcon,
  'api/web/at-rules': ScrollTextIcon,
  'api/web/colorProfile': PipetteIcon,
  'api/web/counterStyle': ListOrderedIcon,
  'api/web/cssFunction': SquareFunctionIcon,
  'api/web/customMedia': MonitorSmartphoneIcon,
  'api/web/fontFace': TypeIcon,
  'api/web/fontFeatureValues': ALargeSmallIcon,
  'api/web/fontPaletteValues': PaintBucketIcon,
  'api/web/global': GlobeIcon,
  'api/web/importCss': FileInputIcon,
  'api/web/keyframes': FilmIcon,
  'api/web/layers': LayersIcon,
  'api/web/namespace': AtSignIcon,
  'api/web/namespaces/Css': CodeXmlIcon,
  'api/web/page': PrinterIcon,
  'api/web/positionTry': AnchorIcon,
  'api/web/property': VariableIcon,
  'api/web/viewTransition': ArrowLeftRightIcon,
  concepts: BookOpenIcon,
  'guides/at-rules': AtSignIcon,
  'guides/conditions': WorkflowIcon,
  'guides/css-output': CodeXmlIcon,
  'guides/default-theme': SwatchBookIcon,
  'guides/global-styles': GlobeIcon,
  'guides/keyframes': FilmIcon,
  'guides/layers': SquareStackIcon,
  'guides/native': BookOpenIcon,
  'guides/native/animations': FilmIcon,
  'guides/native/components': BoxIcon,
  'guides/native/packages': PackageIcon,
  'guides/native/responsive': SmartphoneIcon,
  'guides/native/styling': PaintbrushIcon,
  'guides/native/themes': PaletteIcon,
  'guides/native/unistyles': ArrowLeftRightIcon,
  'guides/reset': RotateCcwIcon,
  'guides/stylex': ArrowLeftRightIcon,
  'guides/styling': PaintbrushIcon,
  'guides/tailwind': ArrowLeftRightIcon,
  'guides/testing': TestTubeIcon,
  'guides/themes': PaletteIcon,
  'guides/typography': TypeIcon,
  'guides/variants': LayersIcon,
  Core: BoxIcon,
  Integrations: PlugIcon,
  'React Native': ReactIcon,
  'introduction/agents': SparklesIcon,
  'introduction/benchmarks': GaugeIcon,
  'introduction/comparisons': ArrowLeftRightIcon,
  'introduction/compatibility': ShieldCheckIcon,
  'introduction/faq': CircleHelpIcon,
  'introduction/getting-started': RocketIcon,
  'introduction/thinking-in-zyzz': BrainIcon,
  'introduction/why-zyzz': LightbulbIcon,
}

/** Displays a documentation page and grouped navigation. */
export function Page(props: Page.Props) {
  const { path } = props

  const page = Manifest.pages[path]!
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
        <Link href="/vars" {...styles.variables()}>
          Variables
        </Link>
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
      <div {...styles.columns()}>
        <article {...styles.article()}>
          <header {...styles.heading()}>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </header>
          {/* Hydration keeps the server-rendered page until its chunk loads. */}
          <Suspense>
            <PageContent path={path} />
          </Suspense>
        </article>
        <Outline headings={page.headings} />
      </div>
    </DocumentationShell>
  )
}

export declare namespace Page {
  /** Properties for the Page component. */
  type Props = { path: string }
}

/** Renders a page's MDX once its chunk has loaded. */
function PageContent(props: PageContent.Props) {
  const Content = use(Docs.load(props.path))

  return (
    <Content
      components={{
        AgentPrompt,
        Card,
        FrameworkSetup,
        Install,
        Steps,
        a: Link,
        blockquote: Callout,
        pre: Code,
      }}
    />
  )
}

declare namespace PageContent {
  type Props = { path: string }
}

/** Lists the page's sections and marks the one scrolled beneath the header. */
function Outline(props: Outline.Props) {
  const { headings } = props
  const [current, setCurrent] = useState<string | undefined>(undefined)
  const labelId = useId()

  useEffect(() => {
    const targets = headings.flatMap((heading) => {
      const element = document.getElementById(heading.id)
      return element ? [element] : []
    })
    let frame = 0

    const update = () => {
      frame = 0
      const root = document.documentElement
      // Short final sections never reach the top, so the end of a scrolled page selects the last one.
      const end =
        root.scrollTop > 0 &&
        root.scrollTop + window.innerHeight >= root.scrollHeight - 1

      // Anchor navigation stops at each heading's scroll margin, which marks it as current.
      const passed = end
        ? targets
        : targets.filter(
            (element) =>
              element.getBoundingClientRect().top <=
              Number.parseFloat(getComputedStyle(element).scrollMarginTop) + 1,
          )
      setCurrent(passed.at(-1)?.id)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
    }
  }, [headings])

  return (
    <aside {...styles.outline()}>
      {headings.length > 0 && (
        <nav aria-labelledby={labelId} {...styles.outlineNavigation()}>
          <h2 id={labelId} {...styles.groupHeading()}>
            On this page
          </h2>
          <ul>
            {headings.map((heading) => (
              <li key={heading.id}>
                <a
                  aria-current={heading.id === current ? 'location' : undefined}
                  data-depth={heading.depth}
                  href={`#${heading.id}`}
                  {...styles.outlineLink()}
                >
                  {heading.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  )
}

declare namespace Outline {
  type Props = { headings: (typeof __DOCS__.pages)[string]['headings'] }
}

function SidebarItem(props: SidebarItem.Props) {
  const { item, path } = props
  const enabled =
    item.path !== undefined && Object.hasOwn(Manifest.pages, item.path)
  const labelId = useId()

  // A section labels a run of pages inside a topic without adding another disclosure level.
  if (item.items)
    return (
      <div aria-labelledby={labelId} role="group" {...styles.section()}>
        <span id={labelId} {...styles.sectionLabel()}>
          {item.title}
        </span>
        {item.items.map((child) => (
          <SidebarItem item={child} key={child.title} path={path} />
        ))}
      </div>
    )

  const Icon = sidebarIcons[item.path ?? item.title] ?? BookOpenIcon
  const content = (
    <>
      <Icon aria-hidden="true" height="16" width="16" />
      {item.title}
    </>
  )

  // A topic collapses its nested pages and opens while one of them is current.
  if (item.children)
    return (
      <details open={Docs.paths(item).includes(path)} {...styles.topic()}>
        <summary {...styles.link()}>
          {content}
          <ChevronRightIcon
            aria-hidden="true"
            height="16"
            width="16"
            {...styles.chevron()}
          />
        </summary>
        <div {...styles.nestedLinks()}>
          {item.children.map((child) => (
            <SidebarItem item={child} key={child.title} path={path} />
          ))}
        </div>
      </details>
    )

  if (enabled)
    return (
      <Link
        aria-current={item.path === path ? 'page' : undefined}
        href={`/docs/${item.path}`}
        {...styles.link()}
      >
        {content}
      </Link>
    )

  return (
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
  const code = Object.hasOwn(Manifest.code, source)
    ? Manifest.code[source]
    : undefined
  const text = code?.text ?? source
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
          await navigator.clipboard.writeText(text)
          setCopyState('copied')
        } catch {
          setCopyState('failed')
        }
      }}
      type="button"
      {...styles.copy({
        placement: !filename && !text.includes('\n') ? 'center' : 'top',
      })}
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
        {code ? (
          // Shiki renders highlighted lines, notations, and Twoslash annotations during the build.
          <code dangerouslySetInnerHTML={{ __html: code.html }} />
        ) : (
          <code>{source}</code>
        )}
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
    // Blocks share the text column width, while the header's border spans the padded article.
    '& > :not(header), & > header > *': { maxWidth: '3xl' },
    '& p, & aside': { color: 'gray.900', marginBlock: 4 },
    '& [data-step] > div > h3': { marginTop: 0 },
    '& h2': {
      typography: 'heading.24',
      marginTop: 10,
      marginBottom: 4,
      scrollMarginTop: 24,
    },
    '& h3': {
      typography: 'heading.20',
      marginTop: 8,
      marginBottom: 3,
      scrollMarginTop: 24,
    },
    '& h4': {
      typography: 'heading.16',
      marginTop: 8,
      marginBottom: 3,
      scrollMarginTop: 24,
    },
    '& a:not([data-card])': {
      color: 'foreground',
      textDecoration: 'underline',
    },
    '& ul, & ol:not([data-steps])': {
      color: 'gray.900',
      marginBlock: 4,
      paddingLeft: 6,
    },
    '& strong, & b': { fontWeight: 'medium' },
    // A leading bold label names the list item's topic, so it takes the primary text color.
    '& li > strong:first-child': { color: 'foreground' },
    '& ul': { listStyleType: 'disc' },
    '& ol:not([data-steps])': { listStyleType: 'decimal' },
    '& li:not([data-step])': { marginBlock: 2 },
    // Inline code in text, including authored `<code>` tags. Components that render their own code, such as install commands, keep their styles.
    '& :is(p, li, td, th, dd, dt, a, strong, em, h2, h3, h4) > code': {
      typography: 'label.14.mono',
      // A relative size keeps inline code slightly smaller than its surrounding text.
      fontSize: '0.9375em !custom',
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
    // Marked lines and Twoslash rows extend into the block's padding.
    '& .highlighted, & .diff, & .twoslash-meta-line, & .twoslash-tag-line': {
      boxSizing: 'border-box',
      marginLeft: `calc(${vars.spacing[6]} * -1) !custom`,
      minWidth: `calc(100% + ${vars.spacing[6]} + ${vars.spacing[12]}) !custom`,
      paddingLeft: 6,
      paddingRight: 12,
      position: 'relative',
    },
    '& .highlighted, & .diff': { display: 'inline-block' },
    '& .highlighted': { backgroundColor: 'grayAlpha.200' },
    '& .highlighted-word': {
      backgroundColor: 'blue.200',
      borderRadius: 'sm',
      marginInline: '-2px !custom',
      outline: '1px solid',
      outlineColor: 'blue.500',
      paddingInline: '2px !custom',
    },
    '& .diff::before': { left: 2, position: 'absolute' },
    '& .diff.add': { backgroundColor: 'green.100' },
    '& .diff.add::before': { color: 'green.900', content: '"+"' },
    '& .diff.remove': { backgroundColor: 'red.100' },
    '& .diff.remove::before': { color: 'red.900', content: '"-"' },
    '& .twoslash-error': {
      textDecorationColor: 'red.700',
      textDecorationLine: 'underline',
      textDecorationStyle: 'wavy',
      textUnderlineOffset: '4px',
    },
    // A zero width keeps messages out of the code's max-content width, so they wrap instead of scrolling.
    '& .twoslash-meta-line, & .twoslash-tag-line': {
      backgroundColor: 'red.100',
      borderLeft: '2px solid',
      borderColor: 'red.700',
      color: 'red.900',
      display: 'block',
      userSelect: 'none',
      whiteSpace: 'pre-wrap',
      width: 0,
    },
    // A one-line-tall, zero-width cursor places the list under the line and pushes later lines down.
    '& .twoslash-completion-cursor': {
      display: 'inline-block',
      paddingTop: '1lh !custom',
      position: 'relative',
      verticalAlign: 'top',
      width: 0,
      userSelect: 'none',
    },
    '& .twoslash-completion-cursor::before': {
      animationDuration: '1s',
      animationIterationCount: 'infinite',
      animationName: blink,
      animationTimingFunction: 'step-end',
      backgroundColor: 'foreground',
      content: '""',
      height: '1.2em !custom',
      left: '-1px !custom',
      position: 'absolute',
      top: '0.15em !custom',
      width: '2px !custom',
    },
    '& .twoslash-completion-list': {
      backgroundColor: 'background.surface',
      border: '1px solid',
      borderColor: 'gray.400',
      borderRadius: 'md',
      boxShadow: 'md',
      color: 'gray.900',
      display: 'flex',
      flexDirection: 'column',
      listStyle: 'none',
      marginBlock: 1,
      paddingBlock: 1,
      paddingInline: 0,
      width: 'max-content !custom',
    },
    '& ul.twoslash-completion-list > li': { margin: 0, paddingInline: 2 },
    '& ul.twoslash-completion-list > li:first-child': {
      backgroundColor: 'gray.200',
      color: 'foreground',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& .twoslash-completion-cursor::before': { animationName: 'none' },
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

  export const columns = style({
    display: 'grid',
    // Caps the article at its text width plus padding, so the outline sits beside the content. The shell gutter centers this width.
    gridTemplateColumns: `minmax(0, calc(${vars.container['3xl']} + ${vars.spacing[12]} * 2)) 252px`,
    '@media (max-width: 1279px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  })

  export const construction = style({
    flexShrink: 0,
    marginLeft: 'auto !custom',
  })

  export const copy = variants({
    base: {
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
      width: 7,
      ':hover': { backgroundColor: 'gray.200', color: 'foreground' },
      ':focus-visible': {
        outline: '2px solid',
        outlineColor: 'blue.900',
        outlineOffset: '2px',
      },
    },
    defaultVariants: { placement: 'top' },
    variants: {
      placement: {
        center: { top: '50% !custom', transform: 'translateY(-50%)' },
        top: { top: 2 },
      },
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

  export const section = style({ marginTop: 3 })

  export const sectionLabel = style({
    typography: 'label.12',
    color: 'gray.700',
    display: 'block',
    paddingBlock: 1,
    paddingInline: 3,
  })

  export const topic = style({
    selectors: {
      '& > summary': { cursor: 'pointer', listStyle: 'none' },
      '& > summary::-webkit-details-marker': { display: 'none' },
    },
  })

  export const chevron = style({
    marginLeft: 'auto !custom',
    transition: 'rotate 150ms',
    selectors: {
      [`${topic}[open] > summary > &`]: { rotate: '90deg' },
    },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })

  export const outline = style({
    borderLeft: '1px solid',
    borderColor: 'gray.400',
    '@media (max-width: 1279px)': { display: 'none' },
  })

  export const outlineLink = style({
    typography: 'label.14',
    color: 'gray.900',
    display: 'block',
    paddingBlock: 1,
    paddingInline: 3,
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
    '&[aria-current="location"]': { color: 'foreground' },
    '&[data-depth="3"]': { paddingLeft: 6 },
  })

  export const outlineNavigation = style({
    maxHeight: 'calc(100dvh - 64px) !custom',
    overflowY: 'auto',
    paddingBottom: 4,
    paddingInline: 2,
    paddingTop: 4,
    position: 'sticky',
    top: 16,
  })

  export const variables = style({
    typography: 'label.14',
    fontWeight: 'medium',
    color: 'gray.900',
    display: 'block',
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })
}
