/** Indexes authored MDX pages for navigation and route rendering. @module */
import * as Manifest from './Manifest.js'
import type { ComponentType, ElementType, ReactPromise } from 'react'

/** Authored sidebar order, including pages awaiting migration. */
export const groups: readonly { pages: readonly Item[]; title: string }[] = [
  {
    title: 'Introduction',
    pages: [
      { path: 'introduction/getting-started', title: 'Getting Started' },
      { path: 'introduction/why-zyzz', title: 'Why Zyzz' },
      { path: 'introduction/thinking-in-zyzz', title: 'Thinking in Zyzz' },
      { path: 'concepts', title: 'Concepts & Principles' },
      { path: 'introduction/comparisons', title: 'Comparisons' },
      { path: 'introduction/benchmarks', title: 'Benchmarks' },
      { path: 'introduction/agents', title: 'Agents' },
      { path: 'introduction/compatibility', title: 'Compatibility' },
      { path: 'introduction/faq', title: 'FAQ' },
    ],
  },
  {
    title: 'Guides',
    pages: [
      { path: 'guides/styling', title: 'Styling' },
      { path: 'guides/themes', title: 'Themes & Tokens' },
      { path: 'guides/default-theme', title: 'Default Theme' },
      { path: 'guides/conditions', title: 'Conditions' },
      { path: 'guides/variants', title: 'Variants' },
      { path: 'guides/global-styles', title: 'Global Styles' },
      { path: 'guides/layers', title: 'Layers' },
      { path: 'guides/typography', title: 'Fonts & Typography' },
      { path: 'guides/keyframes', title: 'Keyframes' },
      { path: 'guides/at-rules', title: 'At-Rules' },
      { path: 'guides/reset', title: 'Reset' },
      { path: 'guides/css-output', title: 'CSS Output' },
      {
        title: 'React Native',
        children: [
          { path: 'guides/native', title: 'Overview' },
          { path: 'guides/native/styling', title: 'Styling' },
          { path: 'guides/native/themes', title: 'Themes' },
          { path: 'guides/native/responsive', title: 'Responsive Styles' },
          { path: 'guides/native/components', title: 'Components' },
          { path: 'guides/native/animations', title: 'Animations' },
          { path: 'guides/native/packages', title: 'Shared Packages' },
          {
            path: 'guides/native/unistyles',
            title: 'Migrating from Unistyles',
          },
        ],
      },
      { path: 'api/oxlint', title: 'Linting' },
      { path: 'guides/testing', title: 'Testing & Troubleshooting' },
      { path: 'guides/tailwind', title: 'Migrating from Tailwind' },
      { path: 'guides/stylex', title: 'Migrating from StyleX' },
    ],
  },
  {
    title: 'API',
    pages: [
      {
        title: 'Core',
        children: [
          { path: 'api/core', title: 'Overview' },
          {
            title: 'Authoring',
            items: [
              { path: 'api/core/style', title: 'style' },
              { path: 'api/core/variants', title: 'variants' },
              { path: 'api/core/cx', title: 'cx' },
              { path: 'api/core/variable', title: 'variable' },
            ],
          },
          {
            title: 'Configuration',
            items: [
              { path: 'api/core/defineConfig', title: 'defineConfig' },
              { path: 'api/core/defineVars', title: 'defineVars' },
              { path: 'api/core/extendVars', title: 'extendVars' },
            ],
          },
          {
            title: 'Config Helpers',
            items: [
              { path: 'api/core/defineConfig/vars', title: 'vars' },
              { path: 'api/core/defineConfig/appearance', title: 'appearance' },
              { path: 'api/core/defineConfig/script', title: 'script' },
            ],
          },
          {
            title: 'Namespaces',
            items: [
              { path: 'api/core/namespaces/Config', title: 'Config' },
              { path: 'api/core/namespaces/Props', title: 'Props' },
              { path: 'api/core/namespaces/Style', title: 'Style' },
              { path: 'api/core/namespaces/Vars', title: 'Vars' },
            ],
          },
          {
            title: 'Reference',
            items: [{ path: 'api/core/values', title: 'Values' }],
          },
        ],
      },
      {
        title: 'Web',
        children: [
          { path: 'api/web', title: 'Overview' },
          {
            title: 'Stylesheets',
            items: [
              { path: 'api/web/global', title: 'global' },
              { path: 'api/web/layers', title: 'layers' },
              { path: 'api/web/fontFace', title: 'fontFace' },
              { path: 'api/web/keyframes', title: 'keyframes' },
            ],
          },
          {
            title: 'At-Rules',
            items: [
              { path: 'api/web/importCss', title: 'importCss' },
              { path: 'api/web/page', title: 'page' },
              { path: 'api/web/viewTransition', title: 'viewTransition' },
              { path: 'api/web/positionTry', title: 'positionTry' },
              { path: 'api/web/counterStyle', title: 'counterStyle' },
              { path: 'api/web/customMedia', title: 'customMedia' },
              { path: 'api/web/property', title: 'property' },
              {
                path: 'api/web/fontFeatureValues',
                title: 'fontFeatureValues',
              },
              {
                path: 'api/web/fontPaletteValues',
                title: 'fontPaletteValues',
              },
              { path: 'api/web/cssFunction', title: 'cssFunction' },
              { path: 'api/web/colorProfile', title: 'colorProfile' },
              { path: 'api/web/namespace', title: 'namespace' },
            ],
          },
          {
            title: 'Namespaces',
            items: [{ path: 'api/web/namespaces/Css', title: 'Css' }],
          },
          {
            title: 'Reference',
            items: [{ path: 'api/web/at-rules', title: 'At-Rule Contract' }],
          },
        ],
      },
      {
        title: 'React Native',
        children: [
          { path: 'api/react-native', title: 'Overview' },
          {
            title: 'Configuration',
            items: [
              { path: 'api/react-native/defineConfig', title: 'defineConfig' },
              { path: 'api/react-native/Provider', title: 'Provider' },
            ],
          },
          {
            title: 'Hooks',
            items: [
              { path: 'api/react-native/useStyles', title: 'useStyles' },
              { path: 'api/react-native/useVars', title: 'useVars' },
              { path: 'api/react-native/withStyles', title: 'withStyles' },
            ],
          },
          {
            title: 'Reanimated',
            items: [
              {
                path: 'api/react-native/useAnimatedVars',
                title: 'useAnimatedVars',
              },
              {
                path: 'api/react-native/useAnimatedStyleValue',
                title: 'useAnimatedStyleValue',
              },
            ],
          },
          {
            title: 'Namespaces',
            items: [
              {
                path: 'api/react-native/namespaces/StyleSheet',
                title: 'StyleSheet',
              },
              {
                path: 'api/react-native/namespaces/Variants',
                title: 'Variants',
              },
              { path: 'api/react-native/namespaces/Host', title: 'Host' },
            ],
          },
          {
            title: 'Reference',
            items: [{ path: 'api/react-native/values', title: 'Values' }],
          },
        ],
      },
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
      {
        title: 'Compiler',
        children: [
          { path: 'api/compiler', title: 'Overview' },
          {
            title: 'Namespaces',
            items: [
              { path: 'api/compiler/namespaces/Graph', title: 'Graph' },
              { path: 'api/compiler/namespaces/Native', title: 'Native' },
              { path: 'api/compiler/namespaces/Source', title: 'Source' },
              {
                path: 'api/compiler/namespaces/Transform',
                title: 'Transform',
              },
            ],
          },
        ],
      },
      {
        title: 'Runtime',
        children: [
          { path: 'api/runtime', title: 'Overview' },
          {
            title: 'Web',
            items: [
              { path: 'api/runtime/namespaces/Props', title: 'Props' },
              { path: 'api/runtime/namespaces/Dynamic', title: 'Dynamic' },
              { path: 'api/runtime/namespaces/Recipe', title: 'Recipe' },
              {
                path: 'api/runtime/namespaces/ConditionalRecipe',
                title: 'ConditionalRecipe',
              },
              {
                path: 'api/runtime/namespaces/PayloadRecipe',
                title: 'PayloadRecipe',
              },
              {
                path: 'api/runtime/namespaces/Composition',
                title: 'Composition',
              },
            ],
          },
          {
            title: 'HTML',
            items: [
              { path: 'api/runtime/namespaces/Html', title: 'Html' },
              {
                path: 'api/runtime/namespaces/CompositionHtml',
                title: 'CompositionHtml',
              },
            ],
          },
          {
            title: 'Themes',
            items: [
              { path: 'api/runtime/namespaces/Selection', title: 'Selection' },
              {
                path: 'api/runtime/namespaces/Appearance',
                title: 'Appearance',
              },
              { path: 'api/runtime/namespaces/Variable', title: 'Variable' },
            ],
          },
          {
            title: 'Native',
            items: [
              { path: 'api/runtime/namespaces/Native', title: 'Native' },
              {
                path: 'api/runtime/namespaces/NativeStatic',
                title: 'NativeStatic',
              },
              {
                path: 'api/runtime/namespaces/NativeDynamic',
                title: 'NativeDynamic',
              },
              {
                path: 'api/runtime/namespaces/NativeContext',
                title: 'NativeContext',
              },
              {
                path: 'api/runtime/namespaces/NativeVars',
                title: 'NativeVars',
              },
            ],
          },
        ],
      },
      {
        title: 'Node',
        children: [
          { path: 'api/node', title: 'Overview' },
          {
            title: 'Builds',
            items: [{ path: 'api/node/create', title: 'Host.create' }],
          },
          {
            title: 'Lifecycle',
            items: [
              { path: 'api/node/create/build', title: 'build' },
              { path: 'api/node/create/watch', title: 'watch' },
              { path: 'api/node/create/close', title: 'close' },
            ],
          },
          {
            title: 'Namespaces',
            items: [{ path: 'api/node/namespaces/Host', title: 'Host' }],
          },
        ],
      },
      { path: 'api/oxlint', title: 'Oxlint' },
    ],
  },
].map((group) => ({
  ...group,
  pages: [
    ...group.pages,
    ...Object.entries(Manifest.pages)
      .filter(
        (entry) =>
          entry[0].split('/')[0] === group.title.toLowerCase() &&
          !group.pages.some((page) => paths(page).includes(entry[0])),
      )
      .map((entry) => ({ path: entry[0], title: entry[1].title })),
  ],
}))

