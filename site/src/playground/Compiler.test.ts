/** Exercises shared projects through the full Wasm compiler and native graph boundary. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import { beforeAll, describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'
import * as Compiler from './Compiler.js'
import * as Project from './Project.js'

let compiler: ReturnType<typeof Compiler.create>

beforeAll(() => {
  ChildProcess.execFileSync('node', ['scripts/build-playground.ts'], {
    cwd: new URL('../..', import.meta.url),
    stdio: 'pipe',
  })
  compiler = Compiler.create(
    Fs.readFileSync(
      new URL(
        '../../../target/playground/wasm32-wasip1/wasm/wasm.wasm',
        import.meta.url,
      ),
    ),
  )
}, 300_000)

describe('create', () => {
  test('compiles shared multi-file projects with native output parity', () => {
    for (const example of Object.values(Project.examples)) {
      const { files } = example
      const restored = Project.decode(Project.encode(files))
      expect(
        JSON.stringify(restored) === JSON.stringify(files),
      ).toMatchInlineSnapshot('true')
      const browser = compiler.compile(restored)
      const native = Graph.compile({ modules: files })
      for (const [path, module] of Object.entries(native.modules))
        expect(browser.files[path] === module.code).toMatchInlineSnapshot(
          'true',
        )
      expect(browser.css.includes('#6366f1')).toMatchInlineSnapshot('true')
      expect(browser.css.includes('background-color:')).toMatchInlineSnapshot(
        'true',
      )
    }
  })

  test('reports invalid source and recovers on the next edited project', () => {
    const files = { 'App.tsx': 'export default function App( {' }
    expect(() =>
      compiler.compile(Project.decode(Project.encode(files))),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Source.ExtractError: App.tsx:30: Expected \`}\` but found \`EOF\`]`,
    )
    const fixed = compiler.compile({
      'App.tsx': `import { style } from 'zyzz'; export const box = style({ paddingTop: '7px', paddingLeft: '13px' }); export default function App() { return <div {...box()}>修正 ✓</div> }`,
    })
    expect(fixed.css).toMatchInlineSnapshot(`
      ".z-l0kPgl-box-pt-0{padding-top:7px;}
      .z-l0kPgl-box-pl-1{padding-left:13px;}"
    `)
    expect(fixed.files['App.tsx']?.includes('修正 ✓')).toMatchInlineSnapshot(
      'true',
    )
  })
})
