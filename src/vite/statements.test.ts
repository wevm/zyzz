/** Verifies production delivery of stylesheet imports and namespaced module selectors. @module */
import * as Trace from '@jridgewell/trace-mapping'
import * as Lightning from 'lightningcss'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Vite from 'vite'
import { describe, expect, test } from 'vite-plus/test'
import { zyzz } from 'zyzz/vite'

describe('zyzz', () => {
  test.each([false, 'esbuild', 'lightningcss'] as const)(
    'preserves font palette family lists through %s CSS minification',
    async (cssMinify) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-palette-list-'))
      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          `import {fontPaletteValues,global} from 'zyzz/web';const palette=fontPaletteValues({fontFamily:'Evidence, "Second Family"',basePalette:1});global({body:{fontPalette:palette}});`,
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
        expect(css.includes('@font-palette-values')).toMatchInlineSnapshot(
          'true',
        )
        expect(
          /font-family:\s*Evidence,\s*"Second Family"/.test(css),
        ).toMatchInlineSnapshot('true')
        expect(css.includes('@-zyzz-')).toMatchInlineSnapshot('false')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )
  test.each(['external', 'inline'] as const)(
    'composes %s maps after namespace hoisting',
    async (mode) => {
      const root = await Fs.mkdtemp(Path.resolve('.fixture-namespace-map-'))
      try {
        await Fs.writeFile(
          Path.join(root, 'index.html'),
          '<script type="module" src="/main.ts"></script>',
        )
        await Fs.writeFile(
          Path.join(root, 'main.ts'),
          `import {namespace,global} from 'zyzz/web';namespace({uri:'http://www.w3.org/2000/svg'});global({rect:{fill:'red'}});`,
        )
        const build = await Vite.build({
          root,
          configFile: false,
          logLevel: 'silent',
          plugins: [
            zyzz(),
            {
              name: 'css-map-producer',
              generateBundle: {
                order: 'pre',
                handler(_, bundle) {
                  for (const asset of Object.values(bundle)) {
                    if (
                      asset.type !== 'asset' ||
                      !asset.fileName.endsWith('.css')
                    )
                      continue
                    // A real CSS processor supplies the map consumed by the final prolog pass.
                    const result = Lightning.transform({
                      filename: 'before.css',
                      code: Buffer.from(
                        '@layer a { .first { color: red } } @layer b,a;' +
                          String(asset.source),
                      ),
                      sourceMap: true,
                      minify: true,
                    })
                    asset.source =
                      result.code.toString() +
                      '@layer x{.late{color:blue}}@layer y,x;'
                    if (mode === 'external') {
                      this.emitFile({
                        type: 'asset',
                        fileName: asset.fileName + '.map',
                        source: result.map!,
                      })
                      asset.source +=
                        '\n/*# sourceMappingURL=' +
                        Path.basename(asset.fileName) +
                        '.map */'
                    } else
                      asset.source +=
                        '\n/*# sourceMappingURL=data:application/json;base64,' +
                        Buffer.from(result.map!).toString('base64') +
                        ' */'
                  }
                },
              },
            },
          ],
          build: { write: false, cssMinify: false },
        })
        if (!('output' in build)) throw new Error('Expected one build')
        const asset = build.output.find(
          (asset) => asset.type === 'asset' && asset.fileName.endsWith('.css'),
        )!
        if (asset.type !== 'asset') throw new Error('Expected CSS')
        const css = String(asset.source)
        const external = build.output.find(
          (asset) =>
            asset.type === 'asset' && asset.fileName.endsWith('.css.map'),
        )
        const map =
          mode === 'external' && external?.type === 'asset'
            ? JSON.parse(String(external.source))
            : JSON.parse(
                Buffer.from(
                  css.match(/base64,([A-Za-z0-9+/=]+)/)![1]!,
                  'base64',
                ).toString(),
              )
        const offset = css.indexOf('|rect')
        const prefix = css.slice(0, offset)
        const original = Trace.originalPositionFor(new Trace.TraceMap(map), {
          line: prefix.split('\n').length,
          column: prefix.split('\n').at(-1)!.length,
        })
        expect(original.source).toMatchInlineSnapshot('"before.css"')
        const content = Trace.sourceContentFor(
          new Trace.TraceMap(map),
          original.source!,
        )!
        expect(
          content
            .split('\n')
            [original.line! - 1]!.slice(original.column!)
            .startsWith('z-n'),
        ).toMatchInlineSnapshot('true')
        expect(css.startsWith('@namespace ')).toMatchInlineSnapshot('true')
        expect(
          css.indexOf('@layer x{') < css.indexOf('@layer y,x;'),
        ).toMatchInlineSnapshot('true')
      } finally {
        await Fs.rm(root, { recursive: true, force: true })
      }
    },
  )
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
