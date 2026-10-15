/** Owns the playground editor, compiler worker, share links, and isolated React preview. @module */
import { Select } from '@base-ui/react/select'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { appearance } from 'zyzz/default'
import CheckIcon from '~icons/lucide/check'
import ChevronsUpDownIcon from '~icons/lucide/chevrons-up-down'
import LinkIcon from '~icons/lucide/link'
import PlusIcon from '~icons/lucide/plus'
import XIcon from '~icons/lucide/x'
import JavaScriptIcon from '~icons/simple-icons/javascript'
import ReactIcon from '~icons/simple-icons/react'
import TypeScriptIcon from '~icons/simple-icons/typescript'
import { Button } from '../components/Button.js'
import { Link } from '../components/Link.js'
import { ThemeToggle } from '../components/ThemeToggle.js'
import { style } from '../zyzz.config.js'
import type * as Compiler from './Compiler.js'
import type * as WorkerProtocol from './Compiler.worker.js'
import type * as Preview from './Preview.js'
import * as Project from './Project.js'

const CodeEditor = lazy(() => import('./CodeEditor.js'))
type PreviewClient = Awaited<ReturnType<typeof Preview.create>>

/** Renders the interface immediately while editor, compiler, and preview load independently. */
export default function Playground() {
  const [ready, setReady] = useState(false)
  const [project, setProject] = useState(() => Project.create('Styles'))
  const { files, framework, order } = project
  const [active, setActive] = useState('App.tsx')
  const [addingFile, setAddingFile] = useState(false)
  const [filename, setFilename] = useState('')
  const [fileError, setFileError] = useState('')
  const [fileNotice, setFileNotice] = useState('')
  const [dragging, setDragging] = useState<string>()
  const [dropTarget, setDropTarget] = useState<string>()
  const newFileButton = useRef<HTMLButtonElement>(null)
  const newFileInput = useRef<HTMLInputElement>(null)
  const [example, setExample] = useState('Styles')
  const [tab, setTab] = useState('Preview')
  const [scheme, setScheme] = useState<ThemeToggle.Scheme>('light dark')
  const [systemDark, setSystemDark] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [output, setOutput] = useState<Compiler.Output>()
  const hasOutput = Boolean(output)
  const [restart, setRestart] = useState(0)
  const [previewError, setPreviewError] = useState('')
  const [previewReady, setPreviewReady] = useState(false)
  const client = useRef<PreviewClient | undefined>(undefined)
  const iframe = useRef<HTMLIFrameElement>(null)
  const latest = useRef<Compiler.Output | undefined>(undefined)
  const sequence = useRef(0)
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const worker = useRef<Worker | undefined>(undefined)
  const editorTheme =
    scheme === 'dark' || (scheme === 'light dark' && systemDark)
      ? 'tempo'
      : 'tempo-light'

  useEffect(() => {
    // Restore the URL before compiling or replacing it with the default example.
    try {
      const input = new URLSearchParams(location.hash.slice(1)).get('code')
      if (input) {
        const restored = Project.decode(input)
        setProject(restored)
        setActive(Project.entryFiles[restored.framework])
        const matching = Object.keys(Project.examples).find(
          (name) =>
            JSON.stringify(Project.create(name)) === JSON.stringify(restored),
        )
        setExample(matching ?? '')
      }
    } catch (error) {
      setNotice(`Could not restore this link: ${String(error)}`)
    }
    const current = appearance.get().colorScheme
    setScheme(
      current === 'light' || current === 'dark' ? current : 'light dark',
    )
    setReady(true)
  }, [])

  useEffect(() => {
    if (addingFile) newFileInput.current?.focus()
  }, [addingFile])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!ready) return
    const instance = new Worker(
      new URL('./Compiler.worker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.current = instance
    instance.onmessage = (event: MessageEvent<WorkerProtocol.Response>) => {
      if (event.data.id !== sequence.current) return
      clearTimeout(timeout.current)
      setError(event.data.error ?? '')
      if (event.data.output) setOutput(event.data.output)
    }
    instance.onerror = (event) => {
      clearTimeout(timeout.current)
      setError(
        event.message ||
          'The compiler worker could not start. Try restarting it.',
      )
    }
    return () => {
      clearTimeout(timeout.current)
      instance.terminate()
    }
  }, [ready, restart])

  useEffect(() => {
    if (!ready) return
    const id = ++sequence.current
    clearTimeout(timeout.current)
    const timer = setTimeout(() => {
      worker.current?.postMessage({
        files,
        id,
      } satisfies WorkerProtocol.Request)
      timeout.current = setTimeout(() => {
        worker.current?.terminate()
        setError(
          'Compilation timed out. Edit the source and restart the compiler.',
        )
      }, 15_000)
    }, 200)
    return () => clearTimeout(timer)
  }, [files, ready, restart])

  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => {
      history.replaceState(
        history.state,
        '',
        `${location.pathname}${location.search}#code=${Project.encode(project)}`,
      )
    }, 200)
    return () => clearTimeout(timer)
  }, [project, ready])

  useEffect(() => {
    latest.current = output
    if (output) client.current?.update(output)
  }, [output])

  useEffect(() => {
    const initial = latest.current
    if (!ready || !initial) return
    setPreviewReady(false)
    let disposed = false
    let owned: PreviewClient | undefined
    const frame = iframe.current!
    void import('./Preview.js')
      .then((Preview) => {
        if (disposed) return
        return Preview.create(frame, {
          framework,
          onError: (message) => {
            if (!disposed) setPreviewError(message)
          },
          onReady: () => {
            if (!disposed) setPreviewReady(true)
          },
          output: initial,
        })
      })
      .then((instance) => {
        if (!instance) return
        if (disposed) {
          instance.destroy()
          return
        }
        owned = instance
        client.current = instance
        if (latest.current && latest.current !== initial)
          instance.update(latest.current)
      })
      .catch((error: unknown) => {
        if (!disposed) setPreviewError(`Preview unavailable: ${String(error)}`)
      })
    return () => {
      disposed = true
      owned?.destroy()
      client.current = undefined
    }
  }, [framework, hasOutput, ready])

  async function share() {
    const url = new URL(location.href)
    url.hash = `code=${Project.encode(project)}`
    history.replaceState(history.state, '', url)
    try {
      await navigator.clipboard.writeText(url.href)
      setCopied(true)
      setNotice('')
    } catch {
      setNotice(
        'The share link is in the address bar. Copy it to share this project.',
      )
    }
  }

  function choose(name: string) {
    if (
      JSON.stringify(files) !==
        JSON.stringify(Project.examples[example]?.files) &&
      !confirm(
        'Replace the current files? Copy a share link first to keep them.',
      )
    )
      return
    setExample(name)
    const next = Project.create(name)
    setProject(next)
    setActive(Project.entryFiles[next.framework])
    setOutput(undefined)
    setPreviewError('')
    setPreviewReady(false)
    setAddingFile(false)
    setFileError('')
    setError('')
    setNotice('')
  }

  function moveFile(path: string, target: string) {
    const next = [...order]
    const from = next.indexOf(path)
    const to = next.indexOf(target)
    if (from < 0 || to < 0 || from === to) return
    next.splice(from, 1)
    next.splice(to, 0, path)
    setProject((previous) => ({ ...previous, order: next }))
    setFileNotice(`${path} moved to position ${to + 1} of ${next.length}.`)
  }

  function cancelFile() {
    setAddingFile(false)
    setFileError('')
    newFileButton.current?.focus()
  }

  const sourceFallback = (
    <textarea
      aria-label={`${active} source`}
      onChange={(event) =>
        setProject((previous) => ({
          ...previous,
          files: { ...previous.files, [active]: event.target.value },
        }))
      }
      readOnly={!ready}
      spellCheck={false}
      value={files[active] ?? ''}
      {...styles.sourceFallback()}
    />
  )
  const outputSource =
    tab === 'CSS' ? (output?.css ?? '') : (output?.files[active] ?? '')

  return (
    <main data-initializing={!ready || undefined} {...styles.page()}>
      <header {...styles.header()}>
        <div {...styles.identity()}>
          <Link aria-label="Zyzz home" href="/" {...styles.logo()}>
            <svg
              aria-hidden="true"
              width="80"
              height="24"
              viewBox="12 24 233 64"
              fill="none"
            >
              <path
                d="M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256ZM101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88ZM127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687ZM183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z"
                fill="currentColor"
              />
            </svg>
          </Link>
          <span {...styles.divider()}>/</span>
          <h1 {...styles.title()}>Playground</h1>
        </div>
        <div {...styles.actions()}>
          <Link href="/docs/introduction/getting-started" {...styles.docs()}>
            Docs
          </Link>
          <Button
            aria-label={copied ? 'Link copied' : 'Copy share link'}
            disabled={!ready}
            onClick={() => void share()}
            variant="secondary"
            {...styles.share()}
          >
            {copied ? (
              <CheckIcon aria-hidden="true" {...styles.shareIcon()} />
            ) : (
              <LinkIcon aria-hidden="true" {...styles.shareIcon()} />
            )}
            <span aria-live="polite">{copied ? 'Copied' : 'Share'}</span>
          </Button>
        </div>
      </header>
      {notice && (
        <div role="status" {...styles.notice()}>
          {notice}
        </div>
      )}
      <div {...styles.workspace()}>
        <section aria-label="Source editor" {...styles.pane()}>
          <div aria-label="Source files" {...styles.tabs()}>
            {order.map((path) => (
              <Button
                aria-pressed={active === path}
                aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
                title={`${path}: drag to reorder, or use Alt+Left/Right`}
                data-file={path}
                data-dragging={dragging === path || undefined}
                data-drop-target={dropTarget === path || undefined}
                draggable={ready}
                onDragStart={(event) => {
                  event.dataTransfer.setData('text/plain', path)
                  event.dataTransfer.effectAllowed = 'move'
                  setDragging(path)
                }}
                onDragOver={(event) => {
                  if (!dragging) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropTarget(path)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragging) moveFile(dragging, path)
                  setDragging(undefined)
                  setDropTarget(undefined)
                }}
                onDragEnd={() => {
                  setDragging(undefined)
                  setDropTarget(undefined)
                }}
                onKeyDown={(event) => {
                  if (
                    !event.altKey ||
                    !['ArrowLeft', 'ArrowRight'].includes(event.key)
                  )
                    return
                  event.preventDefault()
                  const target =
                    order[
                      order.indexOf(path) + (event.key === 'ArrowLeft' ? -1 : 1)
                    ]
                  if (target) moveFile(path, target)
                }}
                key={path}
                onClick={() => setActive(path)}
                variant="ghost"
                {...styles.tab()}
              >
                {(() => {
                  const Icon = (() => {
                    if (path.endsWith('x') && framework === 'react')
                      return ReactIcon
                    return /\.jsx?$/.test(path)
                      ? JavaScriptIcon
                      : TypeScriptIcon
                  })()
                  return <Icon aria-hidden="true" {...styles.fileIcon()} />
                })()}
                {path}
              </Button>
            ))}
            <Button
              aria-label="New file"
              title="New file"
              disabled={!ready || order.length >= 20}
              ref={newFileButton}
              onClick={() => {
                setFilename('')
                setFileError('')
                setAddingFile(true)
              }}
              variant="ghost"
              {...styles.addFile()}
            >
              <PlusIcon aria-hidden="true" {...styles.icon()} />
            </Button>
          </div>
          {addingFile && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const name = filename.trim()
                try {
                  setProject(Project.addFile(project, name))
                  setActive(name)
                  setAddingFile(false)
                  setFileError('')
                  setFileNotice(`${name} created.`)
                  newFileButton.current?.focus()
                } catch (error) {
                  setFileError(
                    error instanceof Error ? error.message : String(error),
                  )
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelFile()
              }}
              {...styles.fileForm()}
            >
              <div {...styles.fileFields()}>
                <input
                  aria-label="Filename"
                  aria-invalid={Boolean(fileError)}
                  aria-describedby={fileError ? 'file-error' : undefined}
                  autoComplete="off"
                  placeholder="Button.tsx"
                  ref={newFileInput}
                  value={filename}
                  onChange={(event) => {
                    setFilename(event.target.value)
                    setFileError('')
                  }}
                  {...styles.filename()}
                />
                <Button type="submit" variant="secondary" {...styles.share()}>
                  Create
                </Button>
                <Button
                  aria-label="Cancel new file"
                  variant="ghost"
                  size="icon"
                  onClick={cancelFile}
                >
                  <XIcon aria-hidden="true" {...styles.icon()} />
                </Button>
              </div>
              {fileError && (
                <div id="file-error" role="alert" {...styles.fileError()}>
                  {fileError}
                </div>
              )}
            </form>
          )}
          <span role="status" {...styles.srOnly()}>
            {fileNotice}
          </span>
          <div {...styles.editor()}>
            <Suspense fallback={sourceFallback}>
              {ready ? (
                <CodeEditor
                  language="typescript"
                  loading={sourceFallback}
                  onChange={(value) =>
                    setProject((previous) => {
                      const source = value ?? ''
                      // Model switches can report unchanged text. Do not restart the preview.
                      if (previous.files[active] === source) return previous
                      return {
                        ...previous,
                        files: { ...previous.files, [active]: source },
                      }
                    })
                  }
                  options={{
                    ariaLabel: `${active} source`,
                  }}
                  path={`file:///${active}`}
                  theme={editorTheme}
                  value={files[active] ?? ''}
                />
              ) : (
                sourceFallback
              )}
            </Suspense>
          </div>
        </section>
        <section aria-label="Compiler output" {...styles.pane()}>
          <div aria-label="Output views" {...styles.tabs()}>
            {['Preview', 'CSS', 'Compiled'].map((name) => (
              <Button
                aria-pressed={tab === name}
                key={name}
                onClick={() => setTab(name)}
                variant="ghost"
                {...styles.tab()}
              >
                {name}
              </Button>
            ))}
          </div>
          <div hidden={tab !== 'Preview'} {...styles.preview()}>
            {previewError && (
              <div role="alert" {...styles.notice()}>
                {previewError}
              </div>
            )}
            <iframe
              data-ready={previewReady || undefined}
              key={framework}
              ref={iframe}
              sandbox="allow-scripts allow-same-origin"
              title="Live preview"
              {...styles.frame()}
            />
          </div>
          {tab !== 'Preview' && (
            <div {...styles.editor()}>
              <Suspense
                fallback={
                  <pre {...styles.sourceFallback()}>{outputSource}</pre>
                }
              >
                <CodeEditor
                  language={tab === 'CSS' ? 'css' : 'typescript'}
                  loading={
                    <pre {...styles.sourceFallback()}>{outputSource}</pre>
                  }
                  options={{
                    ariaLabel:
                      tab === 'CSS' ? 'Generated CSS' : 'Compiled source',
                    domReadOnly: true,
                    readOnly: true,
                  }}
                  path={`file:///output/${tab === 'CSS' ? 'styles.css' : active}`}
                  theme={editorTheme}
                  value={outputSource}
                />
              </Suspense>
            </div>
          )}
        </section>
      </div>
      {error && (
        <div role="alert" {...styles.error()}>
          <div>
            <strong>Could not compile</strong>
            <pre>{error}</pre>
            <span>
              {output
                ? 'The last successful output is still shown.'
                : 'Fix the source to start the preview.'}
            </span>
          </div>
          <Button
            onClick={() => setRestart((value) => value + 1)}
            variant="secondary"
          >
            Restart compiler
          </Button>
        </div>
      )}
      <footer {...styles.footer()}>
        <Select.Root<string>
          value={example || null}
          onValueChange={(value) => {
            if (value) choose(value)
          }}
          disabled={!ready}
        >
          <Select.Trigger
            aria-label="Example"
            render={<Button variant="ghost" />}
            {...styles.exampleTrigger()}
          >
            <span {...styles.exampleLabel()}>Example</span>
            <Select.Value placeholder="Custom" />
            <Select.Icon>
              <ChevronsUpDownIcon aria-hidden="true" {...styles.icon()} />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner
              align="start"
              alignItemWithTrigger={false}
              side="top"
              sideOffset={8}
              {...styles.positioner()}
            >
              <Select.Popup {...styles.examplePopup()}>
                <Select.List>
                  {Object.entries(Project.examples).map((entry) => {
                    const [name, project] = entry
                    return (
                      <Select.Item
                        key={name}
                        value={name}
                        label={name}
                        aria-describedby={`example-${encodeURIComponent(name)}-description`}
                        {...styles.exampleItem()}
                      >
                        <div {...styles.exampleText()}>
                          <Select.ItemText {...styles.exampleName()}>
                            {name}
                          </Select.ItemText>
                          <div
                            id={`example-${encodeURIComponent(name)}-description`}
                            {...styles.exampleDescription()}
                          >
                            {project.description}
                          </div>
                        </div>
                        <Select.ItemIndicator>
                          <CheckIcon aria-hidden="true" {...styles.icon()} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    )
                  })}
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
        <ThemeToggle
          onValueChange={(value) => {
            appearance.set({ colorScheme: value })
            setScheme(value)
          }}
          value={scheme}
        />
      </footer>
    </main>
  )
}

