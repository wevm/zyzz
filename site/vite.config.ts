/** Configures TanStack Start for Cloudflare Workers. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import { compile } from '@mdx-js/mdx'
import mdx from '@mdx-js/rollup'
import babel from '@rolldown/plugin-babel'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import type { Nodes, Root } from 'mdast'
import { toMarkdown } from 'mdast-util-to-markdown'
import {
  bundledLanguages,
  type BundledLanguage,
  codeToTokensWithThemes,
} from 'shiki'
import Icons from 'unplugin-icons/vite'
import { defineConfig, type ViteDevServer } from 'vite'
import { zyzz } from 'zyzz/vite'
import { files, lightTheme, theme } from './src/Example.js'

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
  const directory = new URL('./src/content/docs/', import.meta.url)
  for (const path of await Fs.readdir(directory, { recursive: true })) {
    if (!path.endsWith('.mdx')) continue
    const source = await Fs.readFile(new URL(path, directory), 'utf8')
    await compile(source, {
      remarkPlugins: [
        () => async (tree: Root) => {
          const heading = tree.children.find(
            (node) => node.type === 'heading' && node.depth === 1,
          )
          const paragraph = tree.children.find(
            (node) => node.type === 'paragraph',
          )
          function text(node: Nodes | undefined): string {
            if (!node) return ''
            if ('children' in node) return node.children.map(text).join('')
            if ('value' in node) return node.value
            if (node.type === 'image') return node.alt ?? ''
            return ''
          }
          if (!text(heading) || !text(paragraph))
            throw new Error(
              `Documentation page ${path} requires a title and subtitle.`,
            )
          docs.pages[
            path
              .replace(/\.mdx$/, '')
              .split(Path.sep)
              .join('/')
          ] = {
            title: text(heading),
            description: text(paragraph),
            markdown: toMarkdown(tree, {
              handlers: {
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
            }),
          }
          async function highlight(node: Nodes) {
            if ('children' in node) {
              for (const child of node.children) await highlight(child)
            }
            if (node.type !== 'code') return
            const tokens = await codeToTokensWithThemes(node.value, {
              lang:
                node.lang && Object.hasOwn(bundledLanguages, node.lang)
                  ? (node.lang as BundledLanguage)
                  : 'text',
              themes: { light: lightTheme, dark: theme },
            })
            docs.code[node.value] = tokens.map((line) =>
              line.map((entry) => {
                const { content, variants } = entry

                return {
                  content,
                  color: `light-dark(${variants.light?.color ?? lightTheme.fg}, ${variants.dark?.color ?? theme.fg})`,
                }
              }),
            )
          }
          await highlight(tree)
        },
      ],
    })
  }
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
          () => (tree: Root) => {
            function annotate(node: Nodes) {
              if ('children' in node)
                for (const child of node.children) annotate(child)

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
      Icons({ compiler: 'jsx', jsx: 'react' }),
      tanstackStart({ server: { entry: './entry.server.ts' } }),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  }
})
