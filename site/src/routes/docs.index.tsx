/** Opens the introductory documentation page. @module */
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/docs/')({
  beforeLoad: () => {
    throw redirect({
      params: { _splat: 'introduction/getting-started' },
      statusCode: 308,
      to: '/docs/$',
    })
  },
})
