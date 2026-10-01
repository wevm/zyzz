/** Renders authored MDX within the shared documentation layout. @module */
import { isValidElement, type ReactNode, useEffect, useState } from 'react'
import BookOpenIcon from '~icons/lucide/book-open'
import CheckIcon from '~icons/lucide/check'
import CopyIcon from '~icons/lucide/copy'
import FileIcon from '~icons/lucide/file'
import HtmlIcon from '~icons/simple-icons/html5'
import NextIcon from '~icons/simple-icons/nextdotjs'
import NpmIcon from '~icons/simple-icons/npm'
import ReactIcon from '~icons/simple-icons/react'
import TypeScriptIcon from '~icons/simple-icons/typescript'
import ViteIcon from '~icons/simple-icons/vite'
import { DocumentationShell } from '../components/DocumentationShell.js'
import { Install } from '../components/Install.js'
import { SearchField } from '../components/SearchField.js'
import { AgentPrompt } from '../components/AgentPrompt.js'
import { FrameworkSetup } from '../components/mdx/FrameworkSetup.js'
import { Card } from '../components/mdx/Card.js'
import { Steps } from '../components/mdx/Steps.js'
import * as Docs from '../Docs.js'
import { style, vars } from '../zyzz.config.js'

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
              {group.pages.map((page) => (
                <a
                  aria-current={page.path === path ? 'page' : undefined}
                  href={`/docs/${page.path}`}
                  key={page.path}
                  {...styles.link()}
                >
                  <BookOpenIcon aria-hidden="true" height="16" width="16" />
                  {page.title}
                </a>
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
    ':hover': { backgroundColor: 'gray.100', color: 'foreground' },
    '&[aria-current="page"]': {
      backgroundColor: 'gray.200',
      color: 'foreground',
    },
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
