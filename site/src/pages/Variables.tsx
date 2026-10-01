/** Previews the default variables and their values. @module */
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { appearance, tokens } from 'zyzz/default'
import { DocumentationShell } from '../components/DocumentationShell.js'
import { Link } from '../components/Link.js'
import ALargeSmallIcon from '~icons/lucide/a-large-small'
import BlendIcon from '~icons/lucide/blend'
import BoldIcon from '~icons/lucide/bold'
import BoxIcon from '~icons/lucide/box'
import CaseSensitiveIcon from '~icons/lucide/case-sensitive'
import LayersIcon from '~icons/lucide/layers'
import MonitorIcon from '~icons/lucide/monitor'
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
import TextIcon from '~icons/lucide/text'
import TypeIcon from '~icons/lucide/type'
import { SearchField } from '../components/SearchField.js'
import { style } from '../zyzz.config.js'
import * as Variables from '../Variables.js'
import type { Entry } from '../Variables.js'

/** Renders default or supplied variables using the site's own theme. */
export function Page(props: Page.Props) {
  const { config, error } = props

  const groups = Object.entries(config?.vars ?? tokens)
    .sort((entry, input) => {
      const [a] = entry
      const [b] = input

      if (a === 'color' || b === 'color') return a === 'color' ? -1 : 1
      if (a === 'typography' || b === 'typography')
        return a === 'typography' ? -1 : 1
      return a.localeCompare(b)
    })
    .map((input) => {
      const [name, value] = input

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
        ...(Object.hasOwn(categories, name)
          ? categories[name as keyof typeof categories]
          : { icon: BoxIcon, title: title(name) }),
        id: domId(['category', name]),
        color:
          entries.length > 0 &&
          entries.every((entry) => entry.kind === 'color'),
        entries,
        maximum,
        name,
      }
    })

  const [category, setCategory] = useState(domId(['category', 'color']))
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
        if (!search) return true
        const fields =
          typeof entry.value === 'object'
            ? Object.keys(entry.value)
                .map((key) => reference([...entry.path, key]))
                .join(' ')
            : ''
        return `${group.title} ${title(entry.path[1] ?? '')} ${entry.path.join('.')} ${reference(entry.path)} ${JSON.stringify(entry.value)} ${entry.dark ?? ''} ${entry.condition ?? ''} ${fields}`
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
          id: domId(['subsection', group.name, name ?? '']),
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
    <>
      {error ? (
        <div role="alert" {...variablesStyles.sectionContent()}>
          <h1 {...variablesStyles.sectionHeading()}>
            Could not read variables
          </h1>
          <p>{error}</p>
          <Link href="/vars">View default variables</Link>
        </div>
      ) : (
        <DocumentationShell
          headerRef={header}
          contentRef={sections}
          label="VARIABLES"
          name={config?.name}
          onSchemeChange={setColorScheme}
          navigation={
            <Link
              href="/docs/introduction/getting-started"
              {...variablesStyles.docs()}
            >
              Docs
            </Link>
          }
          search={
            <SearchField
              aria-label="Find a variable"
              id="variable-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search variables..."
              ref={searchInput}
              value={query}
            />
          }
          sidebar={
            <nav
              aria-label="Variable categories"
              {...variablesStyles.navigation()}
            >
              {filtered.map((group) => (
                <a
                  aria-current={category === group.id ? 'location' : undefined}
                  href={`#${group.id}`}
                  key={group.name}
                  {...variablesStyles.category()}
                >
                  <group.icon aria-hidden="true" width="16" height="16" />
                  <span>{group.title}</span>
                  <span {...variablesStyles.count()}>
                    {group.entries.length}
                  </span>
                </a>
              ))}
            </nav>
          }
        >
          {filtered.length === 0 && (
            <div {...variablesStyles.sectionContent()}>
              <p {...variablesStyles.description()}>
                No variables match “{query}”. Try a category, such as color or
                spacing.
              </p>
            </div>
          )}
          {filtered.map((group) => (
            <section
              aria-labelledby={domId(['heading', group.name])}
              id={group.id}
              key={group.name}
              {...variablesStyles.section()}
            >
              <div {...variablesStyles.sectionIntro()}>
                <h2
                  id={domId(['heading', group.name])}
                  {...variablesStyles.sectionHeading()}
                >
                  {group.title}
                </h2>
              </div>
              <div {...variablesStyles.sectionContent()}>
                {group.sections.map((section) => (
                  <div
                    id={!section.name ? undefined : section.id}
                    key={section.id}
                    {...variablesStyles.subsection()}
                  >
                    {(section.name || group.sections.length > 1) && (
                      <h3 {...variablesStyles.subheading()}>
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
                        section.entries.some((entry) => entry.path.length > 3)
                          ? {
                              gridTemplateColumns:
                                'repeat(auto-fit, minmax(0, 128px))',
                            }
                          : undefined
                      }
                      {...(group.color
                        ? variablesStyles.palette()
                        : variablesStyles.entries())}
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
                              ? variablesStyles.colorEntry()
                              : variablesStyles.entry())}
                          >
                            <dt {...variablesStyles.name()}>
                              <code title={name}>
                                {group.color
                                  ? entry.path.slice(2).join('.') ||
                                    entry.path.at(-1)
                                  : name}
                              </code>
                            </dt>
                            <dd
                              {...(group.color
                                ? variablesStyles.colorValues()
                                : variablesStyles.values())}
                            >
                              {entry.condition && (
                                <span {...variablesStyles.hint()}>
                                  {entry.condition}
                                </span>
                              )}
                              {typeof entry.value === 'object' ? (
                                <div {...variablesStyles.typography()}>
                                  <div
                                    data-typography={entry.path
                                      .slice(1)
                                      .join('.')}
                                    style={entry.value}
                                    {...variablesStyles.sample()}
                                  >
                                    {entry.path[1] === 'copy'
                                      ? 'Write type-safe styles, variables, and themes. Compile to static CSS. Keep your styles close to your code.'
                                      : 'Styles that scale.'}
                                  </div>
                                  <details {...variablesStyles.details()}>
                                    <summary>Variables</summary>
                                    <dl>
                                      {Object.entries(entry.value).map(
                                        (input) => {
                                          const [key, value] = input

                                          return (
                                            <div
                                              key={key}
                                              {...variablesStyles.field()}
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
                                          )
                                        },
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
                                      ? variablesStyles.colorValue()
                                      : variablesStyles.value())}
                                  >
                                    {group.color && (
                                      <span
                                        aria-hidden="true"
                                        {...variablesStyles.swatch()}
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
                                        ? variablesStyles.colorRaw()
                                        : variablesStyles.raw())}
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
        </DocumentationShell>
      )}
    </>
  )
}

export declare namespace Page {
  /** Properties for the Page component. */
  type Props = {
    config?: Variables.Configuration | undefined
    error?: string | undefined
  }
}

namespace variablesStyles {
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

  export const hint = style({
    typography: 'label.12',
    color: 'gray.900',
    marginLeft: 'auto !custom',
  })

  export const name = style({
    typography: 'label.13.mono',
    overflowWrap: 'anywhere',
  })

  export const docs = style({
    typography: 'label.14',
    fontWeight: 'medium',
    color: 'gray.900',
    display: 'block',
    textDecoration: 'none',
    ':hover': { color: 'foreground' },
  })

  export const navigation = style({
    display: 'grid',
    gap: 1,
    '@media (max-width: 700px)': { display: 'flex', flexWrap: 'wrap', gap: 4 },
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

function domId(path: readonly string[]) {
  return path
    .map((key) =>
      Array.from(key, (character) =>
        character.codePointAt(0)!.toString(16),
      ).join('-'),
    )
    .join('_')
}

function reference(path: readonly string[]) {
  return path.reduce((name, key) => {
    if (/^(0|[1-9]\d*)$/.test(key)) return `${name}[${key}]`
    if (/^[a-zA-Z_$][\w$]*$/.test(key)) return `${name}.${key}`
    return `${name}[${JSON.stringify(key)}]`
  }, 'vars')
}

function Preview(props: Preview.Props) {
  const { category, maximum, entry } = props

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
      <div aria-hidden="true" {...variablesStyles.widthPreview()}>
        <div {...variablesStyles.widthTrack()}>
          <span
            style={{ width: `${(Number.parseFloat(value) / maximum) * 100}%` }}
            {...variablesStyles.widthBar()}
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
        return { fontSize: entry.value, lineHeight: 1.2 }
      case 'fontWeight':
        return { fontWeight: entry.value }
      case 'letterSpacing':
        return { letterSpacing: entry.value }
      case 'lineHeight':
        return { lineHeight: entry.value, whiteSpace: 'pre-line' }
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
      {...variablesStyles.preview()}
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
        <span style={appearance} {...variablesStyles.sample()}>
          {category === 'lineHeight'
            ? 'Styles for modern interfaces.\nKeep styles close to your code.'
            : 'Styles for modern interfaces'}
        </span>
      ) : (
        <span
          data-ease={category === 'ease'}
          style={appearance}
          {...variablesStyles.shape()}
        />
      )}
      {category === 'ease' && (
        <span {...variablesStyles.hint()}>Hover or focus</span>
      )}
    </div>
  )
}

declare namespace Preview {
  /** Properties for the Preview component. */
  type Props = {
    category: string
    maximum: number
    entry: Entry
  }
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
