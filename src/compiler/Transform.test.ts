import * as Trace from '@jridgewell/trace-mapping'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { expect, test } from 'vite-plus/test'
import { Transform } from 'zyzz/compiler'

const root = Path.resolve(import.meta.dirname, '../..')

test('folded applications need no runtime and maps trace Unicode and CRLF sources', async () => {
  const source = `import { css } from 'zyzz';\r\nconst text = '🎉';\r\nexport const props = css({ color: '#f00', padding: '8px' })();`
  const result = Transform.compile({ moduleId: 'example/inline.ts', source })
  const bundle = await Esbuild.build({
    bundle: true,
    format: 'esm',
    metafile: true,
    stdin: { contents: result.code, loader: 'ts' },
    write: false,
  })
  const cssMap = new Trace.TraceMap(result.cssMap)
  const map = new Trace.TraceMap(result.map)
  const outputLines = result.code.split('\n')
  const row = outputLines.findIndex((line) => line.includes('className'))
  expect({
    code: result.code,
    css: result.css,
    declarations: ['color:', 'padding:'].map((property) =>
      Trace.originalPositionFor(cssMap, {
        column: result.css.indexOf(property),
        line: 1,
      }),
    ),
    imports: bundle.metafile!.outputs['stdin.js']!.imports,
    javascript: Trace.originalPositionFor(map, {
      column: outputLines[row]!.indexOf('className'),
      line: row + 1,
    }),
    sources: [result.map.sources, result.cssMap.sources],
    sourcesContent: [result.map.sourcesContent, result.cssMap.sourcesContent],
  }).toMatchInlineSnapshot(`
    {
      "code": "
    const text = '🎉';
    export const props = ({className:"z-14fkufe1imnkw4-base0"});",
      "css": ".z-14fkufe1imnkw4-base0{color:#f00;padding:8px;}",
      "declarations": [
        {
          "column": 27,
          "line": 3,
          "name": "color",
          "source": "example/inline.ts",
        },
        {
          "column": 42,
          "line": 3,
          "name": "padding",
          "source": "example/inline.ts",
        },
      ],
      "imports": [],
      "javascript": {
        "column": 21,
        "line": 3,
        "name": null,
        "source": "example/inline.ts",
      },
      "sources": [
        [
          "example/inline.ts",
        ],
        [
          "example/inline.ts",
        ],
      ],
      "sourcesContent": [
        [
          "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
        ],
        [
          "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
        ],
      ],
    }
  `)
})

test('imports, hashbangs, type references, shadowing, and surrounding JSX survive rewriting', async () => {
  const sources = [
    `import other, { css } from 'zyzz'; export const props = css({})(); export { other };`,
    `"use client"; import { css } from 'zyzz'; export const button = css({});`,
    `#!/usr/bin/env node\nimport { css, Style } from 'zyzz'; export const button = css({}); export { Style };`,
    `import { Style, css, css as other } from 'zyzz'; export const a = css({})(); export const b = other({})(); export { Style };`,
    `import { css, css as other, Style } from 'zyzz'; export const a = css({})(); export const b = other({})(); export { Style };`,
    `import { css } from 'zyzz'; export type Signature = typeof css; export const button = css({});`,
    `import { css } from 'zyzz'; const __zyzzProps = 1; export const el = <button {...css({color:'#f00'})()} />; export const button = css({});`,
    `import { css } from 'zyzz'; export function f(value = css({})()) { var css; return value; }`,
    `export const untouched = '🎉';`,
  ]
  const outputs = []
  for (const source of sources) {
    const result = Transform.compile({ moduleId: 'example/syntax.tsx', source })
    await Esbuild.transform(result.code, { loader: 'tsx' })
    outputs.push(result.code)
  }
  expect(outputs).toMatchInlineSnapshot(`
    [
      "import other from 'zyzz'; export const props = ({className:""}); export { other };",
      ""use client";
    import { Props as __zyzzProps } from 'zyzz/runtime';
      export const button = __zyzzProps.create({className:""});",
      "#!/usr/bin/env node

    import { Props as __zyzzProps } from 'zyzz/runtime';
    import { Style } from 'zyzz'; export const button = __zyzzProps.create({className:""}); export { Style };",
      "import { Style,  } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
      "import { Style } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
      "
    import { Props as __zyzzProps } from 'zyzz/runtime';
    import { css } from 'zyzz'; export type Signature = typeof css; export const button = __zyzzProps.create({className:""});",
      "
    import { Props as __zyzzProps_ } from 'zyzz/runtime';
     const __zyzzProps = 1; export const el = <button {...({className:"z-15sihh01ggr9so-base0"})} />; export const button = __zyzzProps_.create({className:""});",
      "import { css } from 'zyzz'; export function f(value = ({className:""})) { var css; return value; }",
      "export const untouched = '🎉';",
    ]
  `)
})

