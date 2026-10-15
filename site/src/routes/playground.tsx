/** Serves the playground interface without waiting for its browser-only tools. @module */
import { createFileRoute } from '@tanstack/react-router'
import * as Head from '../Head.js'
import Playground from '../playground/Playground.js'

/** Defines the interactive source playground. */
export const Route = createFileRoute('/playground')({
  component: Page,
  head: () =>
    Head.page({
      description:
        'Edit Zyzz styles and inspect the compiled CSS with a live React preview.',
      path: '/playground',
      title: 'Playground · Zyzz',
    }),
})

function Page() {
  return <Playground />
}
