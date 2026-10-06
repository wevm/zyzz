/** Configures TanStack Start for Cloudflare Workers. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Url from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import { compile } from '@mdx-js/mdx'
import mdx from '@mdx-js/rollup'
import babel from '@rolldown/plugin-babel'
import {
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationHighlight,
} from '@shikijs/transformers'
import { createTransformerFactory, rendererRich } from '@shikijs/twoslash/core'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import type { Code, Nodes, Root } from 'mdast'
import { defaultHandlers, toMarkdown } from 'mdast-util-to-markdown'
import MiniSearch from 'minisearch'
import {
  bundledLanguages,
  type BundledLanguage,
  codeToHast,
  codeToTokensWithThemes,
  hastToHtml,
  type ShikiTransformer,
} from 'shiki'
import { createTwoslasher, type TwoslashExecuteOptions } from 'twoslash'
import Icons from 'unplugin-icons/vite'
import { defineConfig, type ViteDevServer } from 'vite'
import { zyzz } from 'zyzz/vite'
import { files, lightTheme, theme } from './src/Example.js'
import * as Search from './src/Search.js'

export default defineConfig(async () => {
  const examples = await Promise.all(
    files.map(async (file) => {
      const tokens = await codeToTokensWithThemes(file.code, {
        lang: file.lang,
        themes: { light: lightTheme, dark: theme },
      })
      return {
        name: file.name,
        tokens: tokens.map((line) =>
          line.map((entry) => {
            const { content, variants } = entry

            return {
              content,
              color: `light-dark(${variants.light?.color ?? lightTheme.fg}, ${variants.dark?.color ?? theme.fg})`,
            }
          }),
        ),
      }
    }),
  )
  const docs: typeof __DOCS__ = { pages: {}, code: {} }
  const documents: Search.Document[] = []
  // TypeScript 7 has no JavaScript API, so these numbers mirror the TypeScript 6 enums that Twoslash runs.
  const twoslasher = createTwoslasher({
    compilerOptions: {
      exactOptionalPropertyTypes: true,
      jsx: 4, // JsxEmit.ReactJSX
      moduleResolution: 100, // ModuleResolutionKind.Bundler
      noUncheckedIndexedAccess: true,
    },
    customTags: ['error'],
    handbookOptions: { noStaticSemanticInfo: true },
    vfsRoot: Path.dirname(Url.fileURLToPath(import.meta.url)),
  })
  const transformers = [
    transformerNotationDiff({ matchAlgorithm: 'v3' }),
    transformerNotationHighlight({ matchAlgorithm: 'v3' }),
    createTransformerFactory(
      (source: string, lang?: string, options?: TwoslashExecuteOptions) => {
        // Twoslash reads tags only at column 0, while formatters indent them with the code.
        const result = twoslasher(
          source.replace(/^[ \t]+(?=\/\/ @error:)/gm, ''),
          lang,
          options,
        )
        // Removing a final `^|` query line leaves the newline before it.
        const code = result.code.trimEnd()

        return {
          code,
          meta: result.meta,
          // Shiki renders a tag after its `line`, so point it at the line that ends where the tag was.
          nodes: result.nodes.map((node) =>
            node.type === 'tag'
              ? {
                  ...node,
                  line:
                    code.slice(0, Math.max(0, node.start - 1)).split('\n')
                      .length - 1,
                }
              : node,
          ),
        }
      },
      rendererRich({
        completionIcons: false,
        customTagIcons: false,
        hast: {
          completionPopup: { properties: { 'aria-label': 'Completions' } },
        },
      }),
    )({ explicitTrigger: true }),
    // Runs after Twoslash, so word offsets match the displayed code.
    transformerMetaWordHighlight(),
    lightDark,
  ]
  const directory = new URL('./src/content/docs/', import.meta.url)
  for (const path of await Fs.readdir(directory, { recursive: true })) {
    if (!path.endsWith('.mdx')) continue
    const source = await Fs.readFile(new URL(path, directory), 'utf8')
    await compile(source, {
      remarkPlugins: [
        inlineCode,
        () => async (tree: Root) => {
          const heading = tree.children.find(
            (node) => node.type === 'heading' && node.depth === 1,
          )
          const paragraph = tree.children.find(
            (node) => node.type === 'paragraph',
          )
          if (!plain(heading) || !plain(paragraph))
            throw new Error(
              `Documentation page ${path} requires a title and subtitle.`,
            )

          const highlighted = new Map<Code, Element>()
          async function highlight(node: Nodes) {
            if ('children' in node)
              for (const child of node.children) await highlight(child)
            if (node.type !== 'code') return

            const root = await codeToHast(node.value, {
              defaultColor: 'light-dark()',
              lang:
                node.lang && Object.hasOwn(bundledLanguages, node.lang)
                  ? (node.lang as BundledLanguage)
                  : 'text',
              // Titles can contain paths, whose slashes would read as `/word/` highlights.
              meta: { __raw: node.meta?.replace(titleMeta, '') ?? '' },
              themes: { dark: theme, light: lightTheme },
              transformers,
            })
            const pre = root.children[0]
            const code = pre?.type === 'element' ? pre.children[0] : undefined
            if (code?.type !== 'element')
              throw new Error(`Shiki returned no code element in ${path}.`)

            highlighted.set(node, code)
            docs.code[node.value] = {
              html: hastToHtml({ type: 'root', children: code.children }),
              text: lines(code)
                .map((line) => line.text)
                .join('\n'),
            }
          }
          await highlight(tree)

          const page = path
            .replace(/\.mdx$/, '')
            .split(Path.sep)
            .join('/')
          docs.pages[page] = {
            title: plain(heading),
            description: plain(paragraph),
            headings: headings(tree),
            markdown: toMarkdown(tree, {
              handlers: {
                code: (node, parent, state, info) => {
                  const code = highlighted.get(node)
                  return defaultHandlers.code(
                    code ? markdown(node, code) : node,
                    parent,
                    state,
                    info,
                  )
                },
                mdxjsEsm: () => '',
                mdxFlowExpression: () => '',
                mdxTextExpression: () => '',
                mdxJsxFlowElement: (node, _parent, state, info) => {
                  if (node.name === 'Install')
                    return '```sh\nnpm install zyzz\n```'

                  if (node.name === 'table') {
                    function rows(parent: typeof node): string[][] {
                      if (parent.name === 'tr')
                        return [
                          parent.children
                            .filter(
                              (child: typeof node) =>
                                child.name === 'th' || child.name === 'td',
                            )
                            .map((cell: typeof node) =>
                              state
                                .containerFlow(cell, info)
                                .trim()
                                .replace(/\|/g, '\\|')
                                .replace(/\n+/g, '<br />'),
                            ),
                        ]
                      return parent.children.flatMap((child: typeof node) =>
                        child.type === 'mdxJsxFlowElement' ? rows(child) : [],
                      )
                    }
                    const [header, ...body] = rows(node)
                    if (!header) return ''
                    return [header, header.map(() => '---'), ...body]
                      .map((row) => `| ${row.join(' | ')} |`)
                      .join('\n')
                  }

                  const content = state.containerFlow(node, info)
                  if (node.name === 'FrameworkSetup.Mode') {
                    const name = node.attributes.find(
                      (attribute: {
                        type: string
                        name?: string
                        value?: unknown
                      }) =>
                        attribute.type === 'mdxJsxAttribute' &&
                        attribute.name === 'name',
                    )
                    return `#### ${name?.value === 'default' ? 'Default Variables (Quick)' : 'Custom Variables (Advanced)'}\n\n${content}`
                  }

                  if (
                    node.name !== 'Card' &&
                    node.name !== 'FrameworkSetup.Target'
                  )
                    return content

                  const title = node.attributes.find(
                    (attribute: {
                      type: string
                      name?: string
                      value?: unknown
                    }) =>
                      attribute.type === 'mdxJsxAttribute' &&
                      attribute.name === 'title',
                  )
                  const href = node.attributes.find(
                    (attribute: {
                      type: string
                      name?: string
                      value?: unknown
                    }) =>
                      attribute.type === 'mdxJsxAttribute' &&
                      attribute.name === 'href',
                  )
                  if (
                    node.name === 'FrameworkSetup.Target' &&
                    title?.type === 'mdxJsxAttribute' &&
                    typeof title.value === 'string'
                  )
                    return `### ${title.value}\n\n${content}`

                  if (
                    title?.type !== 'mdxJsxAttribute' ||
                    typeof title.value !== 'string' ||
                    href?.type !== 'mdxJsxAttribute' ||
                    typeof href.value !== 'string'
                  )
                    return content

                  return `[${title.value}](${href.value})\n\n${content}`
                },
                mdxJsxTextElement: (node, _parent, state, info) =>
                  state.containerPhrasing(node, info),
              },
            }).replace(escapedAlert, '$1[!$2]'),
          }

          // Runs after `headings` assigns the anchor IDs that section results link to.
          documents.push(
            ...sections({ code: docs.code, page, title: plain(heading), tree }),
          )
        },
      ],
    })
  }
  const index = new MiniSearch(Search.options)
  index.addAll(documents)
  // A virtual module lets the dialog import the index lazily as its own chunk.
  const searchIndex = `export default ${JSON.stringify(JSON.stringify(index))}`
  return {
    define: {
      __DOCS__: JSON.stringify(docs),
      __EXAMPLE__: JSON.stringify({
        bg: `light-dark(${lightTheme.bg}, ${theme.bg})`,
        fg: `light-dark(${lightTheme.fg}, ${theme.fg})`,
        files: examples,
      }),
    },
    plugins: [
      cloudflare({ viteEnvironment: { name: 'ssr' } }),
      zyzz(),
      mdx({
        remarkPlugins: [
          inlineCode,
          () => (tree: Root) => {
            function annotate(node: Nodes) {
              if ('children' in node)
                for (const child of node.children) annotate(child)

              if (node.type === 'blockquote') {
                const paragraph = node.children[0]
                if (paragraph?.type !== 'paragraph') return
                const marker = paragraph.children[0]
                if (marker?.type !== 'text') return
                const match = marker.value.match(calloutMarker)
                if (!match) return

                marker.value = marker.value.slice(match[0].length)
                if (!marker.value) paragraph.children.shift()
                if (!paragraph.children.length) node.children.shift()
                node.data = {
                  ...node.data,
                  hProperties: {
                    ...node.data?.hProperties,
                    'data-callout': match[1]?.toLowerCase(),
                  },
                }
                return
              }

              if (node.type !== 'code') return
              const filename = node.meta?.match(/(?:^|\s)title="([^"]+)"/)?.[1]
              if (filename)
                node.data = {
                  ...node.data,
                  hProperties: {
                    ...node.data?.hProperties,
                    'data-filename': filename,
                  },
                }
            }

            annotate(tree)

            // The shared page header renders the authored title and opening paragraph.
            const heading = tree.children.find(
              (node) => node.type === 'heading' && node.depth === 1,
            )
            const paragraph = tree.children.find(
              (node) => node.type === 'paragraph',
            )
            tree.children = tree.children.filter(
              (node) => node !== heading && node !== paragraph,
            )

            // Assigns the anchor IDs that `__DOCS__` headings link to.
            headings(tree)
          },
        ],
      }),
      {
        name: 'docs-content',
        configureServer(server: ViteDevServer) {
          const directory = Path.resolve('src/content/docs')
          server.watcher.add(directory)
          let timer: ReturnType<typeof setTimeout> | undefined
          server.watcher.on('all', (_event, path) => {
            if (
              !path.startsWith(`${directory}${Path.sep}`) ||
              !path.endsWith('.mdx')
            )
              return
            clearTimeout(timer)
            timer = setTimeout(() => {
              void server.restart()
            }, 100)
          })
          server.httpServer?.on('close', () => clearTimeout(timer))
        },
      },
      {
        name: 'docs-search',
        load: (id: string) =>
          id === '\0virtual:search-index' ? searchIndex : undefined,
        resolveId: (id: string) =>
          id === 'virtual:search-index' ? '\0virtual:search-index' : undefined,
      },
      Icons({ compiler: 'jsx', jsx: 'react' }),
      tanstackStart({ server: { entry: './entry.server.ts' } }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})

/** Matches a GitHub alert marker, such as `[!NOTE]`, at the start of a blockquote. */
const calloutMarker = /^\[!(CAUTION|IMPORTANT|NOTE|TIP|WARNING)\]\s*/

