/** Renders the serialized variable reference. @module */
import { createFileRoute } from '@tanstack/react-router'
import { Page as VariablesPage } from '../pages/Variables.js'
import { Route as VariablesRoute } from './vars.js'

export const Route = createFileRoute('/vars/')({ component: Page })

function Page() {
  const { config, error } = VariablesRoute.useLoaderData()
  return <VariablesPage config={config} error={error} />
}
