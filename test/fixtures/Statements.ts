/** Native statement and legacy document grammar corpus. @module */
export const documents = [
  'url("https://example.com/")',
  'url-prefix("https://example.com/")',
  'domain("example.com")',
  'regexp("https:.*")',
  'media-document("image")',
  'domain("example.com"),url-prefix("https://other.example/")',
] as const
export const queries = [
  true,
  false,
  'screen',
  'screen, print',
  'not screen and (color)',
  '(width > 1px)',
  '(width > 1px) and (height > 1px)',
  '(width > 1px) or (height > 1px)',
  '(--other) and (color)',
] as const

/** Represents every import condition combination without network fetches. */
export function imports(url = 'https://example.com/before.css'): string {
  return `import {importCss,global} from 'zyzz/web';\n${[undefined, true, 'base', 'base.\\63 omponents'].flatMap((layer) => [undefined, 'display: grid', '(display: grid) and (color: red)'].flatMap((supports) => [undefined, 'screen, print'].map((media) => `importCss(${JSON.stringify({ url, layer, supports, media })});`))).join('\n')}\nglobal({body:{color:'red'}});`
}