/** Matches an alert marker escaped by Markdown serialization, which GitHub alerts require literally. */
const escapedAlert = /^((?:> ?)+)\\\[!(CAUTION|IMPORTANT|NOTE|TIP|WARNING)\]/gm

/** Matches inline code ending in a language marker, such as `` `cx(…){:ts}` ``. */
const inlineMarker = /^([\s\S]+)\{:([\w-]+)\}$/

/** Matches a `title="..."` attribute in a code fence's metadata. */
const titleMeta = /(?:^|\s)title="[^"]*"/

/** Matches the `twoslash` flag in a code fence's metadata. */
const twoslashMeta = /(?:^|\s)twoslash(?=\s|$)/

/** Matches `/word/` highlights in a code fence's metadata. */
const wordMeta = /(?:^|\s)\/(?:\\.|[^/])+\//g

/** Highlighted HAST element produced by Shiki. */
type Element = Extract<
  Awaited<ReturnType<typeof codeToHast>>['children'][number],
  { type: 'element' }
>

/** A highlighted line's text, diff marker, and annotations for Markdown twins. */
type Line = {
  marker: 'add' | 'remove' | undefined
  notes: string[]
  text: string
}

/** Drops per-theme variables, since `light-dark()` colors already carry both themes. */
const lightDark: ShikiTransformer = {
  name: 'docs:light-dark',
  span(node) {
    if (typeof node.properties.style === 'string')
      node.properties.style = node.properties.style.replace(
        /;--shiki-[\w-]+:[^;]*/g,
        '',
      )
  },
}

