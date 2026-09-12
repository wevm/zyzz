/**
 * Combines saved benchmark reports into one compact pull request comment.
 * @module
 */
import * as Fs from 'node:fs'

const [compilerPath, renderPath] = process.argv.slice(2)
if (!compilerPath || !renderPath)
  throw new Error(
    'Usage: node bench/Comment.ts <compiler-report> <render-report>',
  )
const read = (path: string) =>
  Fs.existsSync(path) ? Fs.readFileSync(path, 'utf8') : ''
const blocks = (report: string) =>
  [
    ...report.matchAll(
      /<details>\s*<summary>(.*?)<\/summary>([\s\S]*?)<\/details>/g,
    ),
  ].map((match) => ({ body: match[2]!, title: match[1]! }))
const compiler = blocks(read(compilerPath))
const render = blocks(read(renderPath))
const tables = (body: string) =>
  body
    .split('\n')
    .filter((line) => line.startsWith('|') || line.startsWith('#'))
    .join('\n')
    .replaceAll('—', '-')
const compact = (value: string) =>
  value
    .replace(/ — [\d.]+ (?:ms|ns) · ([\d.]+)× as fast as (.+)$/, ' ($1× vs $2)')
    .replace(/ — ([\d.]+ (?:ms|ns))$/, ' ($1)')
    .replaceAll('—', ':')
const print = (title: string, body: string) =>
  console.log(
    `<details>\n<summary>${title}</summary>\n\n${body}\n\n</details>\n`,
  )

console.log('# Benchmark Report\n')
for (const operation of ['mount', 'update', 'remount']) {
  console.log(`## ${operation[0]!.toUpperCase()}${operation.slice(1)}\n`)

  let count = 0

  for (const block of render) {
    const match = block.title.match(
      /^(\d+) cards — (\w+) · mount: (.*?) · update: (.*?) · remount: (.*)$/,
    )
    if (!match) continue

    const index = operation === 'mount' ? 3 : operation === 'update' ? 4 : 5
    const kind = match[2] === 'callable' ? 'static' : match[2]
    const title = `${Number(match[1]).toLocaleString('en-US')} cards (${kind}): ${compact(match[index]!)}`

    const rows = tables(block.body)
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| Cards') ||
          line.startsWith('| ---') ||
          line.includes(` | ${operation} | `),
      )
      .join('\n')

    print(title, rows)
    count++
  }

  if (!count) console.log('Results unavailable.\n')
}
console.log('## Compile\n')
const comparisons = compiler.filter((block) => /: [🟢🔴🟡]/u.test(block.title))
for (const block of comparisons) print(compact(block.title), tables(block.body))
if (!comparisons.length) console.log('Results unavailable.\n')
const extra = [
  ...compiler.filter((block) => !comparisons.includes(block)),
  ...render.filter((block) => block.title === 'Zyzz base comparison'),
]
if (extra.length)
  print(
    'Other results',
    extra
      .map(
        (block) =>
          `### ${block.title.replaceAll('—', ':')}\n\n${tables(block.body)}`,
      )
      .join('\n\n'),
  )
