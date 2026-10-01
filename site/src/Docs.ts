/** Indexes authored MDX pages for navigation and route rendering. @module */
import type { ComponentType, ElementType } from 'react'

/** Compiled MDX components indexed by their documentation path. */
export const pages = import.meta.glob<
  ComponentType<{
    components?: Record<string, ElementType>
  }>
>('./content/docs/**/*.mdx', { eager: true, import: 'default' })

/** Authored sidebar order, including pages awaiting migration. */
export const groups: readonly { pages: readonly Item[]; title: string }[] = [
  {
    title: 'Introduction',
    pages: [
      { path: 'introduction/getting-started', title: 'Getting Started' },
      { path: 'introduction/installation', title: 'Installation' },
      { path: 'introduction/why-zyzz', title: 'Why Zyzz' },
      { path: 'introduction/thinking-in-zyzz', title: 'Thinking in Zyzz' },
      { path: 'concepts', title: 'Concepts & Principles' },
      { path: 'introduction/comparisons', title: 'Comparisons' },
      { path: 'introduction/benchmarks', title: 'Benchmarks' },
      { path: 'introduction/editor-agents', title: 'Editor & Agents' },
      { path: 'introduction/compatibility', title: 'Compatibility' },
      { path: 'introduction/faq', title: 'FAQ' },
    ],
  },
  {
    title: 'Guides',
    pages: [
      { path: 'guides/styling', title: 'Styling' },
      { path: 'guides/conditions', title: 'Conditions' },
      { path: 'guides/themes', title: 'Themes & Tokens' },
      { path: 'guides/variants', title: 'Variants' },
      { path: 'guides/stylesheets', title: 'Stylesheets' },
      { path: 'guides/css-output', title: 'CSS Output' },
      { path: 'guides/compilation', title: 'Build & Delivery' },
      { path: 'guides/native', title: 'React Native' },
      { path: 'api/oxlint', title: 'Linting' },
      { path: 'guides/testing', title: 'Testing & Troubleshooting' },
      { path: 'guides/tailwind', title: 'Migrating from Tailwind' },
      { path: 'guides/stylex', title: 'Migrating from StyleX' },
    ],
  },
  {
    title: 'API',
    pages: [
      { path: 'api/core', title: 'Core' },
      { path: 'api/web', title: 'Web' },
      { path: 'api/react-native', title: 'React Native' },
      { path: 'api/cli', title: 'CLI' },
      {
        title: 'Integrations',
        children: [
          { path: 'api/vite', title: 'Vite' },
          { path: 'api/next', title: 'Next.js' },
          { path: 'api/metro', title: 'Metro' },
          { path: 'api/unplugin', title: 'Unplugin' },
          { path: 'api/babel', title: 'Babel' },
        ],
      },
      { path: 'api/compiler', title: 'Compiler' },
      { path: 'api/runtime', title: 'Runtime' },
      { path: 'api/node', title: 'Node' },
      { path: 'api/oxlint', title: 'Oxlint' },
    ],
  },
].map((group) => ({
  ...group,
  pages: [
    ...group.pages,
    ...Object.entries(__DOCS__.pages)
      .filter(
        (entry) =>
          entry[0].split('/')[0] === group.title.toLowerCase() &&
          !group.pages.some((page) => page.path === entry[0]),
      )
      .map((entry) => ({ path: entry[0], title: entry[1].title })),
  ],
}))

/** A page or nested topic in documentation navigation. */
export type Item = {
  /** Nested entrypoints shown beneath the topic. */
  children?: readonly Item[] | undefined
  /** Documentation path, enabled when its MDX page exists. */
  path?: string | undefined
  /** Human-readable navigation label. */
  title: string
}