namespace styles {
  export const addFile = style({
    alignSelf: 'center',
    flexShrink: 0,
    height: 8,
    width: 8,
    padding: 0,
    borderRadius: 'md',
    '[data-initializing] &:disabled': {
      backgroundColor: 'transparent !custom',
      borderColor: 'transparent !custom',
      color: 'foreground',
    },
  })

  export const fileIcon = style({ height: 3, width: 3, color: 'gray.900' })

  export const fileForm = style({
    padding: 3,
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    backgroundColor: 'background.surface',
  })

  export const fileFields = style({
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  })

  export const filename = style({
    typography: 'copy.13',
    backgroundColor: 'background.primary',
    color: 'foreground',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    minWidth: 0,
    flex: 1,
    height: 8,
    paddingInline: 2,
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const fileError = style({
    typography: 'copy.13',
    color: 'red.900',
    marginTop: 2,
  })

  export const srOnly = style({
    position: 'absolute',
    width: '1px !custom',
    height: '1px !custom',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  })

  export const actions = style({
    alignItems: 'center',
    display: 'flex',
    gap: 3,
    whiteSpace: 'nowrap',
  })

  export const docs = style({
    typography: 'label.14',
    color: 'gray.900',
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })

  export const divider = style({ color: 'gray.700' })

  export const editor = style({ flex: 1, minHeight: 0, overflow: 'hidden' })

  export const error = style({
    alignItems: 'start',
    backgroundColor: 'background.surface',
    borderTop: '1px solid',
    borderColor: 'red.700',
    color: 'red.900',
    display: 'flex',
    gap: 4,
    justifyContent: 'space-between',
    maxHeight: 60,
    overflow: 'auto',
    padding: 4,
    '& pre': { fontSize: 'sm', marginBlock: 2, whiteSpace: 'pre-wrap' },
  })

  export const footer = style({
    alignItems: 'center',
    backgroundColor: 'background.surface',
    bottom: 0,
    color: 'gray.900',
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: 'xs',
    gap: 2,
    justifyContent: 'space-between',
    paddingBlock: 2,
    paddingInline: 4,
    position: 'sticky',
    zIndex: 2,
  })

  export const frame = style({
    backgroundColor: 'background.surface',
    border: 'none',
    height: '100% !custom',
    visibility: 'hidden',
    width: '100% !custom',
    '&[data-ready]': { visibility: 'visible' },
  })

  export const header = style({
    alignItems: 'center',
    backgroundColor: 'background.surface',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    flexShrink: 0,
    gap: 4,
    height: 16,
    justifyContent: 'space-between',
    paddingInline: 4,
    '@media (max-width: 700px)': { height: 14, paddingInline: 3, gap: 2 },
  })

  export const identity = style({
    alignItems: 'center',
    display: 'flex',
    gap: 3,
    '@media (max-width: 700px)': { gap: 2 },
  })

  export const icon = style({ height: 4, width: 4 })

  export const logo = style({
    color: 'foreground',
    display: 'block',
    lineHeight: '0 !custom',
    textDecoration: 'none',
    '@media (max-width: 700px)': { '& svg': { width: 16, height: 5 } },
  })

  export const notice = style({
    backgroundColor: 'background.surface',
    fontSize: 'sm',
    paddingBlock: 3,
    paddingInline: 6,
  })

  export const page = style({
    backgroundColor: 'background.primary',
    color: 'foreground',
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh !custom',
    minHeight: '600px !custom',
    '@media (max-width: 760px)': {
      height: 'auto !custom',
      minHeight: '100dvh !custom',
    },
  })

  export const pane = style({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    '& + &': { borderLeft: '1px solid', borderColor: 'gray.400' },
    '@media (max-width: 760px)': {
      height: '520px !custom',
      '& + &': {
        borderLeft: 'none',
        borderTop: '1px solid',
        borderColor: 'gray.400',
      },
    },
  })

  export const preview = style({
    backgroundColor: 'background.surface',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    '&[hidden]': { display: 'none' },
  })

  export const exampleTrigger = style({
    typography: 'label.14',
    borderRadius: 'md',
    gap: 2,
    height: 8,
    paddingBlock: 0,
    paddingInline: 2,
    '[data-initializing] &:disabled': {
      backgroundColor: 'transparent !custom',
      borderColor: 'transparent !custom',
      color: 'foreground',
    },
    '&[aria-expanded="true"]': { backgroundColor: 'grayAlpha.200' },
  })

  export const exampleLabel = style({ color: 'gray.900' })

  export const exampleName = style({
    typography: 'label.14',
    color: 'foreground',
  })

  export const exampleDescription = style({
    typography: 'copy.13',
    color: 'gray.900',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  })

  export const exampleText = style({ minWidth: 0 })

  export const exampleItem = style({
    alignItems: 'center',
    borderRadius: 'md',
    cursor: 'pointer',
    display: 'flex',
    gap: 3,
    justifyContent: 'space-between',
    paddingBlock: 2,
    paddingInline: 2,
    outline: 'none',
    userSelect: 'none',
    '&[data-highlighted]': { backgroundColor: 'grayAlpha.200' },
  })

  export const examplePopup = style({
    backgroundColor: 'background.primary',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'lg',
    boxShadow: 'lg',
    color: 'foreground',
    maxHeight: 'var(--available-height) !custom',
    maxWidth: 'calc(100vw - 32px) !custom',
    overflowY: 'auto',
    padding: 1,
    width: 72,
  })

  export const positioner = style({ zIndex: 3 })

  export const sourceFallback = style({
    backgroundColor: 'background.surface',
    border: 'none',
    borderRadius: '0 !custom',
    color: 'foreground',
    fontFamily: 'mono',
    fontSize: '15px !custom',
    height: '100% !custom',
    lineHeight: '24px !custom',
    margin: 0,
    overflow: 'auto',
    padding: 5,
    // Reserve Monaco's five-digit gutter and folding controls before it loads.
    paddingInlineStart: 'calc(5ch + 26px) !custom',
    resize: 'none',
    tabSize: 2,
    width: '100% !custom',
  })

  export const share = style({
    typography: 'label.14',
    borderRadius: 'md',
    gap: 1,
    height: 8,
    paddingBlock: 0,
    paddingInline: 2,
    '[data-initializing] &:disabled': {
      backgroundColor: 'background.primary',
      color: 'foreground',
    },
  })

  export const shareIcon = style({ height: 3, width: 3 })

  export const tab = style({
    borderRadius: '0 !custom',
    borderBottom: '2px solid transparent',
    typography: 'label.14',
    flexShrink: 0,
    gap: 2,
    whiteSpace: 'nowrap',
    paddingBlock: 3,
    paddingInline: 4,
    '&[aria-pressed="true"]': { borderBottomColor: 'foreground' },
    '&[data-dragging]': { opacity: 0.5 },
    '&[data-drop-target]': { boxShadow: 'inset 2px 0 currentColor !custom' },
  })

  export const tabs = style({
    backgroundColor: 'background.surface',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    flexShrink: 0,
    overflowX: 'auto',
    paddingInline: 2,
  })

  export const title = style({
    fontSize: 'sm',
    fontWeight: 'medium',
    margin: 0,
  })

  export const workspace = style({
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'grid',
    flex: 1,
    gridTemplateColumns: '1fr 1fr',
    minHeight: 0,
    '@media (max-width: 760px)': { gridTemplateColumns: '1fr' },
  })
}