// Lazy imports give each page its own chunk, keeping every asset under the Workers size limit.
const modules = import.meta.glob<Content>('./content/docs/**/*.mdx', {
  import: 'default',
})
const loads = new Map<string, ReactPromise<Content>>()

/** Loads a page's compiled MDX once, marking the promise fulfilled so `use` reads it without suspending again. */
export function load(path: string): ReactPromise<Content> {
  const previous = loads.get(path)
  if (previous) return previous

  const module = modules[`./content/docs/${path}.mdx`]
  if (!module) throw new Error(`Missing documentation page: ${path}`)

  const promise: Promise<Content> = module().then(
    (content) => {
      Object.assign(promise, { status: 'fulfilled', value: content })
      return content
    },
    (error: unknown) => {
      // A failed chunk request must not stay cached, so a later attempt can retry it.
      loads.delete(path)
      throw error
    },
  )
  loads.set(path, promise)

  return promise
}

/** Lists an item's path and every path nested beneath it. */
export function paths(item: Item): readonly string[] {
  return [
    ...(item.path === undefined ? [] : [item.path]),
    ...(item.children ?? []).flatMap(paths),
    ...(item.items ?? []).flatMap(paths),
  ]
}

/**
 * Lists the sidebar group and topics above a page, outermost first, such as `['API', 'Core']`.
 * Labelled sections are left out, and pages outside the sidebar return an empty list.
 */
export function trail(path: string): readonly string[] {
  function find(items: readonly Item[]): readonly string[] | undefined {
    for (const item of items) {
      if (item.path === path) return []

      const children = item.children && find(item.children)
      if (children) return [item.title, ...children]

      const section = item.items && find(item.items)
      if (section) return section
    }
    return undefined
  }

  for (const group of groups) {
    const titles = find(group.pages)
    if (titles) return [group.title, ...titles]
  }
  return []
}

/** Compiled MDX component for one documentation page. */
export type Content = ComponentType<{
  /** Elements and MDX components that replace the defaults while rendering. */
  components?: Record<string, ElementType>
}>

/** A page, nested topic, or labelled section in documentation navigation. */
export type Item = {
  /** Nested entrypoints shown beneath the topic. */
  children?: readonly Item[] | undefined
  /** Pages listed under the title within a topic, without another disclosure level. */
  items?: readonly Item[] | undefined
  /** Documentation path, enabled when its MDX page exists. */
  path?: string | undefined
  /** Human-readable navigation label. */
  title: string
}
