/** Renders the initial site homepage. @module */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>Zyzz</h1>
      <p>Type-safe styles for web and React Native.</p>
    </main>
  )
}
