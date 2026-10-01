/** Provides a copyable prompt for coding agents in documentation. @module */
import { useEffect, useState } from 'react'
import SparklesIcon from '~icons/lucide/sparkles'
import { style } from '../zyzz.config.js'

/** Copies the authored prompt and reports clipboard success or failure. */
export function AgentPrompt(props: AgentPrompt.Props) {
  const { children, expanded = false } = props

  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  useEffect(() => {
    if (state !== 'copied') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  return (
    <div>
      <button
        aria-label={
          state === 'copied'
            ? 'Copied instructions'
            : 'Copy instructions for agent'
        }
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children)
            setState('copied')
          } catch {
            setState('failed')
          }
        }}
        type="button"
        data-expanded={expanded || undefined}
        {...styles.prompt()}
      >
        <SparklesIcon
          aria-hidden="true"
          width="14"
          height="14"
          {...(state === 'copied' ? styles.success() : {})}
        />
        <span aria-live="polite">
          {state === 'copied'
            ? 'Copied instructions'
            : 'Copy instructions for agent'}
        </span>
      </button>
      {state === 'failed' && (
        <p role="alert" {...styles.status()}>
          Could not copy instructions. Try again.
        </p>
      )}
    </div>
  )
}

export declare namespace AgentPrompt {
  /** Properties for the AgentPrompt component. */
  type Props = {
    children: string
    expanded?: boolean
  }
}

namespace styles {
  export const prompt = style({
    typography: 'label.14',
    alignItems: 'center',
    backgroundColor: 'light-dark(#fff, #000) !custom',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    gap: 3,
    marginTop: 4,
    maxWidth: 'md',
    '&[data-expanded="true"]': {
      backgroundColor: 'light-dark(#f5f5f5, #111) !custom',
      ':hover': { backgroundColor: 'gray.200' },
      maxWidth: 'none !custom',
      minHeight: '52px !custom',
    },
    minHeight: 11,
    paddingBlock: 2,
    paddingInline: 4,
    textAlign: 'left',
    width: '100% !custom',
    ':hover': { backgroundColor: 'light-dark(#f5f5f5, #111) !custom' },
    '& svg': { flexShrink: 0 },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.600',
      outlineOffset: '2px',
    },
  })

  export const status = style({
    typography: 'copy.13',
    color: 'gray.900',
    paddingTop: 2,
  })

  export const success = style({ color: '#3be0af !custom' })
}
