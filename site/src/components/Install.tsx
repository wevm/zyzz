/** Shares package-manager commands and clipboard controls across the site. @module */
import { useEffect, useState } from 'react'
import CheckIcon from '~icons/lucide/check'
import CopyIcon from '~icons/lucide/copy'
import BunIcon from '~icons/simple-icons/bun'
import NpmIcon from '~icons/simple-icons/npm'
import PnpmIcon from '~icons/simple-icons/pnpm'
import { style } from '../zyzz.config.js'

const managerIcons = { npm: NpmIcon, pnpm: PnpmIcon, bun: BunIcon } as const

/** Selects and copies an installation command. */
export function Install(props: Install.Props) {
  const [localManager, setLocalManager] = useState<Install.Manager>('npm')
  const manager = props.manager ?? localManager
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  useEffect(() => {
    if (copyState !== 'copied') return
    const timeout = window.setTimeout(() => setCopyState('idle'), 2000)
    return () => window.clearTimeout(timeout)
  }, [copyState])

  return (
    <div data-expanded={props.expanded || undefined} {...styles.install()}>
      <div
        aria-label="Package manager"
        role="group"
        {...styles.installHeader()}
      >
        {(
          Object.keys(Install.commands) as (keyof typeof Install.commands)[]
        ).map((value) => {
          const Icon = managerIcons[value]
          return (
            <button
              aria-pressed={manager === value}
              key={value}
              onClick={() => {
                if (props.manager === undefined) setLocalManager(value)
                props.onManagerChange?.(value)
                setCopyState('idle')
              }}
              type="button"
              {...styles.manager()}
            >
              <Icon aria-hidden="true" width="12" height="12" />
              {value}
            </button>
          )
        })}
      </div>
      <button
        aria-label={
          copyState === 'copied'
            ? 'Copied install command'
            : 'Copy install command'
        }
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(Install.commands[manager])
            setCopyState('copied')
          } catch {
            setCopyState('failed')
          }
        }}
        type="button"
        {...styles.commandRow()}
      >
        <code {...styles.command()}>
          {Install.commands[manager].slice(
            0,
            Install.commands[manager].lastIndexOf(' '),
          )}{' '}
          <span {...styles.commandPackage()}>zyzz</span>
        </code>
        {copyState === 'copied' ? (
          <CheckIcon
            aria-hidden="true"
            width="18"
            height="18"
            {...styles.copySuccess()}
          />
        ) : (
          <CopyIcon aria-hidden="true" width="18" height="18" />
        )}
      </button>
      {copyState === 'failed' && (
        <p role="alert" {...styles.copyStatus()}>
          Could not copy. Select the command to copy it manually.
        </p>
      )}
    </div>
  )
}

export namespace Install {
  /** Installation commands in the authored package-manager tab order. */
  export const commands = {
    npm: 'npm install zyzz',
    pnpm: 'pnpm add zyzz',
    bun: 'bun add zyzz',
  } as const

  /** Supported package-manager tab. */
  export type Manager = keyof typeof commands

  /** Properties for the shared installation pane. */
  export type Props = {
    /** Fills the available documentation content width. */
    expanded?: boolean
    /** Selected manager when the pane is controlled by its parent. */
    manager?: Manager
    /** Reports package-manager tab selections. */
    onManagerChange?: (manager: Manager) => void
  }
}

namespace styles {
  export const command = style({
    typography: 'label.14.mono',
    color: 'gray.900',
  })

  export const commandPackage = style({
    color: 'light-dark(#171717, #fff) !custom',
  })

  export const commandRow = style({
    alignItems: 'center',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    gap: 3,
    justifyContent: 'space-between',
    minHeight: 14,
    paddingBlock: 3,
    paddingInline: 4,
    textAlign: 'left',
    width: '100% !custom',
    ':hover': { backgroundColor: 'light-dark(#f5f5f5, #111) !custom' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.600',
      outlineOffset: '-4px',
    },
  })

  export const copyStatus = style({
    typography: 'copy.13',
    color: 'gray.900',
    paddingTop: 2,
  })

  export const copySuccess = style({
    color: '#3be0af !custom',
  })

  export const install = style({
    backgroundColor: 'light-dark(#fff, #000) !custom',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    marginTop: 10,
    maxWidth: 'md',
    overflow: 'hidden',
    '&[data-expanded="true"]': {
      marginBlock: 6,
      maxWidth: 'none !custom',
      width: '100% !custom',
    },
  })

  export const installHeader = style({
    borderBottom: '1px solid',
    borderBottomColor: 'gray.400',
    display: 'flex',
    gap: 2,
    paddingInline: 3,
  })

  export const manager = style({
    typography: 'button.14',
    alignItems: 'center',
    borderBottom: '2px solid transparent',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'inline-flex',
    gap: 2,
    paddingBlock: 2,
    paddingInline: 3,
    '&[aria-pressed="true"]': {
      borderBottomColor: 'light-dark(#171717, #fff) !custom',
      color: 'foreground',
    },
    ':hover': { color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'gray.600',
      outlineOffset: '-4px',
    },
  })
}
