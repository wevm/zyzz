/** Previews the default variables and their values. @module */
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { appearance, tokens } from 'zyzz/default'
import ALargeSmallIcon from '~icons/lucide/a-large-small'
import BlendIcon from '~icons/lucide/blend'
import BoldIcon from '~icons/lucide/bold'
import BoxIcon from '~icons/lucide/box'
import CaseSensitiveIcon from '~icons/lucide/case-sensitive'
import LayersIcon from '~icons/lucide/layers'
import MonitorIcon from '~icons/lucide/monitor'
import MoonIcon from '~icons/lucide/moon'
import MoveHorizontalIcon from '~icons/lucide/move-horizontal'
import MoveVerticalIcon from '~icons/lucide/move-vertical'
import PaletteIcon from '~icons/lucide/palette'
import PanelsTopLeftIcon from '~icons/lucide/panels-top-left'
import PlayIcon from '~icons/lucide/play'
import ProportionsIcon from '~icons/lucide/proportions'
import RadiusIcon from '~icons/lucide/radius'
import RulerIcon from '~icons/lucide/ruler'
import SplineIcon from '~icons/lucide/spline'
import SquareDashedIcon from '~icons/lucide/square-dashed'
import SunIcon from '~icons/lucide/sun'
import TextIcon from '~icons/lucide/text'
import TypeIcon from '~icons/lucide/type'
import { style } from '../zyzz.config.js'
import * as Variables from '../Variables.js'
import type { Entry } from '../Variables.js'

