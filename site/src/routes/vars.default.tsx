/** Displays the default variable reference. @module */
import { createFileRoute } from '@tanstack/react-router'
import { Page } from '../pages/Variables.js'

export const Route = createFileRoute('/vars/default')({
  codeSplitGroupings: [],
  component: Page,
  head: () => ({ meta: [{ title: 'Variables · Zyzz' }] }),
})
