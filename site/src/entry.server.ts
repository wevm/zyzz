/** Answers robots.txt, the sitemap, and the llms.txt files, and negotiates Markdown for agents and HTML for browsers at the home page and documentation pages. @module */
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import * as Head from './Head.js'
import * as Llms from './Llms.js'
import * as Markdown from './Markdown.js'
import * as Sitemap from './Sitemap.js'

// Representation precedence follows wevm/vocs src/internal/markdown-negotiation.ts.
const handle = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, options?: Parameters<typeof handle>[1]) {
    const url = new URL(request.url)
    const read = ['GET', 'HEAD'].includes(request.method)
    if (read) {
      if (url.pathname === '/llms.txt') return Llms.index(request)
      if (url.pathname === '/llms-full.txt') return Llms.full(request)
      if (url.pathname === '/robots.txt') return Sitemap.robots(request)
      if (url.pathname === '/sitemap.xml') return Sitemap.respond(request)
    }

    const client = negotiate(request)
    const html = async () => {
      if (client.preview || client.search || read) {
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
    }

    // The home page answers agents with the documentation index.
    if (url.pathname === '/') {
      if (read && !client.preview && !client.search && client.type) {
        const response = Llms.index(request, { type: client.type })
        response.headers.set('Vary', 'Accept, User-Agent')
        return response
      }
      return html()
    }

    if (!url.pathname.startsWith('/docs/')) return handle(request, options)
    const path = url.pathname
      .slice('/docs/'.length)
      .replace(/\.md$/, '')
      .replace(/\/$/, '')
    const markdown = Markdown.pages[path]
    if (!Object.hasOwn(Markdown.pages, path) || markdown === undefined)
      return handle(request, options)

    const explicit = url.pathname.endsWith('.md')
    if (
      read &&
      !client.preview &&
      (explicit || (!client.search && client.type))
    ) {
      const type = explicit ? 'text/markdown' : (client.type ?? 'text/markdown')
      return new Response(request.method === 'HEAD' ? null : markdown, {
        headers: {
          'Content-Type': `${type}; charset=utf-8`,
          // Search engines index the HTML page rather than its Markdown twin.
          Link: `<${Head.origin}/docs/${path}>; rel="canonical"`,
          Vary: 'Accept, User-Agent',
        },
      })
    }

    return html()
  },
}

/**
 * Classifies a request by its user agent and `Accept` ranking.
 * `type` names the text representation an agent, terminal client, or `Accept` header asks for, and stays undefined for HTML.
 */
function negotiate(request: Request) {
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

  const ranges = (request.headers.get('accept') ?? '')
    .split(',')
    .map((range) => {
      const [type, ...parameters] = range.trim().toLowerCase().split(';')
      const parameter = parameters.find((value) =>
        value.trim().startsWith('q='),
      )
      const q = parameter?.trim().slice(2).trim()
      return {
        type: type?.trim(),
        quality: (() => {
          if (q === undefined) return 1
          if (/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q)) return Number(q)
          return 0
        })(),
      }
    })
  const quality = (type: string) => {
    for (const candidate of [type, 'text/*', '*/*']) {
      const matches = ranges.filter((range) => range.type === candidate)
      if (matches.length)
        return Math.max(...matches.map((range) => range.quality))
    }
    return 0
  }

  // A text type counts only when named outright and ranked at least as high as HTML. Ties favor Markdown.
  const accepted = (['text/markdown', 'text/plain'] as const)
    .filter(
      (type) =>
        ranges.some((range) => range.type === type) &&
        quality(type) > 0 &&
        quality(type) >= quality('text/html'),
    )
    .sort((a, b) => quality(b) - quality(a))[0]
  const type = accepted ?? (ai || terminal ? 'text/markdown' : undefined)

  return { preview, search, type }
}
