/** Groups concepts source files and rendered examples in accessible tabs. @module */
import {
  Children,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import CheckIcon from '~icons/lucide/check'
import CopyIcon from '~icons/lucide/copy'
import FileIcon from '~icons/lucide/file'
import PlayIcon from '~icons/lucide/play'
import ReactIcon from '~icons/simple-icons/react'
import TypeScriptIcon from '~icons/simple-icons/typescript'
import { style } from 'zyzz/default'

/** Displays one source file or rendered example at a time. */
export function Tabs(props: Tabs.Props) {
  const id = useId()
  const [selected, setSelected] = useState(0)
  const copyRequest = useRef(0)
  const [copyState, setCopyState] = useState<'copied' | 'failed' | 'idle'>(
    'idle',
  )
  const tabs = Children.toArray(props.children)
    .filter(isValidElement<Tab.Props>)
    .map((tab) => {
      const block = Children.toArray(tab.props.children).find(
        isValidElement<{ children?: ReactNode }>,
      )
      const source = (() => {
        if (
          !block ||
          !isValidElement<{ children?: string }>(block.props.children)
        )
          return undefined
        return block.props.children.props.children?.replace(/\n$/, '')
      })()
      const Icon = (() => {
        if (tab.props.title === 'Rendered') return PlayIcon
        if (tab.props.title.endsWith('.tsx')) return ReactIcon
        if (tab.props.title.endsWith('.ts')) return TypeScriptIcon
        return FileIcon
      })()

      return {
        content: tab,
        Icon,
        key: tab.key,
        source,
        title: tab.props.title,
      }
    })
  const active = tabs[selected]

  useEffect(() => {
    if (copyState !== 'copied') return
    const timer = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(timer)
  }, [copyState])

  return (
    <div data-concept-tabs="" {...styles.root()}>
      <div {...styles.header()}>
        <div role="tablist" aria-label={props.label} {...styles.list()}>
          {tabs.map((tab, index) => (
            <button
              aria-controls={`${id}-panel-${index}`}
              aria-selected={selected === index}
              id={`${id}-tab-${index}`}
              key={tab.key}
              onClick={() => {
                copyRequest.current += 1
                setSelected(index)
                setCopyState('idle')
              }}
              onKeyDown={(event) => {
                const next = (() => {
                  if (event.key === 'ArrowRight')
                    return (index + 1) % tabs.length
                  if (event.key === 'ArrowLeft')
                    return (index - 1 + tabs.length) % tabs.length
                  if (event.key === 'Home') return 0
                  if (event.key === 'End') return tabs.length - 1
                  return undefined
                })()
                if (next === undefined) return

                event.preventDefault()
                copyRequest.current += 1
                setSelected(next)
                setCopyState('idle')
                document.getElementById(`${id}-tab-${next}`)?.focus()
              }}
              role="tab"
              tabIndex={selected === index ? 0 : -1}
              type="button"
              {...styles.tab()}
            >
              <tab.Icon aria-hidden="true" height="14" width="14" />
              {tab.title}
            </button>
          ))}
        </div>
        {active?.source !== undefined && (
          <button
            aria-label={
              copyState === 'copied'
                ? `Copied ${active.title}`
                : `Copy ${active.title}`
            }
            onClick={async () => {
              const request = ++copyRequest.current
              try {
                if (active.source === undefined) return
                await navigator.clipboard.writeText(active.source)
                if (request === copyRequest.current) setCopyState('copied')
              } catch {
                if (request === copyRequest.current) setCopyState('failed')
              }
            }}
            title={
              copyState === 'failed' ? 'Copy failed. Try again.' : 'Copy code'
            }
            type="button"
            {...styles.copy()}
          >
            {copyState === 'copied' ? (
              <CheckIcon aria-hidden="true" height="16" width="16" />
            ) : (
              <CopyIcon aria-hidden="true" height="16" width="16" />
            )}
          </button>
        )}
      </div>
      {copyState === 'failed' && (
        <p role="alert">Could not copy code. Select and copy it manually.</p>
      )}
      {tabs.map((tab, index) => (
        <div
          aria-labelledby={`${id}-tab-${index}`}
          hidden={selected !== index}
          id={`${id}-panel-${index}`}
          key={tab.key}
          role="tabpanel"
          data-render={tab.title === 'Rendered' ? '' : undefined}
          tabIndex={0}
          {...styles.panel()}
        >
          {tab.source === undefined ? (
            tab.content
          ) : (
            <pre {...styles.code()}>
              <code>
                {__DOCS__.code[tab.source]?.map((line, lineIndex) => (
                  <span key={lineIndex}>
                    {line.map((token, tokenIndex) => (
                      <span key={tokenIndex} style={{ color: token.color }}>
                        {token.content}
                      </span>
                    ))}
                    {'\n'}
                  </span>
                )) ?? tab.source}
              </code>
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

export declare namespace Tabs {
  /** Properties for a concepts example group. */
  type Props = {
    /** Source and render panels. */
    children: ReactNode
    /** Accessible name describing the example. */
    label: string
  }
}

/** Supplies one titled panel to a concepts example group. */
export function Tab(props: Tab.Props) {
  return props.children
}

export declare namespace Tab {
  /** Properties for one panel. */
  type Props = {
    /** Source code or a rendered example. */
    children: ReactNode
    /** Filename or render label. */
    title: string
  }
}

namespace styles {
  export const code = style({
    typography: 'copy.13.mono',
    fontSize: '15px !custom',
    lineHeight: '24px !custom',
    backgroundColor: 'background.primary',
    margin: 0,
    overflowX: 'auto',
    padding: 6,
    '& code': {
      font: 'inherit',
      display: 'block',
      minWidth: 'max-content !custom',
    },
  })

  export const copy = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: 'none',
    borderRadius: 'sm',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    flexShrink: 0,
    height: 7,
    justifyContent: 'center',
    marginInline: 2,
    width: 7,
    ':hover': { backgroundColor: 'gray.200', color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const header = style({
    alignItems: 'center',
    backgroundColor: 'light-dark(#f5f5f5, #111) !custom',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
  })

  export const list = style({
    display: 'flex',
    flex: 1,
    gap: 1,
    minWidth: '0px !custom',
    overflowX: 'auto',
    paddingInline: 2,
  })

  export const panel = style({
    '&[data-render]': { backgroundColor: 'background.primary' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '-2px',
    },
  })

  export const root = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginBlock: 6,
    overflow: 'hidden',
    '&[data-concept-tabs] [data-concept-example]': {
      backgroundColor: 'background.primary',
      border: 'none',
      borderRadius: '0px !custom',
      margin: 0,
      minHeight: '180px !custom',
    },
  })

  export const tab = style({
    backgroundColor: 'transparent !custom',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'gray.900',
    cursor: 'pointer',
    alignItems: 'center',
    display: 'flex',
    gap: 2,
    flexShrink: 0,
    paddingBlock: 3,
    paddingInline: 3,
    typography: 'label.14',
    whiteSpace: 'nowrap',
    '&[aria-selected="true"]': {
      borderBottomColor: 'foreground',
      color: 'foreground',
    },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.700',
      outlineOffset: '-2px',
    },
  })
}
