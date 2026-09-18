/** Presents Zyzz and its installation shortcuts. @module */
import { useEffect, useRef, useState } from 'react'
import { style } from './zyzz.config.js'

/** Renders the landing page and clipboard actions. */
export function Home() {
  return (
    <main {...styles.page()}>
      <section {...styles.content()} aria-label="Zyzz">
        <picture>
          <source
            media="(prefers-color-scheme: dark)"
            srcSet="/logo-dark.svg"
          />
          <img
            {...styles.logo()}
            src="/logo-light.svg"
            alt="Zyzz"
            width="255"
            height="114"
          />
        </picture>
        <h1 {...styles.description()}>
          A modern, universal, simple styling library for the Web and React
          Native.
        </h1>
        <div {...styles.actions()}>
          <CopyPane />
        </div>
      </section>
    </main>
  )
}

function CopyPane() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timeout.current), [])

  async function copy() {
    clearTimeout(timeout.current)
    try {
      await navigator.clipboard.writeText('npm i zyzz')
      setStatus('copied')
    } catch {
      setStatus('error')
    }
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <button
      {...styles.pane()}
      aria-label={
        status === 'copied'
          ? 'Copied to clipboard'
          : status === 'error'
            ? 'Could not copy. Try again.'
            : 'Copy npm i zyzz'
      }
      onClick={copy}
      type="button"
    >
      <code {...styles.command()}>npm i zyzz</code>
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {status === 'copied' ? (
          <path d="m5 12 4 4L19 6" />
        ) : status === 'error' ? (
          <path d="m6 6 12 12M18 6 6 18" />
        ) : (
          <>
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" />
          </>
        )}
      </svg>
    </button>
  )
}

namespace styles {
  export const actions = style({
    display: 'grid',
    gap: 7,
    marginTop: 9,
    width: '100%',
  })
  export const command = style({
    fontFamily: 'mono',
    fontSize: 'sm',
  })
  export const content = style({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    maxWidth: 96,
    width: '100%',
  })
  export const description = style({
    color: 'gray.900',
    fontSize: 'lg',
    fontWeight: 'normal',
    letterSpacing: 'tight',
    lineHeight: 'relaxed',
    margin: 0,
    marginTop: 5,
    textAlign: 'center',
    textWrap: 'balance',
  })
  export const logo = style({
    display: 'block',
    height: 'auto',
    width: 64,
  })
  export const page = style({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100svh',
    paddingBlockStart: 16,
    paddingBlockEnd: 24,
    paddingInline: 6,
  })
  export const pane = style({
    alignItems: 'center',
    backgroundColor: 'surface',
    borderColor: 'gray.300',
    borderStyle: 'solid',
    borderWidth: '1px',
    borderRadius: 'xl',
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: 'sm',
    fontWeight: 'medium',
    gap: 4,
    justifyContent: 'space-between',
    minHeight: 14,
    paddingBlock: 4,
    paddingInline: 5,
    textAlign: 'left',
    width: '100%',
    selectors: {
      '&:focus-visible': {
        outline: '2px solid currentColor',
        outlineOffset: '1px',
      },
      '&:hover': { backgroundColor: 'gray.100' },
      '& svg': { flexShrink: 0, opacity: 0.5 },
    },
  })
}