function classes(node: Element) {
  const value = node.properties.class
  return Array.isArray(value)
    ? value.map(String)
    : String(value ?? '').split(' ')
}

/** Reads completion lists inside a line as Markdown notes. */
function completions(node: Element['children'][number]): string[] {
  if (node.type !== 'element') return []
  if (classes(node).includes('twoslash-completion-list'))
    return [`completions: ${node.children.map(text).join(', ')}`]
  return node.children.flatMap(completions)
}

/** Assigns anchor IDs to `##` and `###` section headings and returns them in document order. Both MDX passes call it, so the IDs match. */
function headings(tree: Root) {
  const counts = new Map<string, number>()

  function collect(node: Nodes): (typeof __DOCS__.pages)[string]['headings'] {
    // Step headings label procedures rather than sections, and setup renders only the selected framework's steps.
    if (
      node.type === 'mdxJsxFlowElement' &&
      (node.name === 'FrameworkSetup' || node.name === 'Steps')
    )
      return []
    if (node.type !== 'heading')
      return 'children' in node ? node.children.flatMap(collect) : []
    if (node.depth !== 2 && node.depth !== 3) return []

    const title = plain(node)
    const slug = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
    const count = counts.get(slug) ?? 0
    counts.set(slug, count + 1)
    const id = count ? `${slug}-${count}` : slug

    node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id } }
    return [{ depth: node.depth, id, title }]
  }

  return collect(tree)
}

