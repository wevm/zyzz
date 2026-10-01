/** Indexes authored MDX pages for navigation and route rendering. @module */
import type { ComponentType, ElementType } from 'react'

/** Compiled MDX components indexed by their documentation path. */
export const pages = import.meta.glob<
  ComponentType<{
    components?: Record<string, ElementType>
  }>
>('./content/docs/**/*.mdx', { eager: true, import: 'default' })

/** Sidebar groups containing published pages. */
export const groups = ['Introduction', 'Guides', 'API']
  .map((title) => ({
    title,
    pages: Object.entries(__DOCS__.pages)
      .filter((entry) => {
        const [path] = entry

        return path.split('/')[0] === title.toLowerCase()
      })
      .map((entry) => {
        const [path, page] = entry

        return { path, title: page.title }
      }),
  }))
  .filter((group) => group.pages.length > 0)
