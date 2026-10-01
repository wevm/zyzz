/** Negotiates documentation Markdown for agents and HTML for browsers. @module */
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'

// Representation precedence follows wevm/vocs src/internal/markdown-negotiation.ts.
const handle = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, options?: Parameters<typeof handle>[1]) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/docs/')) return handle(request, options)
    const path = url.pathname
      .slice('/docs/'.length)
      .replace(/\.md$/, '')
      .replace(/\/$/, '')
    const page = __DOCS__.pages[path]
    if (!Object.hasOwn(__DOCS__.pages, path) || !page)
      return handle(request, options)

    const agent = request.headers.get('user-agent') ?? ''
    const preview = [
      'Discordbot',
      'Embedly',
      'Facebot',
      'Iframely',
      'LinkedInBot',
      'Pinterestbot',
      'Slackbot',
      'Slurp',
      'TelegramBot',
      'Twitterbot',
      'WhatsApp',
      'facebookexternalhit',
    ].some((value) => agent.includes(value))
    const search = [
      'Googlebot',
      'Bingbot',
      'Amazonbot',
      'Applebot',
      'DuckAssistBot',
      'YouBot',
    ].some((value) => agent.includes(value))
    const terminal = ['curl/', 'Wget/', 'HTTPie/', 'httpie-go/', 'xh/'].some(
      (value) => agent.includes(value),
    )
    const ai = [
      'GPTBot',
      'OAI-SearchBot',
      'ChatGPT-User',
      'anthropic-ai',
      'ClaudeBot',
      'claude-web',
      'PerplexityBot',
      'Perplexity-User',
      'Google-Extended',
      'FacebookBot',
      'meta-externalagent',
      'Bytespider',
      'cohere-ai',
      'AI2Bot',
      'CCBot',
      'Diffbot',
      'omgili',
      'Timpibot',
      'MistralAI-User',
      'GoogleAgent-Mariner',
    ].some((value) => agent.includes(value))
    const explicit = url.pathname.endsWith('.md')
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      !preview &&
      (explicit ||
        (!search &&
          (ai ||
            terminal ||
            request.headers.get('accept')?.includes('text/markdown'))))
    ) {
      return new Response(request.method === 'HEAD' ? null : page.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          Vary: 'Accept, User-Agent',
        },
      })
    }

    if (preview || search) {
      const headers = new Headers(request.headers)
      headers.set('accept', 'text/html')
      request = new Request(request, { headers })
    }

    const response = await handle(request, options)
    const headers = new Headers(response.headers)
    headers.append('Vary', 'Accept, User-Agent')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
