/** Counts constant relocation while compiling component imports and shared tokens. @module */
import * as Inspector from 'node:inspector/promises'
import * as Module from 'node:module'
import * as Url from 'node:url'
import { Graph } from 'zyzz/compiler'

const session = new Inspector.Session()
session.connect()
try {
  await session.post('Profiler.enable')
  await session.post('Profiler.startPreciseCoverage', {
    callCount: true,
    detailed: true,
  })
  const compiler = Graph.create()
  const modules = {
    'tokens.ts': `export const tokens={color:'red'};`,
    'button.ts': `import {tokens} from './tokens';export default function Button(){return tokens.color}`,
    'page.ts': `import Button from './button';export default function Page(){return Button()}`,
    'index.ts': `export {default} from './page';`,
    'styles.ts': `import {style} from 'zyzz';import {tokens} from './tokens';export const button=style({color:tokens.color});`,
  }
  const imports = {
    'tokens.ts': {},
    'button.ts': { './tokens': 'tokens.ts' },
    'page.ts': { './button': 'button.ts' },
    'index.ts': { './page': 'page.ts' },
    'styles.ts': { zyzz: null, './tokens': 'tokens.ts' },
  }
  const graph = compiler.compile({ imports, modules })
  const { result } = await session.post('Profiler.takePreciseCoverage')
  const url = new URL(
    './Graph.js',
    Url.pathToFileURL(
      Module.createRequire(import.meta.url).resolve('zyzz/compiler'),
    ),
  ).href
  const relocate = result
    .find((script) => script.url === url)
    ?.functions.find((fn) => fn.functionName === 'relocate')
  if (!relocate) throw new Error('Missing constant relocation coverage.')
  const contractUrl = new URL('./internal/Contract.js', url).href
  if (
    !result
      .find((script) => script.url === contractUrl)
      ?.functions.some((fn) => fn.functionName === 'write')
  )
    throw new Error('Missing contract serialization coverage.')
  compiler.compile({
    imports: { ...imports, 'generated.tsx': {} },
    modules: {
      ...modules,
      'generated.tsx': 'export default function Page(){return <h1>Page</h1>}',
    },
  })
  const warm = await session.post('Profiler.takePreciseCoverage')
  const writes =
    warm.result
      .find((script) => script.url === contractUrl)
      ?.functions.find((fn) => fn.functionName === 'write')?.ranges[0]?.count ??
    0
  process.stdout.write(
    JSON.stringify({
      count: relocate.ranges[0]!.count,
      writes,
      css: graph.modules['styles.ts']!.css,
    }),
  )
} finally {
  await session.post('Profiler.stopPreciseCoverage')
  session.disconnect()
}
