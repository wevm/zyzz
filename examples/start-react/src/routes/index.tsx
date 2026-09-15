/** Serves the playground at the root route. @module */
import { createFileRoute } from '@tanstack/react-router'
import { App } from '../App.js'

export const Route = createFileRoute('/')({ component: App })
