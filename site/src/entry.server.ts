/** Answers AI Search queries, robots.txt, and the sitemap, and negotiates documentation Markdown for agents and HTML for browsers. @module */
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import * as AiSearch from './AiSearch.js'
import * as Manifest from './Manifest.js'
import * as Sitemap from './Sitemap.js'

// Representation precedence follows wevm/vocs src/internal/markdown-negotiation.ts.
const handle = createStartHandler(defaultStreamHandler)

export default {
  // Workers passes the environment bindings as the second argument, which continues on to TanStack Start.
  async fetch(
    request: Request,
    options: AiSearch.Env & NonNullable<Parameters<typeof handle>[1]>,
  ) {
    const url = new URL(request.url)
    if (url.pathname === '/api/search' && request.method === 'POST')
      return AiSearch.respond(request, options.AI_SEARCH)
    if (['GET', 'HEAD'].includes(request.method)) {
      if (url.pathname === '/robots.txt') return Sitemap.robots(request)
      if (url.pathname === '/sitemap.xml') return Sitemap.respond(request)
    }
    if (!url.pathname.startsWith('/docs/')) return handle(request, options)
    const path = url.pathname
      .slice('/docs/'.length)
      .replace(/\.md$/, '')
      .replace(/\/$/, '')
    const page = Manifest.pages[path]
    if (!Object.hasOwn(Manifest.pages, path) || !page)
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
    const acceptsMarkdown = (() => {
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
              if (/^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(q))
                return Number(q)
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
      const markdown = quality('text/markdown')
      return (
        ranges.some((range) => range.type === 'text/markdown') &&
        markdown > 0 &&
        markdown >= quality('text/html')
      )
    })()
    const explicit = url.pathname.endsWith('.md')
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      !preview &&
      (explicit || (!search && (ai || terminal || acceptsMarkdown)))
    ) {
      return new Response(request.method === 'HEAD' ? null : page.markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          Vary: 'Accept, User-Agent',
        },
      })
    }

    if (preview || search || ['GET', 'HEAD'].includes(request.method)) {
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
