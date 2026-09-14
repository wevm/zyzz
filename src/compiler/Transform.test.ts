/**
 * Exercises the public Transform workflow through real collaborating modules.
 * @module
 */
import * as Trace from '@jridgewell/trace-mapping'
import * as CssTree from 'css-tree'
import * as Esbuild from 'esbuild'
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { chromium } from 'playwright'
import { describe, expect, test } from 'vite-plus/test'
import * as Literal from '../internal/Literal.js'
import { Transform } from 'zyzz/compiler'
import * as Borders from '../../test/fixtures/Borders.js'
import * as Conformance from '../../test/fixtures/Conformance.js'
import * as Declarations from '../../test/fixtures/Declarations.js'
import * as Flex from '../../test/fixtures/Flex.js'
import * as Interaction from '../../test/fixtures/Interaction.js'
import * as Lengths from '../../test/fixtures/Lengths.js'
import * as Logical from '../../test/fixtures/Logical.js'
import * as Scrolling from '../../test/fixtures/Scrolling.js'
import * as Sizing from '../../test/fixtures/Sizing.js'
import * as Snapping from '../../test/fixtures/Snapping.js'
import * as Tables from '../../test/fixtures/Tables.js'
import * as TextDecoration from '../../test/fixtures/TextDecoration.js'
import * as TextFlow from '../../test/fixtures/TextFlow.js'

const root = Path.resolve(import.meta.dirname, '../..')