test('separately transformed modules render without class collisions in Chromium', async () => {
  const browser = await chromium.launch()
  const directory = await Fs.mkdtemp(Path.join(root, '.fixture-transform-'))
  try {
    const first = Transform.compile({
      moduleId: 'package/first.ts',
      source: `import { css } from 'zyzz'; export const button = css({ color: '#f00', padding: '8px' });`,
    })
    const second = Transform.compile({
      moduleId: 'package/second.ts',
      source: `import { css } from 'zyzz'; export const props = css({ color: '#00f', padding: '4px' })();`,
    })
    await Fs.writeFile(Path.join(directory, 'first.ts'), first.code)
    await Fs.writeFile(Path.join(directory, 'second.ts'), second.code)
    const bundle = await Esbuild.build({
      alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
      bundle: true,
      format: 'iife',
      globalName: 'fixture',
      stdin: {
        contents: `import { button } from './first'; import { props } from './second'; export const values = [button(), props, button({ className: 'external', style: { paddingLeft: '2px' } })];`,
        loader: 'ts',
        resolveDir: directory,
      },
      write: false,
    })
    const page = await browser.newPage()
    await page.setContent('<!doctype html><body></body>')
    await page.addStyleTag({ content: first.css + '\n' + second.css })
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
    const result = await page.evaluate(`fixture.values.map(props => {
      const element = document.createElement('button');
      element.className = props.className;
      Object.assign(element.style, props.style);
      document.body.append(element);
      const style = getComputedStyle(element);
      return { color: style.color, padding: style.padding };
    })`)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "color": "rgb(255, 0, 0)",
          "padding": "8px",
        },
        {
          "color": "rgb(0, 0, 255)",
          "padding": "4px",
        },
        {
          "color": "rgb(255, 0, 0)",
          "padding": "8px 8px 8px 2px",
        },
      ]
    `)
  } finally {
    await browser.close()
    await Fs.rm(directory, { force: true, recursive: true })
  }
})

test('compiled library exports run against the packed runtime without a styling plugin', async () => {
  const directory = await Fs.mkdtemp(
    Path.join(root, '.fixture-transform-pack-'),
  )
  try {
    const run = Util.promisify(ChildProcess.execFile)
    await run('pnpm', ['build'], { cwd: root })
    await run('pnpm', ['pack', '--pack-destination', directory], { cwd: root })
    const archive = (await Fs.readdir(directory)).find((name) =>
      name.endsWith('.tgz'),
    )!
    const installed = Path.join(directory, 'node_modules/zyzz')
    await Fs.mkdir(installed, { recursive: true })
    await run('tar', [
      '-xzf',
      Path.join(directory, archive),
      '--strip-components=1',
      '-C',
      installed,
    ])
    const output = Transform.compile({
      moduleId: 'library/button.ts',
      source: `import { css } from 'zyzz'; export const button = css({ color: '#f00' });`,
    })
    await Fs.writeFile(Path.join(directory, 'button.ts'), output.code)
    const consumer = await run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { button } from './button.ts'; console.log(JSON.stringify(button({className:'external'})));`,
      ],
      { cwd: directory },
    )
    const bundle = await Esbuild.build({
      bundle: true,
      metafile: true,
      platform: 'browser',
      stdin: {
        contents: `export { button } from './button.ts'`,
        resolveDir: directory,
      },
      write: false,
    })
    const listing = await run('tar', ['-tzf', Path.join(directory, archive)])
    expect({
      compilerIncluded: Object.keys(bundle.metafile!.inputs).some((name) =>
        /oxc|compiler|web\/Css/.test(name),
      ),
      output: JSON.parse(consumer.stdout),
      testsPublished: /\.(?:test|test-d|bench)\.ts/.test(listing.stdout),
    }).toMatchInlineSnapshot(`
      {
        "compilerIncluded": false,
        "output": {
          "className": "z-fyitz4td647s-base0 external",
        },
        "testsPublished": false,
      }
    `)
  } finally {
    await Fs.rm(directory, { force: true, recursive: true })
  }
}, 30000)
