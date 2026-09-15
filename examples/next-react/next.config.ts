/** Connects the Next.js playground to Zyzz compilation. @module */
import { zyzz } from 'zyzz/next'

// Generated agent instruction files would shadow the repository's own.
export default zyzz({ agentRules: false })
