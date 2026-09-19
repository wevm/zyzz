/** Defines the landing page route. @module */
import { createFileRoute } from '@tanstack/react-router'
import { Home } from '../Home.js'

/** Renders the homepage. */
export const Route = createFileRoute('/')({ component: Home })
