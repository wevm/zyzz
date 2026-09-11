/** Verifies production delivery of stylesheet imports and namespaced module selectors. @module */
import * as Lightning from 'lightningcss'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test.each([false, 'lightningcss', 'esbuild'] as const)(
    'bundles %s imported CSS assets and namespace declarations in legal order',
    async (cssMinify) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-statements-vite-'))
      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<svg xmlns="http://www.w3.org/2000/svg"><rect id="icon"/></svg><script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          `import {css} from 'zyzz';import {namespace,importCss,global} from 'zyzz/web';namespace({uri:'http://www.w3.org/2000/svg'});importCss({url:'./base.css'});global({rect:{stroke:'blue'}});const props=css({fill:'red'})();document.querySelector('#icon').setAttribute('class',props.className);`,
        )
        await Fs.writeFile(
          Path.join(root, 'base.css'),
          'body{background-image:url(./pixel.svg)}',
        )
        await Fs.writeFile(
          Path.join(root, 'pixel.svg'),
          '<svg xmlns="http://www.w3.org/2000/svg"/>',
        )
        const build = await Vite.build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [zyzz()],
          build: { write: false, minify: false, cssMinify },
        })
        if (!('output' in build)) throw new Error('Expected one Rollup output')
        const css = build.output
          .filter(
            (value) =>
              value.type === 'asset' && value.fileName.endsWith('.css'),
          )
          .map((value) => (value.type === 'asset' ? String(value.source) : ''))
          .join('\n')
        const parsed = Lightning.transform({
          filename: 'built.css',
          code: Buffer.from(css),
        })
        expect({
          namespaceCount: (css.match(/@namespace /g) ?? []).length,
          importedAsset: css.includes('data:image/svg+xml'),
          shield: css.includes('@-zyzz-'),
          rules: parsed.code.toString().includes('|rect'),
        }).toMatchInlineSnapshot(`
          {
            "importedAsset": true,
            "namespaceCount": 1,
            "rules": true,
            "shield": false,
          }
        `)
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )
})
