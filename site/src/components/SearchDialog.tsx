/** Searches the documentation in a modal dialog, blending keyword results with AI Search results. @module */
import { Dialog } from '@base-ui/react/dialog'
import { useNavigate } from '@tanstack/react-router'
import MiniSearch, { type SearchResult } from 'minisearch'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import FileIcon from '~icons/lucide/file-text'
import HashIcon from '~icons/lucide/hash'
import LoaderIcon from '~icons/lucide/loader-circle'
import SearchIcon from '~icons/lucide/search'
import { keyframes } from 'zyzz/web'
import * as Docs from '../Docs.js'
import * as Search from '../Search.js'
import { style } from '../zyzz.config.js'
import { Kbd } from './Kbd.js'
import { Link } from './Link.js'

/**
 * Searches documentation pages and sections, toggled by the parent or by ⌘K and Ctrl+K.
 * Keyword results appear as the query changes, and AI Search results merge in once the `/api/search` route answers.
 */
export function SearchDialog(props: SearchDialog.Props) {
  const { onOpenChange, open } = props

  type Semantic = { query: string; results: readonly Search.Match[] }
  const [index, setIndex] = useState<MiniSearch<Search.Document>>()
  const [pending, setPending] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [semantic, setSemantic] = useState<Semantic>()
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const navigate = useNavigate()
  const value = query.trim()

  useEffect(() => {
    function toggle(event: globalThis.KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return

      event.preventDefault()
      onOpenChange(!open)
    }

    document.addEventListener('keydown', toggle)
    return () => document.removeEventListener('keydown', toggle)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open || index) return

    let current = true
    import('virtual:search-index')
      .then((module) => {
        if (current)
          setIndex(MiniSearch.loadJSON(module.default, Search.options))
      })
      .catch((error: unknown) => console.error(error))
    return () => {
      current = false
    }
  }, [index, open])

  useEffect(() => {
    if (!open || !value) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPending(true)
      try {
        const response = await fetch('/api/search', {
          body: JSON.stringify({ query: value }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
          signal: controller.signal,
        })
        // The route answers 503 where AI Search is unreachable, which leaves the keyword results in place.
        if (!response.ok) return

        const body = (await response.json()) as Search.Matches
        setSemantic({ query: value, results: body.results })
      } catch {
        // A newer query aborted this request.
      } finally {
        if (!controller.signal.aborted) setPending(false)
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
      setPending(false)
    }
  }, [open, value])

  const keyword = useMemo((): readonly Result[] => {
    if (!index || !value) return []

    // An exact title match leads, with matching case first, so typing a page or export name opens it.
    const rank = (result: Result) => {
      if (result.title === value) return 2
      return result.title.toLowerCase() === value.toLowerCase() ? 1 : 0
    }
    return index
      .search(value)
      .slice(0, 20)
      .map((result): Result => {
        // MiniSearch returns stored fields untyped, and the index stores exactly the Document fields.
        const document = result as SearchResult & Search.Document
        return {
          href: document.href,
          terms: result.terms,
          text: document.text,
          title: document.title,
          titles: document.titles,
          type: document.type,
        }
      })
      .sort((a, b) => rank(b) - rank(a))
  }, [index, value])

  const results = useMemo(() => {
    if (semantic?.query !== value || !semantic.results.length) return keyword

    return Search.fuse<Result>({
      keyword,
      semantic: semantic.results.map((result) => ({ ...result, terms: [] })),
    })
  }, [keyword, semantic, value])
  const active = Math.min(selected, results.length - 1)

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function change(next: boolean) {
    if (!next) {
      setQuery('')
      setSelected(0)
      setSemantic(undefined)
    }
    onOpenChange(next)
  }

  function move(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setSelected(Math.max(0, Math.min(results.length - 1, active + step)))
      return
    }

    const result = results[active]
    if (event.key !== 'Enter' || !result) return

    event.preventDefault()
    change(false)
    void navigate({ href: result.href })
  }

  const message = (() => {
    if (!value) return 'Search pages, sections, and API references.'
    if (!index) return 'Loading the search index…'
    return `No results for “${value}”.`
  })()

  return (
    <Dialog.Root onOpenChange={change} open={open}>
      <Dialog.Portal>
        <Dialog.Backdrop {...styles.backdrop()} />
        <Dialog.Popup initialFocus={input} {...styles.popup()}>
          <Dialog.Title {...styles.hidden()}>Search documentation</Dialog.Title>
          <Dialog.Description {...styles.hidden()}>
            Use the arrow keys to choose a result, and Enter to open it.
          </Dialog.Description>
          <div {...styles.header()}>
            <SearchIcon aria-hidden="true" {...styles.headerIcon()} />
            <input
              aria-activedescendant={
                results[active] ? `${id}-${active}` : undefined
              }
              aria-autocomplete="list"
              aria-controls={`${id}-results`}
              aria-expanded={results.length > 0}
              aria-label="Search documentation"
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value)
                setSelected(0)
              }}
              onKeyDown={move}
              placeholder="Search documentation…"
              ref={input}
              role="combobox"
              spellCheck={false}
              type="text"
              value={query}
              {...styles.input()}
            />
            {pending && (
              <span role="status" {...styles.status()}>
                Enhancing results
                <LoaderIcon aria-hidden="true" {...styles.spinner()} />
              </span>
            )}
          </div>
          {results.length > 0 ? (
            <ul
              aria-label="Search results"
              id={`${id}-results`}
              ref={list}
              role="listbox"
              {...styles.list()}
            >
              {results.map((result, position) => (
                <Option
                  id={`${id}-${position}`}
                  key={result.href}
                  onPointerMove={() => setSelected(position)}
                  onSelect={() => change(false)}
                  query={value}
                  result={result}
                  selected={position === active}
                />
              ))}
            </ul>
          ) : (
            <p {...styles.empty()}>{message}</p>
          )}
          <div aria-hidden="true" {...styles.footer()}>
            <span {...styles.hint()}>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              navigate
            </span>
            <span {...styles.hint()}>
              <Kbd>↵</Kbd>
              select
            </span>
            <span {...styles.hint()}>
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export declare namespace SearchDialog {
  type Props = {
    /** Receives the next open state, from the trigger, ⌘K, Escape, the backdrop, or a selected result. */
    onOpenChange: (open: boolean) => void
    /** Whether the dialog is open. */
    open: boolean
  }
}