/** Highlights inline code marked with a trailing `{:lang}`, and removes the marker from its text. */
function inlineCode() {
  return async (tree: Root) => {
    async function highlight(node: Nodes) {
      if ('children' in node)
        for (const child of node.children) await highlight(child)
      if (node.type !== 'inlineCode') return

      const [, code, lang] = node.value.match(inlineMarker) ?? []
      if (code === undefined || lang === undefined) return
      if (!Object.hasOwn(bundledLanguages, lang))
        throw new Error(`Inline code uses an unknown language: ${lang}.`)

      const root = await codeToHast(code, {
        defaultColor: 'light-dark()',
        lang: lang as BundledLanguage,
        structure: 'inline',
        themes: { dark: theme, light: lightTheme },
        transformers: [lightDark],
      })
      node.value = code
      node.data = {
        ...node.data,
        hChildren: root.children.filter(
          (child) => child.type === 'element' || child.type === 'text',
        ),
      }
    }

    await highlight(tree)
  }
}

/** Reads lines, diff markers, and Twoslash annotations from highlighted code. */
function lines(code: Element): Line[] {
  const output: Line[] = []

  for (const child of code.children) {
    if (child.type !== 'element') continue
    const names = classes(child)
    if (names.includes('line')) {
      output.push({
        marker: (['add', 'remove'] as const).find((marker) =>
          names.includes(marker),
        ),
        notes: completions(child),
        text: text(child),
      })
      continue
    }

    // Twoslash renders errors and custom tags as rows after their line.
    const [first = '', ...rest] = text(child).split('\n')
    output
      .at(-1)
      ?.notes.push(
        names.includes('twoslash-error-line') ? `error: ${first}` : first,
        ...rest.map((note) => note.trim()),
      )
  }

  return output
}