/** Renders default or supplied variables using the site's own theme. */
export function Page({
  config,
  error,
}: {
  config?: Variables.Configuration | undefined
  error?: string | undefined
}) {
  const groups = Object.entries(config?.vars ?? tokens)
    .sort(([a], [b]) => {
      if (a === 'color' || b === 'color') return a === 'color' ? -1 : 1
      if (a === 'typography' || b === 'typography')
        return a === 'typography' ? -1 : 1
      return a.localeCompare(b)
    })
    .map(([name, value]) => {
      const entries = Variables.collect(value, [name], config?.mappings)
      const units = new Set(
        entries
          .filter((entry) => ['breakpoint', 'container'].includes(entry.kind))
          .map((entry) => String(entry.value).replace(/^[\d.]+/, '')),
      )
      const maximum =
        units.size > 1
          ? 0
          : Math.max(
              0,
              ...entries
                .filter((entry) =>
                  ['breakpoint', 'container'].includes(entry.kind),
                )
                .map((entry) => Number.parseFloat(String(entry.value)))
                .filter(Number.isFinite),
            )
      return {
        ...(categories[name as keyof typeof categories] ?? {
          icon: BoxIcon,
          title: title(name),
        }),
        color:
          entries.length > 0 &&
          entries.every((entry) => entry.kind === 'color'),
        entries,
        maximum,
        name,
      }
    })

  const [category, setCategory] = useState('color')
  const [colorScheme, setColorScheme] = useState<
    'light' | 'dark' | 'light dark'
  >('light dark')
  const [query, setQuery] = useState('')
  const [systemDark, setSystemDark] = useState(false)
  const [schemeReady, setSchemeReady] = useState(false)
  const header = useRef<HTMLElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const sections = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  useEffect(() => {
    const scheme = appearance.get().colorScheme
    setColorScheme(
      scheme === 'light' || scheme === 'dark' ? scheme : 'light dark',
    )
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update()
    setSchemeReady(true)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const dark =
    colorScheme === 'dark' || (colorScheme === 'light dark' && systemDark)
  const search = query.trim().toLowerCase()
  const filtered = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => {
        const fields =
          typeof entry.value === 'object'
            ? Object.keys(entry.value)
                .map((key) => reference([...entry.path, key]))
                .join(' ')
            : ''
        return `${group.title} ${title(entry.path[1] ?? '')} ${entry.path.join('.')} ${reference(entry.path)} ${JSON.stringify(entry.raw ?? entry.value)} ${entry.dark ?? ''} ${entry.condition ?? ''} ${fields}`
          .toLowerCase()
          .includes(search)
      }),
    }))
    .filter((group) => group.entries.length > 0)
    .map((group) => ({
      ...group,
      sections: [
        ...new Set(
          group.entries.map((entry) =>
            entry.path.length > 2 ? entry.path[1] : '',
          ),
        ),
      ]
        .sort((a, b) => (a ?? '').localeCompare(b ?? ''))
        .map((name) => ({
          name,
          id: [group.name, name].filter(Boolean).join('-'),
          entries: group.entries.filter(
            (entry) => (entry.path.length > 2 ? entry.path[1] : '') === name,
          ),
        })),
    }))

  useEffect(() => {
    const elements = Array.from(
      sections.current?.querySelectorAll<HTMLElement>(':scope > section[id]') ??
        [],
    )
    let frame = 0
    const update = () => {
      frame = 0
      const top = header.current?.getBoundingClientRect().bottom ?? 0
      let active = elements[0]
      for (const element of elements) {
        if (element.getBoundingClientRect().top > top + 1) break
        active = element
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 1
      )
        active = elements.at(-1)
      setCategory(active?.id ?? '')
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('hashchange', schedule)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('hashchange', schedule)
    }
  }, [search])

  return (
    <div {...styles.canvas()}>
      {error ? (
        <div role="alert" {...styles.sectionContent()}>
          <h1 {...styles.sectionHeading()}>Could not read variables</h1>
          <p>{error}</p>
          <a href="/vars">View default variables</a>
        </div>
      ) : (
        <div {...styles.page()}>
          <header ref={header} {...styles.header()}>
            <div {...styles.headerBrand()}>
              {config?.name ? (
                <span title={config.name} {...styles.brandName()}>
                  {config.name}
                </span>
              ) : (
                <a aria-label="Zyzz home" href="/" {...styles.brand()}>
                  <svg
                    aria-hidden="true"
                    width="96"
                    height="43"
                    viewBox="0 0 255 114"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.7256 88L14.5713 79.0352L54.6494 36.1885V35.9248H24.5908L26.9639 24.5869H73.7217L71.876 33.5078L31.8418 76.3984V76.6621H63.4824L61.1533 88H12.7256ZM101.144 88H87.7842L92.7939 64.4893L79.1709 24.5869H93.0137L101.759 51.7451H102.022L121.974 24.5869H136.607L106.065 65.0166L101.144 88ZM127.687 88L129.532 79.0352L169.61 36.1885V35.9248H139.552L141.925 24.5869H188.683L186.837 33.5078L146.803 76.3984V76.6621H178.443L176.114 88H127.687ZM183.585 88L185.431 79.0352L225.509 36.1885V35.9248H195.45L197.823 24.5869H244.581L242.735 33.5078L202.701 76.3984V76.6621H234.342L232.013 88H183.585Z"
                      fill="currentColor"
                    />
                  </svg>
                </a>
              )}
              <span {...styles.variablesLabel()}>VARIABLES</span>
            </div>
            <div {...styles.headerTools()}>
              <div {...styles.searchControl()}>
                <input
                  aria-label="Find a variable"
                  id="variable-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search variables"
                  type="search"
                  ref={searchInput}
                  value={query}
                  {...styles.search()}
                />
                <kbd {...styles.shortcut()}>⌘K</kbd>
              </div>
              <div
                role="group"
                aria-label="Color scheme"
                {...styles.schemeControl()}
              >
                {(
                  [
                    {
                      label: 'System',
                      value: 'light dark',
                      icon: MonitorIcon,
                    },
                    {
                      label: 'Light',
                      value: 'light',
                      icon: SunIcon,
                    },
                    {
                      label: 'Dark',
                      value: 'dark',
                      icon: MoonIcon,
                    },
                  ] as const
                ).map((scheme) => (
                  <button
                    aria-label={scheme.label}
                    aria-pressed={colorScheme === scheme.value}
                    key={scheme.value}
                    onClick={() => {
                      appearance.set({ colorScheme: scheme.value })
                      setColorScheme(scheme.value)
                    }}
                    title={`${scheme.label} color scheme`}
                    type="button"
                    {...styles.schemeButton()}
                  >
                    <scheme.icon aria-hidden="true" height="16" width="16" />
                  </button>
                ))}
              </div>
            </div>
          </header>
          <main>
            <div {...styles.layout()}>
              <aside {...styles.sidebar()}>
                <nav aria-label="Variable categories" {...styles.navigation()}>
                  {filtered.map((group) => (
                    <a
                      aria-current={
                        category === group.name ? 'location' : undefined
                      }
                      href={`#${group.name}`}
                      key={group.name}
                      {...styles.category()}
                    >
                      <group.icon aria-hidden="true" width="16" height="16" />
                      <span>{group.title}</span>
                      <span {...styles.count()}>{group.entries.length}</span>
                    </a>
                  ))}
                </nav>
              </aside>
              <div ref={sections} {...styles.sections()}>
                {filtered.length === 0 && (
                  <p {...styles.description()}>
                    No variables match “{query}”. Try a category, such as color
                    or spacing.
                  </p>
                )}
                {filtered.map((group) => (
                  <section
                    aria-labelledby={`${group.name}-heading`}
                    id={group.name}
                    key={group.name}
                    {...styles.section()}
                  >
                    <div {...styles.sectionIntro()}>
                      <h2
                        id={`${group.name}-heading`}
                        {...styles.sectionHeading()}
                      >
                        {group.title}
                      </h2>
                    </div>
                    <div {...styles.sectionContent()}>
                      {group.sections.map((section) => (
                        <div
                          id={
                            section.id === group.name ? undefined : section.id
                          }
                          key={section.id}
                          {...styles.subsection()}
                        >
                          {(section.name || group.sections.length > 1) && (
                            <h3 {...styles.subheading()}>
                              {(() => {
                                if (section.name) return title(section.name)
                                if (group.color) return 'Standalone Colors'
                                return `${group.title} Values`
                              })()}
                            </h3>
                          )}
                          <dl
                            style={
                              group.color &&
                              section.entries.some(
                                (entry) => entry.path.length > 3,
                              )
                                ? {
                                    gridTemplateColumns:
                                      'repeat(auto-fit, minmax(0, 128px))',
                                  }
                                : undefined
                            }
                            {...(group.color
                              ? styles.palette()
                              : styles.entries())}
                          >
                            {section.entries.map((entry) => {
                              const name = reference(entry.path)
                              const value = dark
                                ? (entry.dark ?? entry.value)
                                : entry.value
                              return (
                                <div
                                  key={`${name}:${entry.condition ?? 'default'}`}
                                  {...(group.color
                                    ? styles.colorEntry()
                                    : styles.entry())}
                                >
                                  <dt {...styles.name()}>
                                    <code title={name}>
                                      {group.color
                                        ? entry.path.slice(2).join('.') ||
                                          entry.path.at(-1)
                                        : name}
                                    </code>
                                  </dt>
                                  <dd
                                    {...(group.color
                                      ? styles.colorValues()
                                      : styles.values())}
                                  >
                                    {entry.condition && (
                                      <span {...styles.hint()}>
                                        {entry.condition}
                                      </span>
                                    )}
                                    {typeof entry.value === 'object' ? (
                                      <div {...styles.typography()}>
                                        <div
                                          data-typography={entry.path
                                            .slice(1)
                                            .join('.')}
                                          style={entry.value}
                                          {...styles.sample()}
                                        >
                                          {entry.path[1] === 'copy'
                                            ? 'Write type-safe styles, variables, and themes. Compile to static CSS. Keep your styles close to your code.'
                                            : 'Styles that scale.'}
                                        </div>
                                        <details {...styles.details()}>
                                          <summary>Variables</summary>
                                          <dl>
                                            {Object.entries(entry.value).map(
                                              ([key, value]) => (
                                                <div
                                                  key={key}
                                                  {...styles.field()}
                                                >
                                                  <dt>
                                                    <code>
                                                      {reference([
                                                        ...entry.path,
                                                        key,
                                                      ])}
                                                    </code>
                                                  </dt>
                                                  <dd>
                                                    <code>
                                                      {typeof value === 'object'
                                                        ? JSON.stringify(value)
                                                        : String(value)}
                                                    </code>
                                                  </dd>
                                                </div>
                                              ),
                                            )}
                                          </dl>
                                        </details>
                                      </div>
                                    ) : (
                                      <>
                                        {!group.color && (
                                          <Preview
                                            category={entry.kind}
                                            maximum={group.maximum}
                                            entry={entry}
                                          />
                                        )}
                                        <div
                                          {...(group.color
                                            ? styles.colorValue()
                                            : styles.value())}
                                        >
                                          {group.color && (
                                            <span
                                              aria-hidden="true"
                                              {...styles.swatch()}
                                              style={{
                                                backgroundColor: entry.dark
                                                  ? `light-dark(${String(entry.value)}, ${entry.dark})`
                                                  : String(value),
                                              }}
                                            />
                                          )}
                                          <div
                                            style={
                                              entry.dark && !schemeReady
                                                ? { visibility: 'hidden' }
                                                : undefined
                                            }
                                            {...(group.color
                                              ? styles.colorRaw()
                                              : styles.raw())}
                                          >
                                            <code>{String(value)}</code>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </dd>
                                </div>
                              )
                            })}
                          </dl>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  )
}

namespace styles {
  export const brand = style({
    color: 'foreground',
    display: 'block',
    textDecoration: 'none',
  })

  export const brandName = style({
    typography: 'heading.20',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  })

  export const canvas = style({
    backgroundColor: 'background.primary',
    minHeight: '100vh !custom',
  })

  export const category = style({
    typography: 'label.14',
    alignItems: 'center',
    borderRadius: 'md',
    color: 'gray.900',
    display: 'flex',
    gap: 3,
    paddingBlock: 2,
    paddingInline: 3,
    textDecoration: 'none',
    '& svg': { flexShrink: 0 },
    ':hover': { backgroundColor: 'gray.100', color: 'foreground' },
    '&[aria-current="location"]': {
      backgroundColor: 'gray.200',
      color: 'foreground',
    },
  })

  export const colorEntry = style({
    alignContent: 'start',
    display: 'grid',
    gap: 3,
    maxWidth: '100% !custom',
    minWidth: 0,
    paddingBlock: 4,
  })

  export const colorRaw = style({
    typography: 'label.12.mono',
    color: 'gray.900',
    overflowWrap: 'anywhere',
  })

  export const colorValue = style({
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  })

  export const colorValues = style({
    display: 'grid',
    gap: 3,
    margin: 0,
    minWidth: 0,
  })

  export const count = style({
    typography: 'label.12',
    color: 'gray.900',
    marginLeft: 'auto !custom',
  })

  export const description = style({
    typography: 'copy.16',
    color: 'gray.900',
    marginTop: 2,
    maxWidth: '2xl',
  })

  export const details = style({
    typography: 'copy.13',
    color: 'gray.900',
    marginTop: 4,
    '& summary': { cursor: 'pointer' },
    '& dl': { marginTop: 3 },
    '& code': { fontFamily: 'mono' },
  })

  export const entries = style({
    margin: 0,
  })

  export const entry = style({
    borderBottom: '1px solid',
    borderColor: 'gray.200',
    display: 'grid',
    gap: 4,
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    paddingBlock: 4,
    '@media (max-width: 900px)': { gridTemplateColumns: 'minmax(0, 1fr)' },
  })

  export const field = style({
    display: 'grid',
    gap: 2,
    marginTop: 3,
    overflowWrap: 'anywhere',
    '& dd': { margin: 0 },
  })

  export const header = style({
    backgroundColor: 'background.surface',
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    display: 'grid',
    gridTemplateColumns: '252px minmax(0, 1fr)',
    height: 16,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    '@media (max-width: 700px)': { gridTemplateColumns: 'auto minmax(0, 1fr)' },
  })

  export const headerBrand = style({
    alignItems: 'center',
    display: 'flex',
    gap: 2,
    paddingInline: 4,
    '@media (max-width: 700px)': {
      paddingInline: 2,
      '& svg': { width: 20, height: 'auto !custom' },
    },
  })

  export const headerTools = style({
    alignItems: 'center',
    borderLeft: '1px solid',
    borderColor: 'gray.400',
    display: 'flex',
    gap: 4,
    justifyContent: 'space-between',
    paddingInline: 4,
    '@media (max-width: 700px)': { gap: 2, paddingInline: 2 },
  })

  export const hint = style({
    typography: 'label.12',
    color: 'gray.900',
    marginLeft: 'auto !custom',
  })

  export const layout = style({
    alignItems: 'start',
    display: 'grid',
    gridTemplateColumns: '252px minmax(0, 1fr)',
    '@media (max-width: 700px)': {
      gridTemplateColumns: 'minmax(0, 1fr)',
    },
  })

  export const name = style({
    typography: 'label.13.mono',
    overflowWrap: 'anywhere',
  })

  export const navigation = style({
    display: 'grid',
    gap: 1,
    '@media (max-width: 700px)': { display: 'flex', flexWrap: 'wrap', gap: 4 },
  })

  export const page = style({
    backgroundColor: 'background.surface',
    borderInline: '1px solid',
    borderColor: 'gray.400',
    color: 'foreground',
    fontFamily: 'sans',
    marginInline: 'auto !custom',
    maxWidth: '7xl',
    minHeight: '100vh !custom',
    width: 'calc(100% - 48px) !custom',
    '@media (max-width: 600px)': { width: '100% !custom' },
  })

  export const palette = style({
    display: 'grid',
    gap: 3,
    gridTemplateColumns: 'repeat(auto-fit, minmax(0, 80px))',
    margin: 0,
  })

  export const preview = style({
    alignItems: 'center',
    display: 'flex',
    minHeight: 24,
    overflow: 'hidden',
    padding: 4,
    width: '100% !custom',
    '&[data-text="true"]': { minHeight: 0, overflow: 'visible', padding: 0 },
    '&:hover [data-ease="true"], &:focus-visible [data-ease="true"]': {
      transform: 'translateX(100px)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '& *': { animation: 'none !custom !important', transition: 'none' },
    },
  })

  export const raw = style({ typography: 'copy.13.mono', color: 'gray.900' })

  export const sample = style({
    maxWidth: '100% !custom',
    overflowWrap: 'anywhere',
  })

  export const schemeButton = style({
    alignItems: 'center',
    backgroundColor: 'transparent !custom',
    border: '1px solid transparent',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    cursor: 'pointer',
    display: 'flex',
    height: 7,
    justifyContent: 'center',
    width: 7,
    ':hover': { color: 'foreground' },
    '&[aria-pressed="true"]': { borderColor: 'gray.400', color: 'foreground' },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const schemeControl = style({
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: '9999px !custom',
    display: 'flex',
    padding: 1,
    flexShrink: 0,
  })

  export const search = style({
    typography: 'label.14',
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    color: 'foreground',
    paddingBlock: 2,
    paddingLeft: 3,
    paddingRight: 12,
    width: '100% !custom',
    '@media (max-width: 700px)': { paddingRight: 3 },
    ':focus-visible': {
      outline: '2px solid',
      outlineColor: 'blue.900',
      outlineOffset: '2px',
    },
  })

  export const searchControl = style({
    maxWidth: 'xs',
    minWidth: 0,
    position: 'relative',
    width: '100% !custom',
  })

  export const shortcut = style({
    typography: 'label.12',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    color: 'gray.900',
    padding: 1,
    pointerEvents: 'none',
    position: 'absolute',
    right: 2,
    top: '50% !custom',
    transform: 'translateY(-50%)',
    '@media (max-width: 700px)': { display: 'none' },
  })

  export const section = style({
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    scrollMarginTop: 16,
  })

  export const sectionContent = style({
    padding: 12,
    '@media (max-width: 900px)': { padding: 6 },
  })

  export const sectionHeading = style({ typography: 'heading.32' })

  export const sectionIntro = style({
    borderBottom: '1px solid',
    borderColor: 'gray.400',
    padding: 12,
    '@media (max-width: 900px)': { padding: 6 },
  })

  export const sections = style({
    borderLeft: '1px solid',
    borderColor: 'gray.400',
    minHeight: 'calc(100dvh - 64px) !custom',
    minWidth: 0,
    '@media (max-width: 700px)': {
      borderLeft: 'none',
      borderTop: '1px solid',
      borderColor: 'gray.400',
    },
  })

  export const shape = style({
    backgroundColor: 'foreground',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    display: 'block',
    flexShrink: 0,
    height: 16,
    width: 16,
    '&[data-ease="true"]': {
      transitionProperty: 'transform',
      transitionDuration: '1s',
    },
  })

  export const sidebar = style({
    height: 'calc(100dvh - 64px) !custom',
    overflowY: 'auto',
    paddingBottom: 6,
    paddingInline: 4,
    paddingTop: 6,
    position: 'sticky',
    top: 16,
    '@media (max-width: 700px)': {
      height: 'auto !custom',
      position: 'static',
    },
  })

  export const subheading = style({
    typography: 'heading.20',
    marginBottom: 6,
    marginTop: 0,
  })

  export const subsection = style({
    marginTop: 8,
    scrollMarginTop: 16,
    ':first-child': { marginTop: 0 },
  })

  export const swatch = style({
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'sm',
    flexShrink: 0,
    height: 12,
    width: '100% !custom',
  })

  export const typography = style({ minWidth: 0, width: '100% !custom' })

  export const value = style({
    alignItems: 'start',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  })

  export const values = style({
    typography: 'copy.13',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    margin: 0,
    overflowWrap: 'anywhere',
  })

  export const variablesLabel = style({
    typography: 'label.12',
    backgroundColor: 'gray.200',
    borderRadius: '9999px !custom',
    color: 'gray.900',
    fontSize: '11px !custom',
    paddingBlock: 1,
    paddingInline: 2,
    whiteSpace: 'nowrap',
  })

  export const widthBar = style({
    backgroundColor: 'foreground',
    display: 'block',
    height: '100% !custom',
  })

  export const widthPreview = style({ paddingBlock: 4, width: '100% !custom' })

  export const widthTrack = style({
    backgroundColor: 'gray.200',
    border: '1px solid',
    borderColor: 'gray.400',
    borderRadius: 'md',
    height: 8,
    overflow: 'hidden',
    width: '100% !custom',
  })
}

function reference(path: readonly string[]) {
  return path.reduce((name, key) => {
    if (/^(0|[1-9]\d*)$/.test(key)) return `${name}[${key}]`
    if (/^[a-zA-Z_$][\w$]*$/.test(key)) return `${name}.${key}`
    return `${name}[${JSON.stringify(key)}]`
  }, 'vars')
}

function Preview({
  category,
  maximum,
  entry,
}: {
  category: string
  maximum: number
  entry: Entry
}) {
  if (typeof entry.value === 'object') return null
  const value = String(entry.value)
  if (
    category === 'columns' &&
    (!Number.isInteger(Number(value)) || Number(value) < 1)
  )
    return null

  if (category === 'breakpoint' || category === 'container') {
    if (!Number.isFinite(Number.parseFloat(value)) || maximum <= 0) return null
    return (
      <div aria-hidden="true" {...styles.widthPreview()}>
        <div {...styles.widthTrack()}>
          <span
            style={{ width: `${(Number.parseFloat(value) / maximum) * 100}%` }}
            {...styles.widthBar()}
          />
        </div>
      </div>
    )
  }

  const appearance: CSSProperties | undefined = (() => {
    switch (category) {
      case 'color':
        return {
          backgroundColor: entry.dark
            ? `light-dark(${value}, ${entry.dark})`
            : value,
        }
      case 'aspect':
        return { aspectRatio: value, height: 'auto', width: '128px' }
      case 'blur':
        return { filter: `blur(${value})` }
      case 'spacing':
        return { maxWidth: '100%', width: value }
      case 'dropShadow':
        return { filter: `drop-shadow(${value})` }
      case 'insetShadow':
      case 'shadow':
        return { boxShadow: value }
      case 'radius':
        return { borderRadius: value }
      case 'perspective':
        return { transform: `perspective(${value}) rotateY(30deg)` }
      case 'columns':
        return {
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(24, Number(value)))}, 1fr)`,
          gap: '4px',
          width: '100%',
          height: '48px',
          background: 'none',
        }
      case 'borderWidth':
        return {
          borderWidth: value,
          borderStyle: 'solid',
          borderColor: 'currentColor',
        }
      case 'fontFamily':
        return { fontFamily: value }
      case 'fontSize':
        return { fontSize: value, lineHeight: 1.2 }
      case 'fontWeight':
        return { fontWeight: Number(value) }
      case 'letterSpacing':
        return { letterSpacing: value }
      case 'lineHeight':
        return { lineHeight: value, whiteSpace: 'pre-line' }
      case 'textShadow':
        return { textShadow: value }
      case 'ease':
        return { transitionTimingFunction: value }
      case 'animate':
        return { animation: value }
      default:
        return undefined
    }
  })()
  if (!appearance) return null
  const text = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'letterSpacing',
    'lineHeight',
    'textShadow',
  ].includes(category)
  return (
    <div
      data-text={text}
      tabIndex={category === 'ease' ? 0 : undefined}
      aria-label={
        category === 'ease' ? 'Hover or focus to preview easing' : undefined
      }
      style={
        category === 'blur'
          ? { overflow: 'visible', padding: `calc(${value} * 2)` }
          : undefined
      }
      {...styles.preview()}
    >
      {category === 'columns' ? (
        <span style={appearance}>
          {Array.from(
            { length: Math.max(1, Math.min(24, Number(value))) },
            (_, index) => (
              <span
                key={index}
                style={{ backgroundColor: 'currentColor', opacity: 0.35 }}
              />
            ),
          )}
        </span>
      ) : text ? (
        <span style={appearance} {...styles.sample()}>
          {category === 'lineHeight'
            ? 'Styles for modern interfaces.\nKeep styles close to your code.'
            : 'Styles for modern interfaces'}
        </span>
      ) : (
        <span
          data-ease={category === 'ease'}
          style={appearance}
          {...styles.shape()}
        />
      )}
      {category === 'ease' && <span {...styles.hint()}>Hover or focus</span>}
    </div>
  )
}

const categories = {
  animate: { icon: PlayIcon, title: 'Animation' },
  aspect: { icon: ProportionsIcon, title: 'Aspect Ratio' },
  blur: { icon: BlendIcon, title: 'Blur' },
  breakpoint: { icon: MonitorIcon, title: 'Breakpoints' },
  color: { icon: PaletteIcon, title: 'Colors' },
  container: { icon: PanelsTopLeftIcon, title: 'Containers' },
  dropShadow: { icon: LayersIcon, title: 'Drop Shadow' },
  ease: { icon: SplineIcon, title: 'Easing' },
  fontFamily: { icon: TypeIcon, title: 'Font Family' },
  fontSize: { icon: CaseSensitiveIcon, title: 'Font Size' },
  fontWeight: { icon: BoldIcon, title: 'Font Weight' },
  insetShadow: { icon: SquareDashedIcon, title: 'Inset Shadow' },
  letterSpacing: { icon: MoveHorizontalIcon, title: 'Letter Spacing' },
  lineHeight: { icon: MoveVerticalIcon, title: 'Line Height' },
  perspective: { icon: BoxIcon, title: 'Perspective' },
  radius: { icon: RadiusIcon, title: 'Border Radius' },
  shadow: { icon: LayersIcon, title: 'Box Shadow' },
  spacing: { icon: RulerIcon, title: 'Spacing' },
  textShadow: { icon: ALargeSmallIcon, title: 'Text Shadow' },
  typography: { icon: TextIcon, title: 'Typography' },
} satisfies Record<
  keyof typeof tokens,
  { icon: typeof MonitorIcon; title: string }
>

function title(name: string): string {
  const labels: Record<string, string> = {
    button: 'Buttons',
    copy: 'Body Text',
    heading: 'Headings',
    label: 'Labels',
  }
  return (
    labels[name] ??
    name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  )
}