/** The field-shaped control that opens the dialog. */
export namespace SearchDialog {
  /** Opens the dialog, and starts loading the keyword index on hover or focus. */
  export function Trigger(props: Trigger.Props) {
    return (
      <button
        aria-haspopup="dialog"
        aria-label="Search docs"
        onClick={props.onClick}
        onFocus={prefetch}
        onPointerEnter={prefetch}
        type="button"
        {...styles.trigger()}
      >
        Search docs...
        <span {...styles.shortcut()}>
          <Kbd>⌘K</Kbd>
        </span>
      </button>
    )
  }

  export declare namespace Trigger {
    type Props = {
      /** Opens the dialog. */
      onClick: () => void
    }
  }
}

/** A keyword or AI Search result, with the index terms it matched. */
type Result = Search.Document & {
  /** Index terms that matched the query. AI Search results have none. */
  terms: readonly string[]
}

/** Renders one result with its sidebar trail, highlighted title, and snippet. */
function Option(props: Option.Props) {
  const { id, onPointerMove, onSelect, query, result, selected } = props

  const terms = [...Search.tokenize(query), ...result.terms]
  const Icon = result.type === 'page' ? FileIcon : HashIcon
  const path = result.href.slice('/docs/'.length).split('#')[0] ?? ''
  const trail = [...Docs.trail(path), ...result.titles].join(' › ')
  return (
    <li
      aria-selected={selected}
      id={id}
      onPointerMove={onPointerMove}
      role="option"
      {...styles.option()}
    >
      <Link
        href={result.href}
        onClick={onSelect}
        tabIndex={-1}
        {...styles.optionLink()}
      >
        <Icon aria-hidden="true" {...styles.optionIcon()} />
        <span {...styles.optionText()}>
          {trail && <span {...styles.trail()}>{trail}</span>}
          <span {...styles.title()}>{highlight(result.title, terms)}</span>
          {result.text && (
            <span {...styles.snippet()}>
              {highlight(snippet(result.text, terms), terms)}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

declare namespace Option {
  type Props = {
    id: string
    onPointerMove: () => void
    onSelect: () => void
    query: string
    result: Result
    selected: boolean
  }
}

/** Wraps each occurrence of a term in `mark`, preferring the longest term where several overlap. */
function highlight(text: string, terms: readonly string[]): ReactNode {
  const words = [...new Set(terms)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!words.length) return text

  const source = words
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const pattern = new RegExp(`(${source})`, 'gi')
  return text.split(pattern).map((part, position) =>
    // Splitting on a capture group places the matches at odd positions.
    position % 2 ? (
      <mark key={position} {...styles.mark()}>
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

/** Starts loading the keyword index chunk before the dialog opens. */
function prefetch() {
  import('virtual:search-index').catch(() => {})
}

/** Cuts the text around its first matching term, or returns its opening. */
function snippet(text: string, terms: readonly string[]): string {
  const lower = text.toLowerCase()
  const start = Math.min(
    ...terms
      .map((term) => lower.indexOf(term.toLowerCase()))
      .filter((position) => position >= 0),
  )
  if (!Number.isFinite(start)) return text.slice(0, 200)

  const from = Math.max(0, start - 60)
  const to = Math.min(text.length, start + 140)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}

const spin = keyframes({ to: { transform: 'rotate(360deg)' } })

namespace styles {
  export const backdrop = style({
    backdropFilter: 'blur(4px) !custom',
    backgroundColor: 'light-dark(rgb(0 0 0 / 0.2), rgb(0 0 0 / 0.6)) !custom',
    inset: 0,
    position: 'fixed',
    transition: 'opacity 150ms',
    zIndex: 100,
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    selectors: {
      '&[data-starting-style], &[data-ending-style]': { opacity: 0 },
    },
  })

  export const empty = style({
    typography: 'copy.14',
    color: 'gray.900',
    margin: 0,
    paddingBlock: 10,
    paddingInline: 4,
    textAlign: 'center',
  })

  export const footer = style({
    typography: 'label.12',
    borderTop: '1px solid',
    borderTopColor: 'gray.400',
    color: 'gray.900',
    display: 'flex',
    gap: 4,
    paddingBlock: 3,
    paddingInline: 4,
    '@media (max-width: 640px)': { display: 'none' },
  })

  export const header = style({
    alignItems: 'center',
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 3,
    paddingBlock: 4,
    paddingInline: 4,
  })

  export const headerIcon = style({
    color: 'gray.900',
    flexShrink: 0,
    height: 5,
    width: 5,
  })

  // Keeps the dialog's title and description available to assistive technology only.
  export const hidden = style({
    clip: 'rect(0 0 0 0)',
    height: 'px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 'px',
  })

  export const hint = style({
    alignItems: 'center',
    display: 'flex',
    gap: 1,
  })

  export const input = style({
    typography: 'copy.16',
    backgroundColor: 'transparent !custom',
    border: 'none',
    color: 'foreground',
    flex: 1,
    minWidth: 0,
    outline: 'none',
    padding: 0,
    '::placeholder': { color: 'gray.900' },
  })

  export const list = style({
    flex: 1,
    listStyle: 'none',
    margin: 0,
    overflowY: 'auto',
    padding: 0,
  })

  export const mark = style({
    backgroundColor: 'grayAlpha.300',
    borderRadius: 'xs',
    color: 'foreground',
  })

  export const option = style({
    selectors: {
      '&[aria-selected="true"]': { backgroundColor: 'grayAlpha.200' },
    },
  })

  export const optionIcon = style({
    color: 'gray.900',
    flexShrink: 0,
    height: 4,
    marginTop: 1,
    width: 4,
  })

  export const optionLink = style({
    color: 'inherit !custom',
    display: 'flex',
    gap: 3,
    paddingBlock: 3,
    paddingInline: 4,
    textDecoration: 'none',
  })

  export const optionText = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  })

  export const popup = style({
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '2xl',
    boxShadow: '2xl',
    display: 'flex',
    flexDirection: 'column',
    left: '50% !custom',
    maxHeight: '70vh !custom',
    maxWidth: '2xl',
    overflow: 'hidden',
    position: 'fixed',
    top: '12vh !custom',
    transform: 'translateX(-50%)',
    transformOrigin: 'top',
    transition: 'opacity 150ms, scale 150ms',
    width: 'calc(100vw - 32px) !custom',
    zIndex: 101,
    '@media (max-width: 640px)': { top: 4 },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    selectors: {
      '&[data-starting-style], &[data-ending-style]': {
        opacity: 0,
        scale: '0.98 !custom',
      },
    },
  })

  export const shortcut = style({
    display: 'flex',
    pointerEvents: 'none',
    position: 'absolute',
    right: 2,
    top: '50% !custom',
    transform: 'translateY(-50%)',
    '@media (max-width: 700px)': { display: 'none' },
  })

  export const snippet = style({
    typography: 'copy.14',
    color: 'gray.900',
    // Two 20px lines of `copy.14`. Snippets are already cut to a short window around the match.
    maxHeight: 10,
    overflow: 'hidden',
  })

  export const spinner = style({
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationName: spin,
    animationTimingFunction: 'linear',
    height: 4,
    width: 4,
    '@media (prefers-reduced-motion: reduce)': { animationName: 'none' },
  })

  export const status = style({
    typography: 'label.12',
    alignItems: 'center',
    color: 'gray.900',
    display: 'flex',
    flexShrink: 0,
    gap: 2,
  })

  export const title = style({
    typography: 'label.16',
    color: 'foreground',
    fontWeight: 'medium',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  export const trail = style({
    typography: 'label.13',
    color: 'gray.900',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  export const trigger = style({
    typography: 'label.14',
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'gray.900',
    cursor: 'pointer',
    maxWidth: 'xs',
    minWidth: 0,
    paddingBlock: 2,
    paddingLeft: 3,
    paddingRight: 12,
    position: 'relative',
    textAlign: 'left',
    width: '100% !custom',
    ':hover': { borderColor: 'gray.500' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
    '@media (max-width: 700px)': { paddingRight: 3 },
  })
}
