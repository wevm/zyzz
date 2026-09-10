/** Checks eager stylesheet delivery across disconnected source and lazy modules. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'
describe('zyzz', () => {
  test('emits unimported global styles once in a production build', async () => {
    const root = await Fs.mkdtemp(Path.resolve('.fixture-contributions-vite-'))
    try {
      for (const [name, source] of Object.entries({
        'index.html': '<script type="module" src="/app.ts"></script>',
        'app.ts':
          'document.body.textContent="App"; globalThis.load=()=>import("./lazy.ts")',
        'lazy.ts':
          'import {css} from "zyzz"; export const lazy=css({color:"blue"})()',
        'global.ts':
          'import {global,layers} from "zyzz/web"; layers(["reset","app"]); global({body:{margin:0}})',
      }))
        await Fs.writeFile(Path.join(root, name), source)
      for (const directory of [
        'tests',
        '__tests__',
        'fixtures',
        '__fixtures__',
      ]) {
        await Fs.mkdir(Path.join(root, directory))
        await Fs.writeFile(
          Path.join(root, directory, 'example.ts'),
          'import {global} from "zyzz/web"; global({body:{color:"red"}})',
        )
      }
      const result = await Vite.build({
        root,
        configFile: false,
        logLevel: 'silent',
        plugins: [zyzz()],
        build: { write: false, minify: false, cssMinify: false },
      })
      const outputs = (Array.isArray(result) ? result : [result]).flatMap(
        (result) => ('output' in result ? result.output : []),
      )
      const css = outputs
        .filter(
          (output) =>
            output.type === 'asset' && output.fileName.endsWith('.css'),
        )
        .map((output) => (output.type === 'asset' ? String(output.source) : ''))
        .join('\n')
      expect(css).toMatchInlineSnapshot(`
        "@layer reset,app;
        body{margin:0;}
        .z-hdbty1i04nhy-base0{color:blue;}"
      `)
    } finally {
      await Fs.rm(root, { recursive: true, force: true })
    }
  })
})
