/** Connects the Next.js playground to Zyzz compilation. @module */
import { zyzz } from 'zyzz/next'

// The Examples workflow deploys a static site, so the App Router exports to `out`.
// Generated agent instruction files would shadow the repository's own.
export default zyzz({ agentRules: false, output: 'export' })
