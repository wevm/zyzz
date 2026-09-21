/** Serves the site at the root route. @module */
import { createFileRoute } from '@tanstack/react-router'
import { App } from '../App.js'

/** Renders the home page. */
export const Route = createFileRoute('/')({ component: App })