describe('compile', () => {
  test('CSS conformance covers every implemented property and pinned upstream grammar', async () => {
    const inventory = JSON.parse(
      await Fs.readFile(
        Path.join(root, 'test/conformance/coverage.json'),
        'utf8',
      ),
    ) as {
      families: { properties: Record<string, { status: string }> }
    }

    const implemented = [
      ...Object.keys(Literal.rules).map(Conformance.name),
      '--*',
    ].sort()

    const classified = Object.entries(inventory.families.properties)
      .filter(
        ([, entry]) =>
          entry.status === 'partial' || entry.status === 'supported',
      )
      .map(([name]) => name)
      .sort()

    expect(
      classified.filter((name) => !implemented.includes(name)),
    ).toMatchInlineSnapshot(`[]`)
    expect(
      implemented.filter((name) => !classified.includes(name)),
    ).toMatchInlineSnapshot(`[]`)

    const { stderr } = await Util.promisify(ChildProcess.execFile)(
      process.execPath,
      ['scripts/css-conformance.ts'],
      { cwd: root },
    )

    expect(stderr).toMatchInlineSnapshot(`""`)
  })

  test('CSS conformance fails stale grammars and unclassified upstream properties', async () => {
    const directory = await Fs.mkdtemp(
      Path.join(root, '.fixture-css-inventory-'),
    )

    try {
      const inventory = JSON.parse(
        await Fs.readFile(
          Path.join(root, 'test/conformance/coverage.json'),
          'utf8',
        ),
      ) as {
        families: {
          properties: Record<string, { grammar: string; status: string }>
        }
      }

      delete inventory.families.properties['display']
      inventory.families.properties['color']!.grammar = 'unreviewed'

      const file = Path.join(directory, 'coverage.json')

      await Fs.writeFile(file, JSON.stringify(inventory))

      const result = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )

      expect(result.status).toMatchInlineSnapshot(`1`)
      expect(result.stderr).toMatchInlineSnapshot(`
        "
        Changed properties: color
        Added properties: display
        Unclassified properties: display
        Review upstream changes with pnpm update:css, then classify coverage.json entries.
        "
      `)

      const update = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file, '--update'],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )

      expect(update.status).toMatchInlineSnapshot(`0`)

      const check = ChildProcess.spawnSync(
        process.execPath,
        ['scripts/css-conformance.ts', '--inventory', file],
        { cwd: root, encoding: 'utf8', timeout: 10_000 },
      )

      expect(check.status).toMatchInlineSnapshot(`1`)
      expect(check.stderr).toMatchInlineSnapshot(`
        "
        Unclassified properties: display
        Review upstream changes with pnpm update:css, then classify coverage.json entries.
        "
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  })

  test('CSS conformance validates emitted values against independent MDN grammar', () => {
    const cases = Conformance.cases()
    const lexer = Conformance.lexer()
    const failures: string[] = []

    // Batches bound compiler input size while still exercising fallback and importance rewriting.
    for (let start = 0; start < cases.length; start += 100) {
      const batch = cases.slice(start, start + 100)

      const source = `import { css } from 'zyzz';\n${batch
        .map(
          ({ property, value }, index) =>
            `export const case${index} = css({${property}: [${JSON.stringify(value)}, ${JSON.stringify(`${value}!`)}]})();`,
        )
        .join('\n')}`

      const output = Transform.compile({ moduleId: 'conformance.ts', source })
      let count = 0

      CssTree.walk(CssTree.parse(output.css), (node) => {
        if (node.type !== 'Declaration') return

        count++

        const value = CssTree.generate(node.value)
        const error = lexer.matchProperty(node.property, value).error

        if (error) failures.push(`${node.property}: ${value}: ${error.message}`)
      })

      if (count !== batch.length * 2)
        failures.push(`Declaration count: ${count} != ${batch.length * 2}`)
    }

    expect(failures).toMatchInlineSnapshot(`[]`)
  }, 30_000)

  test('CSS conformance preserves consumer types for every accepted probe', async () => {
    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-css-types-'))

    try {
      const cases = Conformance.cases()
      const groups = new Map<string, string>()

      const declarations = Conformance.properties().map((property) => {
        const values = [
          ...cases
            .filter((entry) => entry.property === property)
            .map(({ value }) => value),
          'var(--probe)',
          'var(--probe,)',
          'calc(1px + var(--probe))',
        ].flatMap((value) => [value, `${value}!`])

        const key = JSON.stringify(values)
        let group = groups.get(key)

        if (!group) {
          group = `values${groups.size}`
          groups.set(key, group)
        }

        return `${group} satisfies readonly Style.Properties['${property}'][];\ncss({${JSON.stringify(property)}: [${values
          .slice(0, 16)
          .map((value) => JSON.stringify(value))
          .join(',')}]});`
      })

      const rejections = Conformance.rejected.map(
        ({ property, value }) =>
          `// @ts-expect-error Invalid or deliberately unsupported scalar.\ncss({${property}: ${JSON.stringify(value)}});\n// @ts-expect-error Importance must preserve rejection.\ncss({${property}: ${JSON.stringify(`${value}!`)}});`,
      )
      const booleans = Conformance.properties().map(
        (property) =>
          `css({${JSON.stringify(property)}: [' InHeRiT ! ImPoRtAnT ', ${JSON.stringify(String.raw`\69 nherit/**/!impor\74 ant`)}]});\n// @ts-expect-error Booleans are outside every CSS scalar domain.\ncss({${JSON.stringify(property)}: true});`,
      )
      const source = `/** Checks generated consumer declarations. @module */\nimport { describe, test } from 'vite-plus/test';\nimport { css, type Style } from 'zyzz';\ndescribe('css', () => {\n  test('validates generated conformance probes', () => {\n${[...[...groups].map(([values, group]) => `const ${group} = ${values} as const;`), ...declarations, ...rejections, ...booleans].join('\n')}\n  });\n});`

      await Fs.writeFile(Path.join(directory, 'consumer.test-d.ts'), source)
      await Fs.writeFile(
        Path.join(directory, 'tsconfig.json'),
        JSON.stringify({
          exclude: [],
          extends: '../tsconfig.json',
          include: ['./consumer.test-d.ts'],
        }),
      )

      const require = Module.createRequire(import.meta.url)

      const { stderr, stdout } = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '--max-old-space-size=6144',
          require.resolve('typescript/bin/tsc'),
          '--project',
          Path.join(directory, 'tsconfig.json'),
        ],
        { cwd: root, maxBuffer: 1024 * 1024, timeout: 300_000 },
      ).catch(async (error: unknown) => {
        await Fs.mkdir(Path.join(root, 'test-results'), { recursive: true })
        await Fs.writeFile(
          Path.join(root, 'test-results/css-consumer.test-d.ts'),
          source,
        )

        if (error && typeof error === 'object' && 'stdout' in error)
          throw new Error(
            String(error.stdout) ||
              String('stderr' in error ? error.stderr : error),
          )

        throw error
      })

      expect(stderr).toMatchInlineSnapshot(`""`)
      expect(stdout).toMatchInlineSnapshot(`""`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  }, 310_000)

  test('interaction declarations preserve importance and source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/interaction.ts',
      source: Interaction.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-cursor-not-allowed-hrqp9k1qf0cja-0{cursor:not-allowed;}
      .z-pointer-events-hrqp9k1qf0cja-1{pointer-events:auto;pointer-events:none!important;pointer-events:auto;}
      .z-resize-none-hrqp9k1qf0cja-2{resize:none;}
      .z-user-select-none-hrqp9k1qf0cja-3{user-select:none;}
      .z-visibility-visible-hrqp9k1qf0cja-4{visibility:visible;}
      .z-cursor-text-19n9cka1ysomsq-0{cursor:text;}
      .z-pointer-events-auto-19n9cka1ysomsq-1{pointer-events:auto;}
      .z-resize-both-19n9cka1ysomsq-2{resize:both;}
      .z-user-select-text-19n9cka1ysomsq-3{user-select:text;}
      .z-visibility-visible-19n9cka1ysomsq-4{visibility:visible;}
      .z-cursor-default-1o0knt61yrzf6q-0{cursor:default;}
      .z-pointer-events-auto-1o0knt61yrzf6q-1{pointer-events:auto;}
      .z-resize-none-1o0knt61yrzf6q-2{resize:none;}
      .z-user-select-auto-1o0knt61yrzf6q-3{user-select:auto;}
      .z-visibility-hidden-1o0knt61yrzf6q-4{visibility:hidden;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('pointer-events:none!important'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        column: lines[line]!.indexOf('pointer-events:none!important'),
        line: line + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 45,
        "line": 4,
        "name": "pointerEvents",
        "source": "example/interaction.ts",
      }
    `)
  })

  test('interaction declarations match browser hit testing, selection, and visibility', async () => {
    const output = Transform.compile({
      moduleId: 'example/interaction.ts',
      source: Interaction.source,
    })
    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>.panel{position:relative;width:160px;height:60px;margin:8px}.panel>button,.overlay{position:absolute;inset:0;width:160px;height:60px;box-sizing:border-box}.overlay{overflow:auto;background:white}${output.css}</style>${Object.entries(
          Interaction.controls,
        )
          .map(
            ([name, css]) =>
              `<div class="panel"><button>Underneath</button><div id="${name}" class="overlay ${module[name].className}">Selection</div></div><div class="panel"><button>Underneath</button><div id="${name}-control" class="overlay" style="${css}">Selection</div></div>`,
          )
          .join('')}`,
      )

      expect(
        await page.evaluate(
          (names) =>
            names.filter((name) => {
              const actual = document.getElementById(name)!
              const control = document.getElementById(`${name}-control`)!
              const a = getComputedStyle(actual)
              const b = getComputedStyle(control)

              return (
                [
                  'cursor',
                  'pointer-events',
                  'resize',
                  'user-select',
                  'visibility',
                ].some(
                  (property) =>
                    a.getPropertyValue(property) !==
                    b.getPropertyValue(property),
                ) ||
                actual.getBoundingClientRect().height !==
                  control.getBoundingClientRect().height
              )
            }),
          Object.keys(Interaction.controls),
        ),
      ).toMatchInlineSnapshot(`[]`)

      await page.evaluate(() => {
        for (const panel of document.querySelectorAll('.panel'))
          panel.addEventListener('click', (event) => {
            const target = event.target as HTMLElement

            panel.setAttribute('data-target', target.tagName)
          })
      })

      for (const name of Object.keys(Interaction.controls)) {
        for (const suffix of ['', '-control']) {
          const box = await page
            .locator(`#${name}${suffix}`)
            .evaluate((element) => {
              const rect = element.getBoundingClientRect()

              return { x: rect.x, y: rect.y }
            })

          await page.mouse.click(box.x + 80, box.y + 30)
        }
      }

      expect(
        await page
          .locator('.panel')
          .evaluateAll((elements) =>
            elements.map((element) => element.getAttribute('data-target')),
          ),
      ).toMatchInlineSnapshot(`
        [
          "BUTTON",
          "BUTTON",
          "DIV",
          "DIV",
          "BUTTON",
          "BUTTON",
        ]
      `)
      expect(
        await page
          .locator('#hidden')
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toMatchInlineSnapshot(`60`)

      // Isolate selection from the disabled control's hit-testing declaration.
      await page
        .locator('#disabled')
        .evaluate((element) =>
          element.style.setProperty('pointer-events', 'auto', 'important'),
        )
      await page.locator('#disabled').dblclick({ position: { x: 20, y: 8 } })

      expect(
        await page.evaluate(() => getSelection()!.toString()),
      ).toMatchInlineSnapshot(`""`)

      await page.locator('#editable').dblclick({ position: { x: 20, y: 8 } })

      expect(
        await page.evaluate(() => getSelection()!.toString()),
      ).toMatchInlineSnapshot(`"Selection"`)
    } finally {
      await browser.close()
    }
  })

  test('table declarations preserve fallback priority and source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/tables.ts',
      source: Tables.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z-border-collapse-collapse-1h8f7gx12wimgh-0{border-collapse:collapse;}
      .z-border-spacing-12px-1h8f7gx12wimgh-1{border-spacing:12px;}
      .z-caption-side-top-1h8f7gx12wimgh-2{caption-side:top;}
      .z-empty-cells-show-1h8f7gx12wimgh-3{empty-cells:show;}
      .z-table-layout-auto-1h8f7gx12wimgh-4{table-layout:auto;}
      .z-border-collapse-separate-1y75vpv560ntb-0{border-collapse:separate;}
      .z-border-spacing-1y75vpv560ntb-1{border-spacing:2px;border-spacing:8px!important;border-spacing:4px;}
      .z-caption-side-bottom-1y75vpv560ntb-2{caption-side:bottom;}
      .z-empty-cells-hide-1y75vpv560ntb-3{empty-cells:hide;}
      .z-table-layout-fixed-1y75vpv560ntb-4{table-layout:fixed;}
      .z-border-collapse-separate-ijbcd157nwdj-0{border-collapse:separate;}
      .z-border-spacing-0-ijbcd157nwdj-1{border-spacing:0;}
      .z-caption-side-top-ijbcd157nwdj-2{caption-side:top;}
      .z-empty-cells-show-ijbcd157nwdj-3{empty-cells:show;}
      .z-table-layout-fixed-ijbcd157nwdj-4{table-layout:fixed;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('border-spacing:8px!important'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        column: lines[line]!.indexOf('border-spacing:8px!important'),
        line: line + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 49,
        "line": 4,
        "name": "borderSpacing",
        "source": "example/tables.ts",
      }
    `)
  })

  test('table declarations match browser layout and inherited cell styles', async () => {
    const output = Transform.compile({
      moduleId: 'example/tables.ts',
      source: Tables.source,
    })
    const js = await Esbuild.transform(output.code, {
      format: 'esm',
      loader: 'ts',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const rows =
        '<caption>Caption</caption><tbody><tr><td>Wide content</td><td></td></tr><tr><td>A</td><td>B</td></tr></tbody>'

      await page.setContent(
        `<style>table{width:240px}td{border:2px solid;padding:0;height:24px}${output.css}</style>${Object.entries(
          Tables.controls,
        )
          .map(
            ([name, css]) =>
              `<table id="${name}" class="${module[name].className}">${rows}</table><table id="${name}-control" style="${css}">${rows}</table>`,
          )
          .join('')}`,
      )

      for (const direction of ['ltr', 'rtl']) {
        await page.locator('body').evaluate((element, direction) => {
          element.style.direction = direction
        }, direction)

        expect(
          await page.evaluate(
            (names) =>
              names.filter((name) => {
                const actual = document.getElementById(name)!
                const control = document.getElementById(`${name}-control`)!

                for (const selector of [
                  '',
                  'caption',
                  'td',
                  'td:nth-child(2)',
                ]) {
                  const a = selector ? actual.querySelector(selector)! : actual
                  const b = selector
                    ? control.querySelector(selector)!
                    : control
                  const aa = getComputedStyle(a)
                  const bb = getComputedStyle(b)
                  if (
                    [
                      'border-collapse',
                      'border-spacing',
                      'caption-side',
                      'empty-cells',
                      'table-layout',
                    ].some(
                      (property) =>
                        aa.getPropertyValue(property) !==
                        bb.getPropertyValue(property),
                    )
                  )
                    return true

                  const ar = a.getBoundingClientRect()
                  const br = b.getBoundingClientRect()
                  if (
                    ar.width !== br.width ||
                    ar.height !== br.height ||
                    ar.top - actual.getBoundingClientRect().top !==
                      br.top - control.getBoundingClientRect().top
                  )
                    return true
                }

                return false
              }),
            Object.keys(Tables.controls),
          ),
        ).toMatchInlineSnapshot(`[]`)
      }

      expect(
        await page.locator('#separated').evaluate((element) => {
          const cells = element.querySelectorAll('td')

          return {
            captionBelow:
              element.querySelector('caption')!.getBoundingClientRect().top >=
              cells[2]!.getBoundingClientRect().bottom,
            emptyCells: getComputedStyle(cells[1]!).emptyCells,
            gap:
              cells[0]!.getBoundingClientRect().left -
              cells[1]!.getBoundingClientRect().right,
            spacing: getComputedStyle(element).borderSpacing,
            tableLayout: getComputedStyle(element).tableLayout,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "captionBelow": true,
          "emptyCells": "hide",
          "gap": 8,
          "spacing": "8px",
          "tableLayout": "fixed",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('text decorations preserve color domains, spacing tokens, priority, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/decoration.ts',
      source: TextDecoration.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-aauzfj1an5ia3-zyzz-theme{--z-taauzfj1an5ia3-zyzz-color_2e_brand:#06c;--z-taauzfj1an5ia3-zyzz-spacing_2e_stroke:2px;--z-taauzfj1an5ia3-zyzz-spacing_2e_offset:4px;}
      .z-text-decoration-line-underline-17kqdshmmi171-0{text-decoration-line:underline;}
      .z-text-decoration-thickness-from-font-17kqdshmmi171-1{text-decoration-thickness:from-font;}
      .z-text-underline-offset-auto-17kqdshmmi171-2{text-underline-offset:auto;}
      .z-text-decoration-skip-ink-auto-17kqdshmmi171-3{text-decoration-skip-ink:auto;}
      .z-text-decoration-line-68dyc5mo62dd-0{text-decoration-line:underline;text-decoration-line:underline overline!important;}
      .z-text-decoration-color-aauzfjka8ll{text-decoration-color:var(--z-taauzfj1an5ia3-zyzz-color_2e_brand,#06c);}
      .z-text-decoration-style-wavy-aauzfjka8ll{text-decoration-style:wavy;}
      .z-text-decoration-thickness-68dyc5mo62dd-3{text-decoration-thickness:var(--z-taauzfj1an5ia3-zyzz-spacing_2e_stroke,2px);}
      .z-text-underline-offset-68dyc5mo62dd-4{text-underline-offset:var(--z-taauzfj1an5ia3-zyzz-spacing_2e_offset,4px);}
      .z-text-decoration-skip-ink-none-68dyc5mo62dd-5{text-decoration-skip-ink:none;}
      .z-text-decoration-line-line-through-621a1xmsx0pz-0{text-decoration-line:line-through;}
      .z-text-decoration-thickness-621a1xmsx0pz-1{text-decoration-thickness:10%;}
      .z-text-underline-offset-621a1xmsx0pz-2{text-underline-offset:-10%;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('text-decoration-line:underline overline'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('text-decoration-line:underline overline'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 34,
        "line": 5,
        "name": "textDecorationLine",
        "source": "example/decoration.ts",
      }
    `)
  })

  test('text decorations match native browser controls across writing modes', async () => {
    const output = Transform.compile({
      moduleId: 'example/decoration.ts',
      source: TextDecoration.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>body{font:24px/2 monospace}${output.css}</style><main>${Object.entries(
          TextDecoration.controls,
        )
          .map(
            ([name, css]) =>
              `<div id="${name}" class="${module[name].className}">Typography</div><div id="${name}-control" style="${css}">Typography</div>`,
          )
          .join('')}</main>`,
      )

      for (const writingMode of ['horizontal-tb', 'vertical-lr', 'vertical-rl'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, mode) => {
              element.style.direction = mode.direction
              element.style.writingMode = mode.writingMode
            },
            { direction, writingMode },
          )

          expect(
            await page.evaluate((names) => {
              const properties = [
                'text-decoration-color',
                'text-decoration-line',
                'text-decoration-style',
                'text-decoration-thickness',
                'text-decoration-skip-ink',
                'text-underline-offset',
              ]

              return names.filter((name) => {
                const actual = getComputedStyle(document.getElementById(name)!)
                const control = getComputedStyle(
                  document.getElementById(`${name}-control`)!,
                )

                return properties.some(
                  (property) =>
                    actual.getPropertyValue(property) !==
                    control.getPropertyValue(property),
                )
              })
            }, Object.keys(TextDecoration.controls)),
          ).toMatchInlineSnapshot(`[]`)
        }

      expect(
        await page.locator('#decorated').evaluate((element) => {
          const style = getComputedStyle(element)

          return {
            color: style.textDecorationColor,
            line: style.textDecorationLine,
            offset: style.textUnderlineOffset,
            skip: style.textDecorationSkipInk,
            style: style.textDecorationStyle,
            thickness: style.textDecorationThickness,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "color": "rgb(0, 102, 204)",
          "line": "underline overline",
          "offset": "4px",
          "skip": "none",
          "style": "wavy",
          "thickness": "2px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('text flow preserves indentation tokens, fallback priority, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/text.ts',
      source: TextFlow.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-r52i20xb74bg-zyzz-theme{--z-tr52i20xb74bg-zyzz-spacing_2e_indent:12px;}
      .z-w-65px-1l37qb61vcrkwa-0{width:65px;}
      .z-word-break-break-all-r52i20lbjq9i{word-break:break-all;}
      .z-letter-spacing-r52i20lbjq9i{letter-spacing:normal;letter-spacing:2px;}
      .z-w-200px-kava101vdbp9m-0{width:200px;}
      .z-text-indent-r52i20lbjq9i{text-indent:var(--z-tr52i20xb74bg-zyzz-spacing_2e_indent,12px);}
      .z-text-align-last-start-r52i20lbjq9i{text-align-last:start;}
      .z-hyphens-manual-r52i20lbjq9i{hyphens:manual;}
      .z-text-transform-uppercase-r52i20lbjq9i{text-transform:uppercase;}
      .z-w-65px-q7z0bc1vbzwdm-0{width:65px;}
      .z-overflow-hidden-r52i20lbjq9i{overflow:hidden;}
      .z-white-space-q7z0bc1vbzwdm-2{white-space:pre;white-space:nowrap!important;}
      .z-text-overflow-ellipsis-r52i20lbjq9i{text-overflow:ellipsis;}
      .z-word-spacing-3px-r52i20lbjq9i{word-spacing:3px;}
      .z-w-65px-o069sz1va5jgl-0{width:65px;}
      .z-overflow-wrap-anywhere-r52i20lbjq9i{overflow-wrap:anywhere;}
      .z-white-space-normal-o069sz1va5jgl-2{white-space:normal;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('white-space:nowrap'))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('white-space:nowrap'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 78,
        "line": 6,
        "name": "whiteSpace",
        "source": "example/text.ts",
      }
    `)
  })

  test('text flow wraps and spaces text like native CSS in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/text.ts',
      source: TextFlow.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const text = 'abcdefghij'

      await page.setContent(
        `<style>body{font:20px/1 monospace}${output.css}</style>${Object.entries(
          TextFlow.controls,
        )
          .map(
            ([name, control]) =>
              `<div id="${name}" class="${module[name].className}"><span>${text}</span></div><div id="${name}-control" style="${control}"><span>${text}</span></div>`,
          )
          .join(
            '',
          )}<span id="letters-measure" class="${module.letters.className}">abcd</span><span id="letters-plain">abcd</span><span id="words-measure" class="${module.words.className}">a a</span><span id="words-plain">a a</span>`,
      )

      expect(
        await page.evaluate((names) => {
          const properties = [
            'hyphens',
            'letter-spacing',
            'overflow-wrap',
            'text-align-last',
            'text-indent',
            'text-overflow',
            'text-transform',
            'white-space',
            'word-break',
            'word-spacing',
          ]

          return names.filter((name) => {
            const actual = document.getElementById(name)!
            const control = document.getElementById(`${name}-control`)!
            const style = getComputedStyle(actual)
            const expected = getComputedStyle(control)

            return (
              actual.scrollWidth !== control.scrollWidth ||
              actual.getBoundingClientRect().height !==
                control.getBoundingClientRect().height ||
              properties.some(
                (property) =>
                  style.getPropertyValue(property) !==
                  expected.getPropertyValue(property),
              )
            )
          })
        }, Object.keys(TextFlow.controls)),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        await page.evaluate(() => {
          const width = (id: string) =>
            document.getElementById(id)!.getBoundingClientRect().width
          const paragraph = document.getElementById('paragraph')!
          const truncate = document.getElementById('truncate')!

          return {
            brokenHeight: document
              .getElementById('breaks')!
              .getBoundingClientRect().height,
            indent:
              paragraph.firstElementChild!.getBoundingClientRect().left -
              paragraph.getBoundingClientRect().left,
            letterSpacing: width('letters-measure') - width('letters-plain'),
            truncatedHeight: truncate.getBoundingClientRect().height,
            truncates: truncate.scrollWidth > truncate.clientWidth,
            wordSpacing: width('words-measure') - width('words-plain'),
            wrappedHeight: document
              .getElementById('wrap')!
              .getBoundingClientRect().height,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "brokenHeight": 40,
          "indent": 12,
          "letterSpacing": 8,
          "truncatedHeight": 20,
          "truncates": true,
          "wordSpacing": 3,
          "wrappedHeight": 40,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('scroll snap preserves compound keywords, fallback importance, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/snapping.ts',
      source: Snapping.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-10s7rhx1h1kg6d-zyzz-theme{--z-t10s7rhx1h1kg6d-zyzz-spacing_2e_edge:10px;}
      .z-flex-10s7rhxklyqxj{display:flex;}
      .z-gap-40px-10s7rhxklyqxj{gap:40px;}
      .z-overflow-auto-10s7rhxklyqxj{overflow:auto;}
      .z-w-100px-g5we7w1j6yvcq-3{width:100px;}
      .z-h-100px-g5we7w1j6yvcq-4{height:100px;}
      .z-scroll-padding-g5we7w1j6yvcq-5{scroll-padding:var(--z-t10s7rhx1h1kg6d-zyzz-spacing_2e_edge,10px);}
      .z-scroll-snap-type-g5we7w1j6yvcq-6{scroll-snap-type:x proximity;scroll-snap-type:x mandatory!important;}
      .z-flex-direction-column-10s7rhxklyqxj{flex-direction:column;}
      .z-w-100px-gsitgs1j8c2ri-1{width:100px;}
      .z-h-100px-gsitgs1j8c2ri-2{height:100px;}
      .z-scroll-padding-10px-gsitgs1j8c2ri-3{scroll-padding:10px;}
      .z-scroll-snap-type-gsitgs1j8c2ri-4{scroll-snap-type:y mandatory;}
      .z-w-60px-14nl6kr1j3lzlj-0{width:60px;}
      .z-h-60px-14nl6kr1j3lzlj-1{height:60px;}
      .z-flex-shrink-0-10s7rhxklyqxj{flex-shrink:0;}
      .z-scroll-margin-5px-10s7rhxklyqxj{scroll-margin:5px;}
      .z-scroll-snap-align-start-14nl6kr1j3lzlj-4{scroll-snap-align:start;}
      .z-scroll-snap-stop-10s7rhxklyqxj{scroll-snap-stop:normal;scroll-snap-stop:always!important;}
      .z-scroll-snap-align-w7s3ux1j4ttlr-0{scroll-snap-align:none center;}
      .z-scroll-snap-type-w7s3ux1j4ttlr-1{scroll-snap-type:both proximity;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('scroll-snap-type:x mandatory'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('scroll-snap-type:x mandatory'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 53,
        "line": 5,
        "name": "scrollSnapType",
        "source": "example/snapping.ts",
      }
    `)
  })

  test('scroll snap aligns both axes and respects always stops in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/snapping.ts',
      source: Snapping.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const children = (props: string) =>
        Array.from({ length: 5 }, () => `<div ${props}></div>`).join('')

      await page.setContent(
        `<style>${output.css}</style>${['horizontal', 'vertical'].map((axis) => `<div id="${axis}" class="${module[axis].className}">${children(`class="${module.item.className}"`)}</div><div id="${axis}-control" style="${Snapping.controls[axis as 'horizontal' | 'vertical']}">${children(`style="${Snapping.controls.item}"`)}</div>`).join('')}<div id="pair" class="${module.pair.className}"></div>`,
      )

      expect(
        await page.evaluate(() => {
          const horizontal = document.getElementById('horizontal')!
          const vertical = document.getElementById('vertical')!
          const horizontalControl =
            document.getElementById('horizontal-control')!
          const verticalControl = document.getElementById('vertical-control')!

          horizontal.scrollTo({ left: 75, behavior: 'instant' })
          horizontalControl.scrollTo({ left: 75, behavior: 'instant' })
          vertical.scrollTo({ top: 75, behavior: 'instant' })
          verticalControl.scrollTo({ top: 75, behavior: 'instant' })

          return {
            horizontal: horizontal.scrollLeft,
            horizontalControl: horizontalControl.scrollLeft,
            vertical: vertical.scrollTop,
            verticalControl: verticalControl.scrollTop,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "horizontal": 85,
          "horizontalControl": 85,
          "vertical": 85,
          "verticalControl": 85,
        }
      `)
      expect(
        await page.evaluate(() => {
          const horizontal = document.getElementById('horizontal')!
          const control = document.getElementById('horizontal-control')!

          horizontal.scrollTo({ left: 0, behavior: 'instant' })
          control.scrollTo({ left: 0, behavior: 'instant' })
          horizontal.scrollBy({ left: 350, behavior: 'instant' })
          control.scrollBy({ left: 350, behavior: 'instant' })

          return { actual: horizontal.scrollLeft, control: control.scrollLeft }
        }),
      ).toMatchInlineSnapshot(`
        {
          "actual": 85,
          "control": 85,
        }
      `)
      expect(
        await page.locator('#pair').evaluate((element) => ({
          align: getComputedStyle(element).scrollSnapAlign,
          type: getComputedStyle(element).scrollSnapType,
        })),
      ).toMatchInlineSnapshot(`
        {
          "align": "none center",
          "type": "both",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('scroll spacing preserves token domains, priority, and source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/scrolling.ts',
      source: Scrolling.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1567lwky4x5t8-zyzz-theme{--z-t1567lwky4x5t8-zyzz-spacing_2e_offset:20px;--z-t1567lwky4x5t8-zyzz-spacing_2e_auto:24px;}
      .z-overflow-auto-1567lwk17kf85i{overflow:auto;}
      .z-h-100px-1ha4fmnr9e84n-1{height:100px;}
      .z-w-100px-1567lwk17kf85i{width:100px;}
      .z-scroll-behavior-auto-1ha4fmnr9e84n-3{scroll-behavior:auto;}
      .z-scroll-padding-top-1ha4fmnr9e84n-4{scroll-padding-top:10px;scroll-padding-top:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_offset,20px);}
      .z-scroll-padding-inline-auto-1ha4fmnr9e84n-5{scroll-padding-inline:auto;}
      .z-overscroll-behavior-1ha4fmnr9e84n-6{overscroll-behavior:auto;overscroll-behavior:contain!important;}
      .z-overscroll-behavior-x-none-1ha4fmnr9e84n-7{overscroll-behavior-x:none;}
      .z-scroll-margin-top-10px-1567lwk17kf85i{scroll-margin-top:10px;}
      .z-h-20px-11a29dbr4ip6t-1{height:20px;}
      .z-scroll-padding-top-k0q6srr4mj4z-0{scroll-padding-top:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_auto,24px);}
      .z-scroll-padding-block-start-3b1z8ar6m5wk-0{scroll-padding-block-start:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_offset,20px)!important;}
      .z-scroll-behavior-smooth-14rbps1r5vrnz-0{scroll-behavior:smooth;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('scroll-padding-top:var('),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('scroll-padding-top:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 27,
        "line": 5,
        "name": "scrollPaddingTop",
        "source": "example/scrolling.ts",
      }
    `)
  })

  test('scroll spacing offsets scroll-into-view in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/scrolling.ts',
      source: Scrolling.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const contents = (target: string) =>
        `<div style="height:300px"></div><div ${target}></div><div style="height:300px"></div>`

      await page.setContent(
        `<style>${output.css}</style><div id="actual" class="${module.container.className}">${contents(`class="${module.target.className}"`)}</div><div id="control" style="overflow:auto;height:100px;width:100px;scroll-padding-top:20px;scroll-behavior:auto">${contents('style="scroll-margin-top:10px;height:20px"')}</div><div id="smooth" class="${module.smooth.className}" style="overflow:auto;height:100px"><div style="height:500px"></div></div>`,
      )

      expect(
        await page.evaluate(() => {
          const actual = document.getElementById('actual')!
          const control = document.getElementById('control')!

          actual.children[1]!.scrollIntoView({ block: 'start' })
          control.children[1]!.scrollIntoView({ block: 'start' })

          const style = getComputedStyle(actual)

          return {
            actual: actual.scrollTop,
            control: control.scrollTop,
            overscrollX: style.overscrollBehaviorX,
            overscrollY: style.overscrollBehaviorY,
            paddingInline: style.scrollPaddingInline,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "actual": 270,
          "control": 270,
          "overscrollX": "contain",
          "overscrollY": "contain",
          "paddingInline": "auto",
        }
      `)

      await page
        .locator('#smooth')
        .evaluate((element) => element.scrollTo({ top: 100 }))
      await page.waitForFunction(
        () => document.getElementById('smooth')!.scrollTop === 100,
        undefined,
        { timeout: 5000 },
      )

      expect(
        await page.locator('#smooth').evaluate((element) => ({
          behavior: getComputedStyle(element).scrollBehavior,
          position: element.scrollTop,
        })),
      ).toMatchInlineSnapshot(`
        {
          "behavior": "smooth",
          "position": 100,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('intrinsic sizing preserves keyword precedence, explicit tokens, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/sizing.ts',
      source: Sizing.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-flktdz142jfd9-zyzz-theme{--z-tflktdz142jfd9-zyzz-spacing_2e_min-content:24px;--z-tflktdz142jfd9-zyzz-spacing_2e_narrow:40px;}
      .z-inline-size-min-content-19gzop8gwd2d8-0{inline-size:min-content;}
      .z-inline-size-max-content-tiozv6gx6wce-0{inline-size:max-content;}
      .z-inline-size-yjnq9egx2f3y-0{inline-size:100%;inline-size:fit-content!important;}
      .z-min-width-auto-yjnq9egx2f3y-1{min-width:auto;}
      .z-max-width-none-yjnq9egx2f3y-2{max-width:none;}
      .z-w-86e3eugxqbjy-0{width:var(--z-tflktdz142jfd9-zyzz-spacing_2e_min-content,24px);}
      .z-min-inline-size-17r7hczgt2byz-0{min-inline-size:var(--z-tflktdz142jfd9-zyzz-spacing_2e_narrow,40px);}
      .z-max-inline-size-max-content-17r7hczgt2byz-1{max-inline-size:max-content;}
      .z-block-size-fit-content-17r7hczgt2byz-2{block-size:fit-content;}
      .z-min-block-size-auto-17r7hczgt2byz-3{min-block-size:auto;}
      .z-max-block-size-none-17r7hczgt2byz-4{max-block-size:none;}
      .z-flex-basis-content-3v2do9gudc8v-0{flex-basis:content;}
      .z-w-5px-3v2do9gudc8v-1{width:5px;}
      .z-flex-shrink-0-flktdzy3hkiz{flex-shrink:0;}
      .z-min-width-0-3v2do9gudc8v-3{min-width:0;}
      .z-flex-basis-auto-1elg22tgukc9d-0{flex-basis:auto;}
      .z-w-5px-1elg22tgukc9d-1{width:5px;}
      .z-min-width-0-1elg22tgukc9d-2{min-width:0;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('inline-size:fit-content'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('inline-size:fit-content'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 43,
        "line": 5,
        "name": "inlineSize",
        "source": "example/sizing.ts",
      }
    `)
  })

  test('intrinsic sizing and flex content resolve native browser widths', async () => {
    const output = Transform.compile({
      moduleId: 'example/sizing.ts',
      source: Sizing.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const content =
        '<span style="display:inline-block;width:40px;height:10px"></span><wbr><span style="display:inline-block;width:40px;height:10px"></span>'

      await page.setContent(
        `<style>${output.css}</style><main style="width:60px">${['minimum', 'maximum', 'fit'].map((name) => `<div id="${name}" class="${module[name].className}">${content}</div>`).join('')}<div id="explicit" class="${module.explicit.className}"></div></main><section style="display:flex;width:200px"><div id="content" class="${module.content.className}">${content}</div><div id="automatic" class="${module.automatic.className}">${content}</div></section>`,
      )

      expect(
        await page.evaluate(() =>
          Object.fromEntries(
            [
              'minimum',
              'maximum',
              'fit',
              'explicit',
              'content',
              'automatic',
            ].map((id) => [
              id,
              document.getElementById(id)!.getBoundingClientRect().width,
            ]),
          ),
        ),
      ).toMatchInlineSnapshot(`
        {
          "automatic": 5,
          "content": 80,
          "explicit": 24,
          "fit": 60,
          "maximum": 80,
          "minimum": 40,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('border source tokens and mixed physical/logical priority render in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/borders.ts',
      source: Borders.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>div{width:100px;height:100px}${output.css}</style><main><div id="box" class="${module.box.className}"></div><div id="control" style="border-style:solid;border-width:2px;border-left-width:3px;border-inline-start-width:4px;border-inline-start-width:5px!important;border-color:#06c;border-inline-end-color:#fff;border-radius:8px;border-start-start-radius:10px;outline-color:#fff;outline-style:dashed;outline-width:2px;outline-offset:-1px"></div></main>`,
      )

      for (const writingMode of ['horizontal-tb', 'vertical-rl', 'vertical-lr'])
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )

          expect(
            await page.evaluate(() => {
              const actual = getComputedStyle(document.getElementById('box')!)
              const expected = getComputedStyle(
                document.getElementById('control')!,
              )

              return [
                'border-top-width',
                'border-left-width',
                'border-bottom-width',
                'border-right-width',
                'border-top-color',
                'border-left-color',
                'border-bottom-color',
                'border-right-color',
                'border-top-left-radius',
                'border-top-right-radius',
                'border-bottom-left-radius',
                'border-bottom-right-radius',
                'outline-color',
                'outline-width',
                'outline-style',
                'outline-offset',
              ].filter(
                (property) =>
                  actual.getPropertyValue(property) !==
                  expected.getPropertyValue(property),
              )
            }),
          ).toMatchInlineSnapshot(`[]`)
        }
    } finally {
      await browser.close()
    }
  })

  test('border tokens, priority, and per-entry source maps survive compilation', () => {
    const output = Transform.compile({
      moduleId: 'example/borders.ts',
      source: Borders.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1qal89srxpye2-zyzz-theme{--z-t1qal89srxpye2-zyzz-borderColor_2e_brand:#06c;--z-t1qal89srxpye2-zyzz-color_2e_brand:#fff;--z-t1qal89srxpye2-zyzz-borderRadius_2e_round:8px;}
      .z-border-style-solid-1qal89s13hu244{border-style:solid;}
      .z-border-width-2px-1pi394vyjj37x-1{border-width:2px;}
      .z-border-left-width-3px-1pi394vyjj37x-2{border-left-width:3px;}
      .z-border-inline-start-width-1pi394vyjj37x-3{border-inline-start-width:4px;border-inline-start-width:5px!important;}
      .z-border-color-1pi394vyjj37x-4{border-color:var(--z-t1qal89srxpye2-zyzz-borderColor_2e_brand,#06c);}
      .z-border-inline-end-color-1pi394vyjj37x-5{border-inline-end-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);}
      .z-border-radius-1pi394vyjj37x-6{border-radius:var(--z-t1qal89srxpye2-zyzz-borderRadius_2e_round,8px);}
      .z-border-start-start-radius-10px-1pi394vyjj37x-7{border-start-start-radius:10px;}
      .z-outline-color-1qal89s13hu244{outline-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);}
      .z-outline-style-dashed-1qal89s13hu244{outline-style:dashed;}
      .z-outline-width-2px-1qal89s13hu244{outline-width:2px;}
      .z-outline-offset--1px-1qal89s13hu244{outline-offset:-1px;}
      .z-border-width-2px-1z9d8sygsuf4-0{border-width:2px;}
      .z-border-inline-start-width-5px-1z9d8sygsuf4-1{border-inline-start-width:5px;}
      .z-border-left-width-3px-1z9d8sygsuf4-2{border-left-width:3px;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) =>
      line.includes('border-inline-start-width:5px'),
    )

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('border-inline-start-width:5px'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 92,
        "line": 4,
        "name": "borderInlineStartWidth",
        "source": "example/borders.ts",
      }
    `)
  })

  test('flex sizing and overflow preserve tokens, importance, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/flex.ts',
      source: Flex.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-bjw6jw1i067e2-zyzz-theme{--z-tbjw6jw1i067e2-zyzz-spacing_2e_item:60px;}
      .z-flex-bjw6jw4vwkws{display:flex;}
      .z-flex-wrap-wrap-bjw6jw4vwkws{flex-wrap:wrap;}
      .z-w-180px-1uspaczsl5dxn-2{width:180px;}
      .z-h-100px-1uspaczsl5dxn-3{height:100px;}
      .z-align-content-space-between-bjw6jw4vwkws{align-content:space-between;}
      .z-align-items-flex-start-bjw6jw4vwkws{align-items:flex-start;}
      .z-flex-basis-bjw6jw4vwkws{flex-basis:40px;flex-basis:var(--z-tbjw6jw1i067e2-zyzz-spacing_2e_item,60px);}
      .z-flex-grow-0-bjw6jw4vwkws{flex-grow:0;}
      .z-flex-shrink-0-bjw6jw4vwkws{flex-shrink:0;}
      .z-h-20px-1p1agofsogw5n-3{height:20px;}
      .z-align-self-flex-end-bjw6jw4vwkws{align-self:flex-end;}
      .z-order-bjw6jw4vwkws{order:-1!important;}
      .z-w-40px-12u4y3lskeg5p-0{width:40px;}
      .z-h-40px-12u4y3lskeg5p-1{height:40px;}
      .z-overflow-12u4y3lskeg5p-2{overflow:hidden;overflow:clip!important;}
      .z-overflow-x-visible-12u4y3lskeg5p-3{overflow-x:visible;}
      .z-w-40px-1469tlhsibxz9-0{width:40px;}
      .z-h-40px-1469tlhsibxz9-1{height:40px;}
      .z-overflow-x-clip-1469tlhsibxz9-2{overflow-x:clip;}
      .z-overflow-hidden-1469tlhsibxz9-3{overflow:hidden;}
      .z-overflow-y-scroll-1469tlhsibxz9-4{overflow-y:scroll;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('flex-basis:var('))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('flex-basis:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 48,
        "line": 4,
        "name": "flexBasis",
        "source": "example/flex.ts",
      }
    `)
  })

  test('flex sizing, line alignment, and overflow match native browser layout', async () => {
    const output = Transform.compile({
      moduleId: 'example/flex.ts',
      source: Flex.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()
      const children = (item: string) =>
        `<div style="width:60px;height:40px;flex-shrink:0"></div><div ${item}></div><div style="width:60px;height:20px;flex-shrink:0"></div><div style="width:60px;height:20px;flex-shrink:0"></div>`

      await page.setContent(
        `<style>${output.css}</style><main id="actual" class="${module.container.className}">${children(`class="${module.item.className}"`)}</main><main id="expected" style="display:flex;flex-wrap:wrap;width:180px;height:100px;align-content:space-between;align-items:flex-start">${children('style="flex-basis:60px;flex-grow:0;flex-shrink:0;height:20px;align-self:flex-end;order:-1!important"')}</main><div id="clip" class="${module.clip.className}"><div style="width:200px;height:200px"></div></div><div id="scroll" class="${module.scroll.className}"><div style="width:200px;height:200px"></div></div>`,
      )

      expect(
        await page.evaluate(() => {
          const layout = (id: string) => {
            const parent = document.getElementById(id)!
            const origin = parent.getBoundingClientRect()

            return Array.from(parent.children, (child) => {
              const box = child.getBoundingClientRect()

              return {
                height: box.height,
                width: box.width,
                x: box.x - origin.x,
                y: box.y - origin.y,
              }
            })
          }

          return (
            JSON.stringify(layout('actual')) ===
            JSON.stringify(layout('expected'))
          )
        }),
      ).toMatchInlineSnapshot(`true`)
      expect(
        await page.locator('#actual').evaluate((parent) => {
          const child = parent.children[1]!
          const box = child.getBoundingClientRect()
          const origin = parent.getBoundingClientRect()

          return {
            height: box.height,
            width: box.width,
            x: box.x - origin.x,
            y: box.y - origin.y,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "height": 20,
          "width": 60,
          "x": 0,
          "y": 20,
        }
      `)
      expect(
        await page.locator('#clip').evaluate((element) => {
          element.scrollTop = 10

          const style = getComputedStyle(element)

          return {
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollTop: element.scrollTop,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "overflowX": "clip",
          "overflowY": "clip",
          "scrollTop": 0,
        }
      `)
      expect(
        await page.locator('#scroll').evaluate((element) => {
          element.scrollTop = 10

          const style = getComputedStyle(element)

          return {
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollTop: element.scrollTop,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "overflowX": "hidden",
          "overflowY": "scroll",
          "scrollTop": 10,
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('logical boxes preserve tokens, importance, and fallback source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/logical.ts',
      source: Logical.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-9k2sno1hln8ye-zyzz-theme{--z-t9k2sno1hln8ye-zyzz-spacing_2e_space:12px;}
      .z-w-60px-18bjqjnvbqqm3-0{width:60px;}
      .z-inline-size-18bjqjnvbqqm3-1{inline-size:70px;inline-size:80px!important;}
      .z-block-size-40px-18bjqjnvbqqm3-2{block-size:40px;}
      .z-pl-2px-18bjqjnvbqqm3-3{padding-left:2px;}
      .z-padding-inline-start-18bjqjnvbqqm3-4{padding-inline-start:4px;padding-inline-start:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px);}
      .z-margin-inline-end-9k2sno12248mg{margin-inline-end:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px)!important;}
      .z-position-relative-9k2sno12248mg{position:relative;}
      .z-inset-inline-start--3px-9k2sno12248mg{inset-inline-start:-3px;}
      .z-inline-size-30px-1l9bqkvvacp09-0{inline-size:30px;}
      .z-w-50px-1l9bqkvvacp09-1{width:50px;}
      .z-padding-inline-start-6px-1l9bqkvvacp09-2{padding-inline-start:6px;}
      .z-pl-8px-1l9bqkvvacp09-3{padding-left:8px;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('inline-size:80px'))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('inline-size:80px'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 34,
        "line": 4,
        "name": "inlineSize",
        "source": "example/logical.ts",
      }
    `)
  })

  test('logical boxes render inherited writing modes and scope overrides in the browser', async () => {
    const output = Transform.compile({
      moduleId: 'example/logical.ts',
      source: Logical.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><main style="writing-mode:horizontal-tb;direction:ltr"><div id="box" class="${module.logical.className}"></div><div id="control" style="width:60px;inline-size:70px;inline-size:80px!important;block-size:40px;padding-left:2px;padding-inline-start:4px;padding-inline-start:12px;margin-inline-end:12px!important;position:relative;inset-inline-start:-3px"></div><div id="physical" class="${module.physical.className}"></div><div id="physical-control" style="inline-size:30px;width:50px;padding-inline-start:6px;padding-left:8px"></div></main>`,
      )

      for (const writingMode of [
        'horizontal-tb',
        'vertical-rl',
        'vertical-lr',
      ]) {
        for (const direction of ['ltr', 'rtl']) {
          await page.locator('main').evaluate(
            (element, values) => {
              element.style.writingMode = values.writingMode
              element.style.direction = values.direction
            },
            { writingMode, direction },
          )

          expect(
            await page.evaluate(() => {
              const properties = [
                'width',
                'height',
                'padding-left',
                'padding-right',
                'padding-top',
                'padding-bottom',
                'margin-left',
                'margin-right',
                'margin-top',
                'margin-bottom',
                'left',
                'right',
                'top',
                'bottom',
              ]

              return [
                ['box', 'control'],
                ['physical', 'physical-control'],
              ].flatMap(([actual, expected]) => {
                const a = getComputedStyle(document.getElementById(actual!)!)
                const b = getComputedStyle(document.getElementById(expected!)!)

                return properties
                  .filter(
                    (property) =>
                      a.getPropertyValue(property) !==
                      b.getPropertyValue(property),
                  )
                  .map((property) => ({
                    actual: a.getPropertyValue(property),
                    expected: b.getPropertyValue(property),
                    property,
                  }))
              })
            }),
          ).toMatchInlineSnapshot(`[]`)
        }
      }

      await page.locator('main').evaluate((element, scope) => {
        element.setAttribute('class', scope)
      }, module.scope)
      // A scope edit must update both the shorthand and explicit reference.
      await page.addStyleTag({
        content: `.${module.scope}{${output.css.match(/--[^:]+(?=:12px)/)![0]}:20px;}`,
      })

      expect(
        await page.locator('#box').evaluate((element) => {
          const style = getComputedStyle(element)

          return {
            marginInlineEnd: style.marginInlineEnd,
            paddingInlineStart: style.paddingInlineStart,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "marginInlineEnd": "20px",
          "paddingInlineStart": "20px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('important zero shorthands retain token identity before literal coercion', () => {
    const output = Transform.compile({
      moduleId: 'zero.ts',
      source: `import { Theme, css } from 'zyzz';
const theme = Theme.define({spacing:{0:'8px'}});
export const token = theme.css({padding:'0!'})();
export const literal = css({padding:'0!'})();
export const plain = theme.css({padding:0})();`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1s1gwcevjtf8w-theme{--z-t1s1gwcevjtf8w-theme-spacing_2e_0:8px;}
      .z-p-1bw3plw1rtg8lu-0{padding:var(--z-t1s1gwcevjtf8w-theme-spacing_2e_0,8px)!important;}
      .z-p-1jst96b1rtienp-0{padding:0!important;}
      .z-p-0-15253gd1rwxlp1-0{padding:0;}"
    `)
  })

  test('asserted fallback arrays retain token references and entry source maps', () => {
    const output = Transform.compile({
      moduleId: 'assertions.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
export const props = theme.css({
  display: ['block','flex'] as const,
  color: ((['#000',theme.tokens.color.brand] as const) satisfies readonly unknown[])!,
})();`,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1jvt0134f5zz3-theme{--z-t1jvt0134f5zz3-theme-color_2e_brand:#06c;}
      .z-display-1jvt0131mi1nkl{display:block;display:flex;}
      .z-text-1jvt0131mi1nkl{color:#000;color:var(--z-t1jvt0134f5zz3-theme-color_2e_brand,#06c);}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('color:var('))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('color:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 19,
        "line": 5,
        "name": "color",
        "source": "assertions.ts",
      }
    `)
  })

  test('standard lengths preserve source spelling, token fallbacks, and maps', () => {
    const output = Transform.compile({
      moduleId: 'example/lengths.ts',
      source: Lengths.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1aowg2i1i6ewzi-zyzz-theme{--z-t1aowg2i1i6ewzi-zyzz-spacing_2e_space:1lh;}
      .z-w-1aowg2i144pkxw{width:50vw;width:50cqi!important;}
      .z-h-10dvh-1aowg2i144pkxw{height:10dvh;}
      .z-ml--1in-vea2y6upxdc4-2{margin-left:-1in;}
      .z-border-width-1pc-1aowg2i144pkxw{border-width:1pc;}
      .z-border-style-solid-1aowg2i144pkxw{border-style:solid;}
      .z-p-1aowg2i144pkxw{padding:1rem;padding:var(--z-t1aowg2i1i6ewzi-zyzz-spacing_2e_space,1lh);}
      .z-mt-1bia76nurweap-1{margin-top:2rlh!important;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('width:50cqi'))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('width:50cqi'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 39,
        "line": 3,
        "name": "width",
        "source": "example/lengths.ts",
      }
    `)
  })

  test('standard lengths resolve against browser viewport, container, and font metrics', async () => {
    const output = Transform.compile({
      moduleId: 'example/lengths.ts',
      source: Lengths.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage({
        viewport: { width: 800, height: 600 },
      })

      await page.setContent(
        `<style>html{font-size:16px;line-height:24px}main{container-type:size;width:400px;height:300px;line-height:30px}${output.css}</style><main><div id="root" class="${module.root.className}"></div><div id="themed" class="${module.themed.className}"></div></main>`,
      )

      expect(
        await page.locator('#root').evaluate((element) => {
          const style = getComputedStyle(element)

          return {
            borderWidth: style.borderTopWidth,
            height: style.height,
            marginLeft: style.marginLeft,
            width: style.width,
          }
        }),
      ).toMatchInlineSnapshot(`
        {
          "borderWidth": "16px",
          "height": "60px",
          "marginLeft": "-96px",
          "width": "200px",
        }
      `)
      expect(
        await page.locator('#themed').evaluate((element) => {
          const style = getComputedStyle(element)

          return { marginTop: style.marginTop, padding: style.paddingTop }
        }),
      ).toMatchInlineSnapshot(`
        {
          "marginTop": "48px",
          "padding": "30px",
        }
      `)
    } finally {
      await browser.close()
    }
  })

  test('importance syntax cannot collide with theme token names', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/reserved.ts',
        source: `import { Theme } from 'zyzz';
const theme = Theme.define({spacing:{md:'4px','md!':'8px'}});
export const props = theme.css({padding:'md!'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/reserved.ts:44: ["spacing","md!"]: Token keys cannot contain !; it is reserved for declaration importance.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'example/reserved-config.ts',
        source: `import { Config } from 'zyzz';
const zyzz = Config.create({theme:{spacing:{'nested!':{md:'8px'}}}});
export const props = zyzz.css({padding:'nested!.md'})();`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/reserved-config.ts:44: ["spacing","nested!"]: Token keys cannot contain !; it is reserved for declaration importance.]`,
    )
  })

  test('fallback declarations retain importance, token identity, and element source maps', () => {
    const output = Transform.compile({
      moduleId: 'example/fallbacks.ts',
      source: Declarations.source,
    })

    expect(output.css).toMatchInlineSnapshot(`
      ".z_theme-1ne2r2w17wkfe-theme{--z-t1ne2r2w17wkfe-theme-color_2e_brand:#06c;}
      .z_theme-1ne2r2w17wkfe-mint{--z-t1ne2r2w17wkfe-theme-color_2e_brand:#175;}
      .z-text-kkgih21d19m3o-0{color:#000;color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c);color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c)!important;}
      .z-display-1ne2r2w5eu5h0{display:block;display:flex;}
      .z-opacity-1ne2r2w5eu5h0{opacity:0.25!important;opacity:0.75;}
      .z-p-kkgih21d19m3o-3{padding:4px!important;padding:8px;}
      .z-pl-12px-kkgih21d19m3o-4{padding-left:12px;}
      .z-text-s24r9s1d2qoxw-0{color:#fff;}
      .z-p-20px-s24r9s1d2qoxw-1{padding:20px;}"
    `)

    const lines = output.css.split('\n')
    const line = lines.findIndex((line) => line.includes('color:var('))

    expect(
      Trace.originalPositionFor(new Trace.TraceMap(output.cssMap), {
        line: line + 1,
        column: lines[line]!.indexOf('color:var('),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 18,
        "line": 6,
        "name": "color",
        "source": "example/fallbacks.ts",
      }
    `)
  })

  test('fallback order and importance select browser styles with inherited tokens', async () => {
    const output = Transform.compile({
      moduleId: 'example/fallbacks.ts',
      source: Declarations.source,
    })
    const js = await Esbuild.transform(output.code, {
      loader: 'ts',
      format: 'esm',
    })
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(js.code).toString('base64')}`
    )
    const browser = await chromium.launch()

    try {
      const page = await browser.newPage()

      await page.setContent(
        `<style>${output.css}</style><main class="${module.scope}"><div id="card" class="${module.props.className} ${module.later.className}"></div></main>`,
      )

      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).color),
      ).toMatchInlineSnapshot(`"rgb(17, 119, 85)"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).opacity),
      ).toMatchInlineSnapshot(`"0.25"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).paddingLeft),
      ).toMatchInlineSnapshot(`"4px"`)
      expect(
        await page
          .locator('#card')
          .evaluate((element) => getComputedStyle(element).display),
      ).toMatchInlineSnapshot(`"flex"`)
    } finally {
      await browser.close()
    }
  })

  test('explicit token paths compile through bound aliases with defining fallbacks', async () => {
    const result = Transform.compile({
      moduleId: 'example/tokens.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { transparent: '#06c', palette: { 500: '#123' } }, spacing: { 0: '8px', 4: '16px' } });
const alternate = Theme.extend(theme, { color: { transparent: '#175', palette: { 500: '#456' } } });
const { css } = theme;
export const scope = alternate.className;
export const props = css({ color: theme.tokens.color.transparent, borderColor: (theme['tokens'].color.palette['500']!), padding: theme.tokens.spacing[0] })();
`,
    })

    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1wr3l4n1jk260t-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>);
      const alternate = ({className:"z_theme-1wr3l4n1jk260t-alternate"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>);
      const { css } = ({css:undefined} as unknown as {readonly css:import('zyzz').Theme.Definition<{readonly "color":{readonly "transparent":"#06c";readonly "palette":{readonly 500:"#123"}};readonly "spacing":{readonly 0:"8px";readonly 4:"16px"}}>['css']});
      export const scope = "z_theme-1wr3l4n1jk260t-alternate";
      export const props = ({className:"z-text-1wr3l4nxrn9gj z-border-color-1wr3l4nxrn9gj z-p-1wr3l4nxrn9gj"});
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1wr3l4n1jk260t-theme{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#06c;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#123;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z_theme-1wr3l4n1jk260t-alternate{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#175;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#456;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z-text-1wr3l4nxrn9gj{color:var(--z-t1wr3l4n1jk260t-theme-color_2e_transparent,#06c);}
      .z-border-color-1wr3l4nxrn9gj{border-color:var(--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500,#123);}
      .z-p-1wr3l4nxrn9gj{padding:var(--z-t1wr3l4n1jk260t-theme-spacing_2e_0,8px);}"
    `)

    const output = await Esbuild.build({
      bundle: true,
      format: 'cjs',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })

    expect(output.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )

    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-tokens-'))

    try {
      const path = Path.join(directory, 'module.cjs')

      await Fs.writeFile(path, output.outputFiles[0]!.text)

      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '-e',
          `console.log(JSON.stringify(require(${JSON.stringify(path)}).props))`,
        ],
      )

      expect(executed.stdout).toMatchInlineSnapshot(`
        "{"className":"z-text-1wr3l4nxrn9gj z-border-color-1wr3l4nxrn9gj z-p-1wr3l4nxrn9gj"}
        "
      `)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }

    const map = new Trace.TraceMap(result.cssMap)
    const lines = result.css.split('\n')
    const line = lines.findIndex((value) => value.includes('color:var('))

    expect(
      Trace.originalPositionFor(map, {
        line: line + 1,
        column: lines[line]!.indexOf('color:'),
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 27,
        "line": 6,
        "name": "color",
        "source": "example/tokens.ts",
      }
    `)
  })

  test('explicit token diagnostics reject dynamic paths', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color[key] });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token paths require static property names without optional access.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject unknown paths', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.missing });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Unknown theme token path.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject palette references', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Expected a scalar theme token reference.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject escaping tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); export const value = theme.tokens.color.brand;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/tokens.ts:108: Token references must be direct property values in bound theme css calls.]`,
    )
  })

  test('explicit token diagnostics reject root css tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); css({ color: theme.tokens.color.brand });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:100: Token references must be direct property values in bound theme css calls.
      example/tokens.ts:100: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token expressions', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.brand + '' });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token references must be direct property values in bound theme css calls.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token writes', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.tokens.color.brand = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/tokens.ts:87: Token references must be direct property values in bound theme css calls.]`,
    )
  })

  test('explicit token diagnostics reject optional tokens', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color?.brand });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Token paths require static property names without optional access.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('explicit token diagnostics reject token metadata', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/tokens.ts',
        source: `import { css, Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); theme.css({ color: theme.tokens.color.brand.value });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Source.ExtractError: example/tokens.ts:106: Unknown theme token path.
      example/tokens.ts:106: Expected a literal string or number; expressions are not evaluated.]
    `)
  })

  test('local themes compile to scope constants and executable token styles', async () => {
    const source = `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: { dark: '#fff', light: '#000' } }, spacing: { 1: '4px', md: '8px' } });
const alternate = Theme.extend(theme, { color: { brand: '#f00' } });
export type Brand = typeof theme.tokens.color.brand;
export const scope = alternate.className;
export const props = theme.css({ color: 'brand', padding: 'md' })();`

    const result = Transform.compile({ moduleId: 'example/theme.ts', source })

    const bundle = await Esbuild.build({
      bundle: true,
      format: 'esm',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })

    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1dre7461ulsxz8-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":{readonly "dark":"#fff";readonly "light":"#000"}};readonly "spacing":{readonly 1:"4px";readonly "md":"8px"}}>);
      const alternate = ({className:"z_theme-1dre7461ulsxz8-alternate"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":{readonly "dark":"#fff";readonly "light":"#000"}};readonly "spacing":{readonly 1:"4px";readonly "md":"8px"}}>);
      export type Brand = typeof theme.tokens.color.brand;
      export const scope = "z_theme-1dre7461ulsxz8-alternate";
      export const props = ({className:"z-text-1dre746ydrh2y z-p-1dre746ydrh2y"});"
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1dre7461ulsxz8-theme{--z-t1dre7461ulsxz8-theme-color_2e_brand:light-dark(#000,#fff);--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z_theme-1dre7461ulsxz8-alternate{--z-t1dre7461ulsxz8-theme-color_2e_brand:#f00;--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z-text-1dre746ydrh2y{color:var(--z-t1dre7461ulsxz8-theme-color_2e_brand,light-dark(#000,#fff));}
      .z-p-1dre746ydrh2y{padding:var(--z-t1dre7461ulsxz8-theme-spacing_2e_md,8px);}"
    `)
    expect(result.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-alternate": "z_theme-1dre7461ulsxz8-alternate",
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )
    expect(
      bundle.outputFiles[0]!.text.includes('Theme.define'),
    ).toMatchInlineSnapshot('false')

    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-theme-types-'))

    try {
      const file = Path.join(directory, 'theme.ts')

      await Fs.writeFile(
        file,
        `${result.code}\ntheme.css({ padding: 1 });\n// @ts-expect-error The numeric token 2 is undeclared.\ntheme.css({ padding: 2 });`,
      )

      const checked = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.join(root, 'node_modules/typescript/bin/tsc'),
          '--customConditions',
          'src',
          '--module',
          'NodeNext',
          '--noEmit',
          '--skipLibCheck',
          '--strict',
          '--target',
          'ES2022',
          file,
        ],
        { timeout: 30_000 },
      ).catch((error: Error & { stdout?: string }) => {
        throw new Error(error.stdout || error.message)
      })

      expect(checked.stdout).toMatchInlineSnapshot('""')
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }

    const map = new Trace.TraceMap(result.cssMap)
    const lines = result.css.split('\n')
    const line = lines.findIndex((value) => value.includes('color:var('))

    expect(
      Trace.originalPositionFor(map, {
        column: lines[line]!.indexOf('color:'),
        line: line + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 33,
        "line": 6,
        "name": "color",
        "source": "example/theme.ts",
      }
    `)
    expect(Trace.originalPositionFor(map, { column: 0, line: 1 }))
      .toMatchInlineSnapshot(`
      {
        "column": 14,
        "line": 2,
        "name": "1dre7461ulsxz8-theme",
        "source": "example/theme.ts",
      }
    `)
  }, 35_000)

  test('theme identity survives value edits and preceding unrelated definitions', () => {
    const source = `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); export const scope = theme.className; export const props = theme.css({ color: 'brand' })();`
    const original = Transform.compile({ moduleId: 'example/theme.ts', source })
    const changed = Transform.compile({
      moduleId: 'example/theme.ts',
      source: source.replace("'#000'", "'#fff'"),
    })

    const inserted = Transform.compile({
      moduleId: 'example/theme.ts',
      source: source.replace(
        'const theme',
        "const other = Theme.define({ spacing: { sm: '4px' } }); const theme",
      ),
    })

    const separate = Transform.compile({ moduleId: 'another/theme.ts', source })

    expect(original.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(changed.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(inserted.themes).toMatchInlineSnapshot(`
      {
        "1dre7461ulsxz8-other": "z_theme-1dre7461ulsxz8-other",
        "1dre7461ulsxz8-theme": "z_theme-1dre7461ulsxz8-theme",
      }
    `)
    expect(separate.themes).toMatchInlineSnapshot(`
      {
        "134fgjpd7aup3-theme": "z_theme-134fgjpd7aup3-theme",
      }
    `)
    expect(original.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
    expect(changed.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
    expect(inserted.css.match(/--z-t[^,:;]+/g)).toMatchInlineSnapshot(`
      [
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
        "--z-t1dre7461ulsxz8-theme-color_2e_brand",
      ]
    `)
  })

  test.each(['direct', 'member', 'destructured', 'tokens'] as const)(
    'local themed callables preserve overrides, scope inheritance, and schemes in Chromium: %s',
    async (kind) => {
      const alias = (() => {
        if (kind === 'member') {
          return 'const css = theme.css;'
        }

        if (kind === 'destructured') {
          return 'const { css } = theme;'
        }

        return ''
      })()

      const source = `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: { dark: '#fff', light: '#000' } }, spacing: { md: '8px' } });
const alternate = Theme.extend(theme, { color: { brand: '#f00' } });
export const alternateScope = alternate.className;
export const baseScope = theme.className;
${alias}
export const button = ${kind === 'direct' || kind === 'tokens' ? 'theme.css' : 'css'}(${kind === 'tokens' ? '{ color: theme.tokens.color.brand, padding: theme.tokens.spacing.md }' : "{ color: 'brand', padding: 'md' }"});`

      const result = Transform.compile({ moduleId: 'example/theme.ts', source })

      const bundle = await Esbuild.build({
        alias: { 'zyzz/runtime': Path.join(root, 'src/runtime/index.ts') },
        bundle: true,
        format: 'iife',
        globalName: 'Fixture',
        metafile: true,
        stdin: { contents: result.code, loader: 'ts', resolveDir: root },
        write: false,
      })

      expect(
        Object.keys(bundle.metafile!.inputs).some((path) =>
          /Theme\.ts|compiler\//.test(path),
        ),
      ).toMatchInlineSnapshot('false')

      const browser = await chromium.launch()

      try {
        const page = await browser.newPage()

        await page.setContent(
          '<section id="scope"><button id="button">Continue</button></section>',
        )
        await page.addStyleTag({ content: result.css })
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text })

        const rendered = await page.evaluate(() => {
          const fixture = (
            window as unknown as {
              Fixture: {
                alternateScope: string
                baseScope: string
                button: (options: { className: string }) => {
                  className: string
                }
              }
            }
          ).Fixture

          const scope = document.querySelector<HTMLElement>('#scope')!
          const button = document.querySelector<HTMLElement>('#button')!

          button.className = fixture.button({ className: 'external' }).className

          const values: string[] = []

          for (const name of ['', fixture.alternateScope, fixture.baseScope]) {
            scope.className = name

            for (const scheme of ['light', 'dark']) {
              scope.style.colorScheme = scheme
              values.push(getComputedStyle(button).color)
            }
          }

          return values
        })

        expect(rendered).toMatchInlineSnapshot(`
          [
            "rgb(0, 0, 0)",
            "rgb(255, 255, 255)",
            "rgb(255, 0, 0)",
            "rgb(255, 0, 0)",
            "rgb(0, 0, 0)",
            "rgb(255, 255, 255)",
          ]
      `)
        expect(
          await page
            .locator('#button')
            .evaluate((element) => element.classList.contains('external')),
        ).toMatchInlineSnapshot('true')
        expect(
          await page
            .locator('#button')
            .evaluate((element) => getComputedStyle(element).padding),
        ).toMatchInlineSnapshot('"8px"')
      } finally {
        await browser.close()
      }
    },
  )

  test('JavaScript theme modules remain JavaScript and shadowed factories remain untouched', async () => {
    const source = `import { Theme as T } from 'zyzz'; const theme = T.define({ color: { brand: '#000' } }); export const props = theme.css({ color: 'brand' })(); export function other(T) { return T.define({ arbitrary: true }); }`
    const result = Transform.compile({ moduleId: 'example/theme.js', source })
    const transformed = await Esbuild.transform(result.code, { loader: 'js' })

    expect(transformed.code).toMatchInlineSnapshot(`
      "import { Theme as T } from "zyzz";
      const theme = { className: "z_theme-1kg4lys8lrjea-theme" };
      export const props = { className: "z-text-1kg4lysydrhic" };
      export function other(T2) {
        return T2.define({ arbitrary: true });
      }
      "
    `)
  })

  test('exported theme objects require linking instead of losing their authoring contract', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; export const theme = Theme.define({ color: { brand: '#000' } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:43: Define local themes with a module-level const; exported themes require source linking.]`,
    )
  })

  test('theme expressions are rejected without executing application code', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: readColor() } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:75: Theme values must be literal data; expressions are not evaluated.]`,
    )
  })

  test('theme css aliases and destructuring compile with lexical shadowing', async () => {
    const result = Transform.compile({
      moduleId: 'example/aliases.ts',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({ color: { brand: '#06c' }, spacing: { md: '8px' } });
const css = theme.css;
const chained = css;
const { css: renamed } = theme;
export type Styles = Parameters<typeof renamed>[0];
export const first = chained({ color: 'brand' })();
export const second = renamed({ padding: 'md' })();
export function shadow(css: (input: string) => string) { return css('untouched') }
`,
    })

    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1ypjmwd1mnjqht-theme"} as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>);
      const css = (undefined as unknown as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']);
      const chained = (undefined as unknown as import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']);
      const { css: renamed } = ({css:undefined} as unknown as {readonly css:import('zyzz').Theme.Definition<{readonly "color":{readonly "brand":"#06c"};readonly "spacing":{readonly "md":"8px"}}>['css']});
      export type Styles = Parameters<typeof renamed>[0];
      export const first = ({className:"z-text-1ypjmwdm3e33f"});
      export const second = ({className:"z-p-1ypjmwdm3e33f"});
      export function shadow(css: (input: string) => string) { return css('untouched') }
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1ypjmwd1mnjqht-theme{--z-t1ypjmwd1mnjqht-theme-color_2e_brand:#06c;--z-t1ypjmwd1mnjqht-theme-spacing_2e_md:8px;}
      .z-text-1ypjmwdm3e33f{color:var(--z-t1ypjmwd1mnjqht-theme-color_2e_brand,#06c);}
      .z-p-1ypjmwdm3e33f{padding:var(--z-t1ypjmwd1mnjqht-theme-spacing_2e_md,8px);}"
    `)

    const bundle = await Esbuild.build({
      bundle: true,
      format: 'cjs',
      metafile: true,
      stdin: { contents: result.code, loader: 'ts' },
      write: false,
    })

    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )

    const directory = await Fs.mkdtemp(Path.join(root, '.fixture-alias-'))

    try {
      const file = Path.join(directory, 'module.cjs')

      await Fs.writeFile(file, bundle.outputFiles[0]!.text)

      const executed = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          '-e',
          `const value = require(${JSON.stringify(file)}); console.log(JSON.stringify(value.first)); console.log(JSON.stringify(value.second)); console.log(value.shadow(value => value));`,
        ],
      )

      expect(executed.stdout).toMatchInlineSnapshot(`
        "{"className":"z-text-1ypjmwdm3e33f"}
        {"className":"z-p-1ypjmwdm3e33f"}
        untouched
        "
      `)

      await Fs.writeFile(
        Path.join(directory, 'module.ts'),
        `${result.code}
renamed({ color: 'brand' });
// @ts-expect-error Unknown tokens remain rejected after rewriting.
renamed({ color: 'unknown' });
// @ts-expect-error Aliases preserve token domains.
css({ color: 'md' });
`,
      )

      const checked = await Util.promisify(ChildProcess.execFile)(
        process.execPath,
        [
          Path.join(root, 'node_modules/typescript/bin/tsc'),
          '--customConditions',
          'src',
          '--module',
          'NodeNext',
          '--target',
          'esnext',
          '--strict',
          '--skipLibCheck',
          '--noEmit',
          Path.join(directory, 'module.ts'),
        ],
        { timeout: 30_000 },
      )

      expect(checked.stdout).toMatchInlineSnapshot(`""`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  }, 35_000)

  test('JavaScript aliases remain JavaScript and parameter initializers retain lexical bindings', async () => {
    const result = Transform.compile({
      moduleId: 'example/aliases.js',
      source: `import { Theme } from 'zyzz';
const theme = Theme.define({color:{brand:'#06c'}});
const { css } = theme;
export function card(value = css({color:'brand'})()) { var css = 1; return value }
`,
    })

    expect(result.code).toMatchInlineSnapshot(`
      "
      const theme = ({className:"z_theme-1yrnmp3116l80n-theme"});
      const { css } = ({css:undefined});
      export function card(value = ({className:"z-text-1yrnmp3m3e2r9"})) { var css = 1; return value }
      "
    `)

    const output = await Esbuild.transform(result.code, { loader: 'js' })

    expect(output.warnings).toMatchInlineSnapshot(`[]`)
  })

  test('theme alias diagnostics reject exported aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); export const css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:95: Theme css aliases require a local module-level const binding.]`,
    )
  })

  test('theme alias diagnostics reject escaping aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; consume(css);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:113: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject reassigned aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; (css as unknown) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:106: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject destructuring defaults', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const { css = fallback } = theme;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:90: Destructure only css or variants into const bindings without defaults or rest properties.]`,
    )
  })

  test('theme alias diagnostics reject destructuring rest', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const { css, ...rest } = theme;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:95: Destructure only css or variants into const bindings without defaults or rest properties.]`,
    )
  })

  test('theme alias diagnostics reject mutable aliases', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); let css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:86: Theme css aliases require a local module-level const binding.]`,
    )
  })

  test('theme alias diagnostics reject early alias calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); css({color:'brand'}); const css = theme.css;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:82: Theme css alias references must follow their definition.]`,
    )
  })

  test('theme alias diagnostics reject optional alias calls', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; css?.({color:'brand'});`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:105: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test('theme alias diagnostics reject export specifiers', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/aliases.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({color:{brand:'#06c'}}); const css = theme.css; export { css };`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/aliases.ts:114: Theme css aliases support direct calls only; exporting or escaping them requires source linking.]`,
    )
  })

  test.each([
    'Z.Theme.define({ color: { brand: "#000" } })',
    'Z["Theme"].define({ color: { brand: "#000" } })',
    'Z.Theme.extend(base, {})',
  ])('namespace theme factories produce a source diagnostic: %s', (factory) => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/namespace.ts',
        source: `import * as Z from 'zyzz'; const theme = ${factory}; export const scope = theme.className;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/namespace.ts:41: Import Theme by name; namespace authoring calls are not supported yet.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className as string) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className as string) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className!) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className!) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className satisfies string) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className satisfies string) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: ((theme.className as string)!) = value;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ((theme.className as string)!) = value;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: (theme.className as string)++;', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); (theme.className as string)++;`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: delete (theme.className as string);', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); delete (theme.className as string);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: ({ value: (theme.className as string) } = input);', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ({ value: (theme.className as string) } = input);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:89: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('rejects wrapped scope writes: for ((theme.className as string) of values) {}', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); for ((theme.className as string) of values) {}`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:88: Theme scope properties cannot be reassigned.]`,
    )
  })

  test('theme scopes cannot be assigned through destructuring targets', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'example/theme.ts',
        source: `import { Theme } from 'zyzz'; const theme = Theme.define({ color: { brand: '#000' } }); ({ value: theme.className } = input);`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: example/theme.ts:89: Theme scope properties cannot be reassigned.]`,
    )
  })

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

    expect(result.code).toMatchInlineSnapshot(`
      "
      const text = '🎉';
      export const props = ({className:"z-text-14fkufe1593yf6 z-p-8px-14fkufe1593yf6"});"
    `)

    expect(result.css).toMatchInlineSnapshot(
      `
      ".z-text-14fkufe1593yf6{color:#f00;}
      .z-p-8px-14fkufe1593yf6{padding:8px;}"
    `,
    )

    expect(
      ['color:', 'padding:'].map((property) =>
        Trace.originalPositionFor(cssMap, {
          column: result.css.indexOf(property),
          line: 1,
        }),
      ),
    ).toMatchInlineSnapshot(`
      [
        {
          "column": 27,
          "line": 3,
          "name": "color",
          "source": "example/inline.ts",
        },
        {
          "column": 27,
          "line": 3,
          "name": "color",
          "source": "example/inline.ts",
        },
      ]
    `)

    expect(bundle.metafile!.outputs['stdin.js']!.imports).toMatchInlineSnapshot(
      `[]`,
    )

    expect(
      Trace.originalPositionFor(map, {
        column: outputLines[row]!.indexOf('className'),
        line: row + 1,
      }),
    ).toMatchInlineSnapshot(`
      {
        "column": 21,
        "line": 3,
        "name": null,
        "source": "example/inline.ts",
      }
    `)

    expect(result.map.sources).toMatchInlineSnapshot(`
    [
      "example/inline.ts",
    ]
  `)

    expect(result.cssMap.sources).toMatchInlineSnapshot(`
    [
      "example/inline.ts",
    ]
  `)

    expect(result.map.sourcesContent).toMatchInlineSnapshot(`
    [
      "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
    ]
  `)

    expect(result.cssMap.sourcesContent).toMatchInlineSnapshot(`
    [
      "import { css } from 'zyzz';
    const text = '🎉';
    export const props = css({ color: '#f00', padding: '8px' })();",
    ]
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
      const result = Transform.compile({
        moduleId: 'example/syntax.tsx',
        source,
      })

      await Esbuild.transform(result.code, { loader: 'tsx' })
      outputs.push(result.code)
    }

    expect(outputs).toMatchInlineSnapshot(`
      [
        "import other from 'zyzz'; export const props = ({className:""}); export { other };",
        ""use client";
      import { Props as __zyzzProps } from 'zyzz/runtime';
        export const button = __zyzzProps.create({className:"z-style-15sihh01ggr9so-64"});",
        "#!/usr/bin/env node

      import { Props as __zyzzProps } from 'zyzz/runtime';
      import { Style } from 'zyzz'; export const button = __zyzzProps.create({className:"z-style-15sihh01ggr9so-77"}); export { Style };",
        "import { Style,  } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
        "import { Style } from 'zyzz'; export const a = ({className:""}); export const b = ({className:""}); export { Style };",
        "
      import { Props as __zyzzProps } from 'zyzz/runtime';
      import { css } from 'zyzz'; export type Signature = typeof css; export const button = __zyzzProps.create({className:"z-style-15sihh01ggr9so-86"});",
        "
      import { Props as __zyzzProps_ } from 'zyzz/runtime';
       const __zyzzProps = 1; export const el = <button {...({className:"z-text-15sihh015fq89m"})} />; export const button = __zyzzProps_.create({className:"z-style-15sihh01ggr9so-130"});",
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

      // The integration command builds once before workers consume package artifacts.
      await Fs.access(Path.join(root, 'dist/runtime/index.js'))
      await run('pnpm', ['pack', '--pack-destination', directory], {
        cwd: root,
      })

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

      const platforms = await run(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { Style } from 'zyzz'; import { Css } from 'zyzz/web'; console.log(JSON.stringify(Css.compile({ styles: Style.define({ button: { padding: 0 } }) })));`,
        ],
        { cwd: directory },
      )

      expect(JSON.parse(platforms.stdout)).toMatchInlineSnapshot(`
        {
          "classes": {
            "button": "z-p-0",
          },
          "css": ".z-p-0{padding:0;}",
          "themes": {},
        }
      `)

      const listing = await run('tar', ['-tzf', Path.join(directory, archive)])

      expect(
        Object.keys(bundle.metafile!.inputs).some((name) =>
          /oxc|compiler|web\/Css/.test(name),
        ),
      ).toMatchInlineSnapshot(`false`)

      expect(JSON.parse(consumer.stdout)).toMatchInlineSnapshot(`
        {
          "className": "z-text-fyitz41sb4fze z-style-fyitz4td647s-50 external",
        }
      `)

      expect(
        /\.(?:test|test-d|bench)\.ts/.test(listing.stdout),
      ).toMatchInlineSnapshot(`false`)
    } finally {
      await Fs.rm(directory, { force: true, recursive: true })
    }
  }, 30000)
})