/** Writes a highlighted block for Markdown twins, with diff markers and annotations as comments. */
function markdown(node: Code, code: Element): Code {
  const entries = lines(code)
  const diff = entries.some((entry) => entry.marker)
  const signs = { add: '+', remove: '-' } as const

  return {
    ...node,
    lang: diff ? 'diff' : node.lang,
    meta:
      node.meta?.replace(twoslashMeta, ' ').replace(wordMeta, ' ').trim() ||
      null,
    value: entries
      .flatMap((entry) => {
        const sign = entry.marker ? signs[entry.marker] : ' '
        const indent = `${diff ? ' ' : ''}${entry.text.match(/^\s*/)?.[0] ?? ''}`

        return [
          `${diff ? sign : ''}${entry.text}`,
          ...entry.notes.map((note) => `${indent}// ${note}`),
        ]
      })
      .join('\n'),
  }
}

/** Reads a Markdown node's plain text, such as a heading's title. */
function plain(node: Nodes | undefined): string {
  if (!node) return ''
  if ('children' in node) return node.children.map(plain).join('')
  if ('value' in node) return node.value
  if (node.type === 'image') return node.alt ?? ''
  return ''
}

/** Splits a page into a search entry for its introduction and one for each `##` and `###` section. */
function sections(options: sections.Options): Search.Document[] {
  const { code, page, title, tree } = options
  type Entry = Omit<Search.Document, 'text'> & { parts: string[] }
  const entries: Entry[] = [
    { href: `/docs/${page}`, parts: [], title, titles: [], type: 'page' },
  ]
  let parent: string | undefined

  function visit(node: Nodes) {
    if (
      node.type === 'mdxjsEsm' ||
      node.type === 'mdxFlowExpression' ||
      node.type === 'mdxTextExpression'
    )
      return

    const entry = entries.at(-1)!
    if (node.type === 'heading' && node.depth === 1) return
    // Only headings with anchors start sections. Step and deeper headings stay in their section's text.
    const id = node.type === 'heading' ? node.data?.hProperties?.id : undefined
    if (node.type === 'heading' && typeof id === 'string') {
      const heading = plain(node)
      if (node.depth === 2) parent = heading
      entries.push({
        href: `/docs/${page}#${id}`,
        parts: [],
        title: heading,
        titles: node.depth === 3 && parent ? [title, parent] : [title],
        type: 'section',
      })
      return
    }

    if (node.type === 'code') {
      entry.parts.push(code[node.value]?.text ?? node.value)
      return
    }
    if (node.type === 'text' || node.type === 'inlineCode') {
      entry.parts.push(node.value)
      return
    }
    if ('children' in node) for (const child of node.children) visit(child)
  }

  for (const node of tree.children) visit(node)

  return entries.map((entry) => {
    const { parts, ...document } = entry
    return { ...document, text: parts.join(' ').replace(/\s+/g, ' ').trim() }
  })
}

declare namespace sections {
  type Options = {
    /** Highlighted code fences, read for their displayed source. */
    code: (typeof __DOCS__)['code']
    /** Documentation path, such as `guides/styling`. */
    page: string
    /** Page title from the `#` heading. */
    title: string
    /** Page tree after `headings` assigned section anchors. */
    tree: Root
  }
}

/** Reads displayed text, without completion popups. */
function text(node: Element['children'][number]): string {
  if (node.type === 'text') return node.value
  if (
    node.type !== 'element' ||
    classes(node).includes('twoslash-completion-list')
  )
    return ''
  return node.children.map(text).join('')
}
