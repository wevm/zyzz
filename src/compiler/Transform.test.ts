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
      ".z-style-bsh2u91k616n-90-cursor-0-hgqofn1owz06h{cursor:not-allowed;}
      .z-style-bsh2u91k616n-90-pointerEvents-1-5matnv1bzqx0n{pointer-events:auto;pointer-events:none!important;pointer-events:auto;}
      .z-style-bsh2u91k616n-90-resize-2-1xnqd7n1kv0zy3{resize:none;}
      .z-style-bsh2u91k616n-90-userSelect-3-a36bt52h7frx{user-select:none;}
      .z-style-bsh2u91k616n-90-visibility-4-17hfjsfh65bpn{visibility:visible;}
      .z-style-bsh2u91k616n-243-cursor-0-ptivsm11m4jjo{cursor:text;}
      .z-style-bsh2u91k616n-243-pointerEvents-1-10ue8611l3b9k5{pointer-events:auto;}
      .z-style-bsh2u91k616n-243-resize-2-1u0y6yc1kxougw{resize:both;}
      .z-style-bsh2u91k616n-243-userSelect-3-fwth3a2zfa5m{user-select:text;}
      .z-style-bsh2u91k616n-243-visibility-4-17hfjsfh65bpn{visibility:visible;}
      .z-style-bsh2u91k616n-368-cursor-0-1ppjbj055lbcy{cursor:default;}
      .z-style-bsh2u91k616n-368-pointerEvents-1-10ue8611l3b9k5{pointer-events:auto;}
      .z-style-bsh2u91k616n-368-resize-2-1xnqd7n1kv0zy3{resize:none;}
      .z-style-bsh2u91k616n-368-userSelect-3-1bj9te2qc8ig{user-select:auto;}
      .z-style-bsh2u91k616n-368-visibility-4-1arjichhrfo3z{visibility:hidden;}"
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
      ".z-style-m20tii1jg8qc0-53-borderCollapse-0-zh50nq15629ya{border-collapse:collapse;}
      .z-style-m20tii1jg8qc0-53-borderSpacing-1-1gkfzkasst4h4{border-spacing:12px;}
      .z-style-m20tii1jg8qc0-53-captionSide-2-1omzexe1lb40k0{caption-side:top;}
      .z-style-m20tii1jg8qc0-53-emptyCells-3-1uz2rqv7hgb59{empty-cells:show;}
      .z-style-m20tii1jg8qc0-53-tableLayout-4-5puwvhafzhet{table-layout:auto;}
      .z-style-m20tii1jg8qc0-190-borderCollapse-0-14nr8h41sx10z0{border-collapse:separate;}
      .z-style-m20tii1jg8qc0-190-borderSpacing-1-rtaiaor3mhhu{border-spacing:2px;border-spacing:8px!important;border-spacing:4px;}
      .z-style-m20tii1jg8qc0-190-captionSide-2-13b237qgo4cl0{caption-side:bottom;}
      .z-style-m20tii1jg8qc0-190-emptyCells-3-n6lkns7t9n2m{empty-cells:hide;}
      .z-style-m20tii1jg8qc0-190-tableLayout-4-1wb5yvs1uklke4{table-layout:fixed;}
      .z-style-m20tii1jg8qc0-347-borderCollapse-0-14nr8h41sx10z0{border-collapse:separate;}
      .z-style-m20tii1jg8qc0-347-borderSpacing-1-1hpb6u3nt8kr7{border-spacing:0;}
      .z-style-m20tii1jg8qc0-347-captionSide-2-1omzexe1lb40k0{caption-side:top;}
      .z-style-m20tii1jg8qc0-347-emptyCells-3-1uz2rqv7hgb59{empty-cells:show;}
      .z-style-m20tii1jg8qc0-347-tableLayout-4-1wb5yvs1uklke4{table-layout:fixed;}"
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
      .z-style-aauzfj1an5ia3-182-textDecorationLine-0-n6t6ci116jufo{text-decoration-line:underline;}
      .z-style-aauzfj1an5ia3-182-textDecorationThickness-1-g47bem1umuy9u{text-decoration-thickness:from-font;}
      .z-style-aauzfj1an5ia3-182-textUnderlineOffset-2-12hf30e1v2xncq{text-underline-offset:auto;}
      .z-style-aauzfj1an5ia3-182-textDecorationSkipInk-3-1677q957unzdf{text-decoration-skip-ink:auto;}
      .z-style-aauzfj1an5ia3-340-textDecorationLine-0-179chbpsf4j7p{text-decoration-line:underline;text-decoration-line:underline overline!important;}
      .z-aauzfj1an5ia3-base-textDecorationColor-dgoo07cr6759{text-decoration-color:var(--z-taauzfj1an5ia3-zyzz-color_2e_brand,#06c);}
      .z-aauzfj1an5ia3-base-textDecorationStyle-1ohwxwqsowqa{text-decoration-style:wavy;}
      .z-style-aauzfj1an5ia3-340-textDecorationThickness-1-1btssvx13jm4ax{text-decoration-thickness:var(--z-taauzfj1an5ia3-zyzz-spacing_2e_stroke,2px);}
      .z-style-aauzfj1an5ia3-340-textUnderlineOffset-2-bdwsf91du72bt{text-underline-offset:var(--z-taauzfj1an5ia3-zyzz-spacing_2e_offset,4px);}
      .z-style-aauzfj1an5ia3-340-textDecorationSkipInk-3-161aenu7scb4m{text-decoration-skip-ink:none;}
      .z-style-aauzfj1an5ia3-616-textDecorationLine-0-4sum162fpk7e{text-decoration-line:line-through;}
      .z-style-aauzfj1an5ia3-616-textDecorationThickness-1-1xp98pwx0k7ce{text-decoration-thickness:10%;}
      .z-style-aauzfj1an5ia3-616-textUnderlineOffset-2-phyq2c1tmroos{text-underline-offset:-10%;}"
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
      .z-style-r52i20xb74bg-121-width-0-w4fecq1sn92pa{width:65px;}
      .z-r52i20xb74bg-base-wordBreak-g1t22wouk0vg{word-break:break-all;}
      .z-r52i20xb74bg-base-letterSpacing-9raqnh1c0xt7{letter-spacing:normal;letter-spacing:2px;}
      .z-style-r52i20xb74bg-255-width-0-18y4xsv4vp1hb{width:200px;}
      .z-r52i20xb74bg-base-textIndent-1npr14o1it8a04{text-indent:var(--z-tr52i20xb74bg-zyzz-spacing_2e_indent,12px);}
      .z-r52i20xb74bg-base-textAlignLast-1m9pclr1bdx0d5{text-align-last:start;}
      .z-r52i20xb74bg-base-hyphens-18txvf214xsmq0{hyphens:manual;}
      .z-r52i20xb74bg-base-textTransform-1fcy6i313ho8mh{text-transform:uppercase;}
      .z-style-r52i20xb74bg-417-width-0-w4fecq1sn92pa{width:65px;}
      .z-r52i20xb74bg-base-overflow-1qdmbfn1d1ft79{overflow:hidden;}
      .z-style-r52i20xb74bg-417-whiteSpace-1-1mjk3852x903b{white-space:pre;white-space:nowrap!important;}
      .z-r52i20xb74bg-base-textOverflow-1smpwgcf2t4wq{text-overflow:ellipsis;}
      .z-r52i20xb74bg-base-wordSpacing-1pz994y1clicsa{word-spacing:3px;}
      .z-style-r52i20xb74bg-580-width-0-w4fecq1sn92pa{width:65px;}
      .z-r52i20xb74bg-base-overflowWrap-ktfhln1af7awt{overflow-wrap:anywhere;}
      .z-style-r52i20xb74bg-580-whiteSpace-1-10e3hoeq4z9ku{white-space:normal;}"
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
      .z-10s7rhx1h1kg6d-base-display-vhv63u1h8q7xq{display:flex;}
      .z-10s7rhx1h1kg6d-base-gap-dk9dr9gxhsex{gap:40px;}
      .z-10s7rhx1h1kg6d-base-overflow-1imn49u190ocs0{overflow:auto;}
      .z-style-10s7rhx1h1kg6d-123-width-0-1gxe94w5ka7a4{width:100px;}
      .z-style-10s7rhx1h1kg6d-123-height-1-1lvpxb91a85iit{height:100px;}
      .z-style-10s7rhx1h1kg6d-123-scrollPadding-2-pbckjf1vrvf7b{scroll-padding:var(--z-t10s7rhx1h1kg6d-zyzz-spacing_2e_edge,10px);}
      .z-style-10s7rhx1h1kg6d-123-scrollSnapType-3-25qh5fveqjs7{scroll-snap-type:x proximity;scroll-snap-type:x mandatory!important;}
      .z-10s7rhx1h1kg6d-base-flexDirection-a1tuqs1xt0wkq{flex-direction:column;}
      .z-style-10s7rhx1h1kg6d-307-width-0-1gxe94w5ka7a4{width:100px;}
      .z-style-10s7rhx1h1kg6d-307-height-1-1lvpxb91a85iit{height:100px;}
      .z-style-10s7rhx1h1kg6d-307-scrollPadding-2-1hben271guqdkr{scroll-padding:10px;}
      .z-style-10s7rhx1h1kg6d-307-scrollSnapType-3-18o4ccwhp5jec{scroll-snap-type:y mandatory;}
      .z-style-10s7rhx1h1kg6d-481-width-0-16ck8rz1sn6psb{width:60px;}
      .z-style-10s7rhx1h1kg6d-481-height-1-1e1c8941plw9yq{height:60px;}
      .z-10s7rhx1h1kg6d-base-flexShrink-1v1o3p01etsu8c{flex-shrink:0;}
      .z-10s7rhx1h1kg6d-base-scrollMargin-1v9nii687nk9s{scroll-margin:5px;}
      .z-style-10s7rhx1h1kg6d-481-scrollSnapAlign-2-wwewt51x0tyof{scroll-snap-align:start;}
      .z-10s7rhx1h1kg6d-base-scrollSnapStop-1vpn4tp1nbsh53{scroll-snap-stop:normal;scroll-snap-stop:always!important;}
      .z-style-10s7rhx1h1kg6d-630-scrollSnapAlign-0-1j7r7441j25q9a{scroll-snap-align:none center;}
      .z-style-10s7rhx1h1kg6d-630-scrollSnapType-1-1g3rqhcbzshry{scroll-snap-type:both proximity;}"
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
      .z-1567lwky4x5t8-base-overflow-1imn49u190ocs0{overflow:auto;}
      .z-style-1567lwky4x5t8-136-height-0-1lvpxb91a85iit{height:100px;}
      .z-1567lwky4x5t8-base-width-1gxe94w5ka7a4{width:100px;}
      .z-style-1567lwky4x5t8-136-scrollBehavior-1-157ypz2wfe4zk{scroll-behavior:auto;}
      .z-style-1567lwky4x5t8-136-scrollPaddingTop-2-13zczc11y38yz{scroll-padding-top:10px;scroll-padding-top:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_offset,20px);}
      .z-style-1567lwky4x5t8-136-scrollPaddingInline-3-15qzjux16l6p7d{scroll-padding-inline:auto;}
      .z-style-1567lwky4x5t8-136-overscrollBehavior-4-1paybqe18d3lh6{overscroll-behavior:auto;overscroll-behavior:contain!important;}
      .z-style-1567lwky4x5t8-136-overscrollBehaviorX-5-dp3dsm1pte2ri{overscroll-behavior-x:none;}
      .z-1567lwky4x5t8-base-scrollMarginTop-rnm6ma1bianaq{scroll-margin-top:10px;}
      .z-style-1567lwky4x5t8-402-height-0-615jl01popy7q{height:20px;}
      .z-style-1567lwky4x5t8-473-scrollPaddingTop-0-1q7zolg131iaxe{scroll-padding-top:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_auto,24px);}
      .z-style-1567lwky4x5t8-557-scrollPaddingBlockStart-0-113lw3s1n2g5z0{scroll-padding-block-start:var(--z-t1567lwky4x5t8-zyzz-spacing_2e_offset,20px)!important;}
      .z-style-1567lwky4x5t8-628-scrollBehavior-0-x5vondnch1u5{scroll-behavior:smooth;}"
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
      .z-style-flktdz142jfd9-143-inlineSize-0-eafa5u1vytung{inline-size:min-content;}
      .z-style-flktdz142jfd9-206-inlineSize-0-n863341r2dnhu{inline-size:max-content;}
      .z-style-flktdz142jfd9-260-inlineSize-0-1hsw6lybcu4j2{inline-size:100%;inline-size:fit-content!important;}
      .z-style-flktdz142jfd9-260-minWidth-1-wvz0bp1679utp{min-width:auto;}
      .z-style-flktdz142jfd9-260-maxWidth-2-1muj44c11ursuu{max-width:none;}
      .z-style-flktdz142jfd9-361-width-0-1h05aq4z6iul2{width:var(--z-tflktdz142jfd9-zyzz-spacing_2e_min-content,24px);}
      .z-style-flktdz142jfd9-450-minInlineSize-0-1ypui5b1lqkykt{min-inline-size:var(--z-tflktdz142jfd9-zyzz-spacing_2e_narrow,40px);}
      .z-style-flktdz142jfd9-450-maxInlineSize-1-1jalvbd1ffkiyz{max-inline-size:max-content;}
      .z-style-flktdz142jfd9-450-blockSize-2-qqmjz7grq3b1{block-size:fit-content;}
      .z-style-flktdz142jfd9-450-minBlockSize-3-yfcc5mkn4cp6{min-block-size:auto;}
      .z-style-flktdz142jfd9-450-maxBlockSize-4-ixp9qf1h3h5ap{max-block-size:none;}
      .z-style-flktdz142jfd9-603-flexBasis-0-138e9dm1ky2cl6{flex-basis:content;}
      .z-style-flktdz142jfd9-603-width-1-7kmi181b5r3o8{width:5px;}
      .z-flktdz142jfd9-base-flexShrink-1v1o3p01etsu8c{flex-shrink:0;}
      .z-style-flktdz142jfd9-603-minWidth-2-a9l7wi1cqb1g2{min-width:0;}
      .z-style-flktdz142jfd9-694-flexBasis-0-ti6m1g10sxfx8{flex-basis:auto;}
      .z-style-flktdz142jfd9-694-width-1-7kmi181b5r3o8{width:5px;}
      .z-style-flktdz142jfd9-694-minWidth-2-a9l7wi1cqb1g2{min-width:0;}"
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
      .z-1qal89srxpye2-base-borderStyle-buueqqwfkbbc{border-style:solid;}
      .z-style-1qal89srxpye2-169-borderWidth-0-7shes2iwwwn2{border-width:2px;}
      .z-style-1qal89srxpye2-169-borderLeftWidth-1-1h8to9x2fije1{border-left-width:3px;}
      .z-style-1qal89srxpye2-169-borderInlineStartWidth-2-n3hlyi5l24dg{border-inline-start-width:4px;border-inline-start-width:5px!important;}
      .z-style-1qal89srxpye2-169-borderColor-3-1blrcf11ujpv8n{border-color:var(--z-t1qal89srxpye2-zyzz-borderColor_2e_brand,#06c);}
      .z-style-1qal89srxpye2-169-borderInlineEndColor-4-w3ywworwdoi6{border-inline-end-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);}
      .z-style-1qal89srxpye2-169-borderRadius-5-1ch6yq617zhj54{border-radius:var(--z-t1qal89srxpye2-zyzz-borderRadius_2e_round,8px);}
      .z-style-1qal89srxpye2-169-borderStartStartRadius-6-1l57hk5ttxwz{border-start-start-radius:10px;}
      .z-1qal89srxpye2-base-outlineColor-fp9gze1xe8z0k{outline-color:var(--z-t1qal89srxpye2-zyzz-color_2e_brand,#fff);}
      .z-1qal89srxpye2-base-outlineStyle-r7ymcc1ws62bq{outline-style:dashed;}
      .z-1qal89srxpye2-base-outlineWidth-6wx9r2dol102{outline-width:2px;}
      .z-1qal89srxpye2-base-outlineOffset-a8iaqd6ssm1j{outline-offset:-1px;}
      .z-style-1qal89srxpye2-524-borderWidth-0-7shes2iwwwn2{border-width:2px;}
      .z-style-1qal89srxpye2-524-borderInlineStartWidth-1-1m0cc90bfnfrk{border-inline-start-width:5px;}
      .z-style-1qal89srxpye2-524-borderLeftWidth-2-1h8to9x2fije1{border-left-width:3px;}"
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
      .z-bjw6jw1i067e2-base-display-vhv63u1h8q7xq{display:flex;}
      .z-bjw6jw1i067e2-base-flexWrap-1xty8mj1u7zem1{flex-wrap:wrap;}
      .z-style-bjw6jw1i067e2-122-width-0-1m0vqgo5emv6c{width:180px;}
      .z-style-bjw6jw1i067e2-122-height-1-1lvpxb91a85iit{height:100px;}
      .z-bjw6jw1i067e2-base-alignContent-qgtpbv1fi1ifd{align-content:space-between;}
      .z-bjw6jw1i067e2-base-alignItems-1g0whr15x1r33{align-items:flex-start;}
      .z-bjw6jw1i067e2-base-flexBasis-1aa94cjo4dtpd{flex-basis:40px;flex-basis:var(--z-tbjw6jw1i067e2-zyzz-spacing_2e_item,60px);}
      .z-bjw6jw1i067e2-base-flexGrow-19mweaaddzx9g{flex-grow:0;}
      .z-bjw6jw1i067e2-base-flexShrink-1v1o3p01etsu8c{flex-shrink:0;}
      .z-style-bjw6jw1i067e2-265-height-0-615jl01popy7q{height:20px;}
      .z-bjw6jw1i067e2-base-alignSelf-igrqsu14iz5ze{align-self:flex-end;}
      .z-bjw6jw1i067e2-base-order-lfpr4i1jay5fa{order:-1!important;}
      .z-style-bjw6jw1i067e2-421-width-0-q5t9dx1soln61{width:40px;}
      .z-style-bjw6jw1i067e2-421-height-1-1y1xify1pnb7cg{height:40px;}
      .z-style-bjw6jw1i067e2-421-overflow-2-1oz9w751vjo5dl{overflow:hidden;overflow:clip!important;}
      .z-style-bjw6jw1i067e2-421-overflowX-3-6kftf61ljd4ck{overflow-x:visible;}
      .z-style-bjw6jw1i067e2-528-width-0-q5t9dx1soln61{width:40px;}
      .z-style-bjw6jw1i067e2-528-height-1-1y1xify1pnb7cg{height:40px;}
      .z-style-bjw6jw1i067e2-528-overflowX-2-12idpzw12bmja4{overflow-x:clip;}
      .z-style-bjw6jw1i067e2-528-overflow-3-1qdmbfn1d1ft79{overflow:hidden;}
      .z-style-bjw6jw1i067e2-528-overflowY-4-1gdwugqeywkqu{overflow-y:scroll;}"
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
      .z-style-9k2sno1hln8ye-121-width-0-16ck8rz1sn6psb{width:60px;}
      .z-style-9k2sno1hln8ye-121-inlineSize-1-pude9cr075ka{inline-size:70px;inline-size:80px!important;}
      .z-style-9k2sno1hln8ye-121-blockSize-2-1n1j6scxl55ri{block-size:40px;}
      .z-style-9k2sno1hln8ye-121-paddingLeft-3-tvllqo7k06n2{padding-left:2px;}
      .z-style-9k2sno1hln8ye-121-paddingInlineStart-4-x0kv5kh9ioua{padding-inline-start:4px;padding-inline-start:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px);}
      .z-9k2sno1hln8ye-base-marginInlineEnd-9yu7uy1j9ptvk{margin-inline-end:var(--z-t9k2sno1hln8ye-zyzz-spacing_2e_space,12px)!important;}
      .z-9k2sno1hln8ye-base-position-15a516e1e2rexa{position:relative;}
      .z-9k2sno1hln8ye-base-insetInlineStart-kdmzbx19tiq9l{inset-inline-start:-3px;}
      .z-style-9k2sno1hln8ye-374-inlineSize-0-pz23ih1rrhlft{inline-size:30px;}
      .z-style-9k2sno1hln8ye-374-width-1-1h0zfci1snxpxk{width:50px;}
      .z-style-9k2sno1hln8ye-374-paddingInlineStart-2-1ul4ssb1l995r9{padding-inline-start:6px;}
      .z-style-9k2sno1hln8ye-374-paddingLeft-3-vd0zxi7jsl3o{padding-left:8px;}"
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
      .z-style-1s1gwcevjtf8w-105-padding-0-1wxstjdutwtul{padding:var(--z-t1s1gwcevjtf8w-theme-spacing_2e_0,8px)!important;}
      .z-style-1s1gwcevjtf8w-157-padding-0-15b18kr9vggzp{padding:0!important;}
      .z-style-1s1gwcevjtf8w-201-padding-0-137cmb68vul4y{padding:0;}"
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
      .z-1jvt0134f5zz3-base-display-1bb1nbg1s0hv98{display:block;display:flex;}
      .z-1jvt0134f5zz3-base-color-gbk1ihjjxnab{color:#000;color:var(--z-t1jvt0134f5zz3-theme-color_2e_brand,#06c);}"
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
      .z-1aowg2i1i6ewzi-base-width-tp1wsl1kasl4v{width:50vw;width:50cqi!important;}
      .z-1aowg2i1i6ewzi-base-height-naz0hz1a6alvr{height:10dvh;}
      .z-style-1aowg2i1i6ewzi-117-marginLeft-0-19s31zi19pef68{margin-left:-1in;}
      .z-1aowg2i1i6ewzi-base-borderWidth-1ilrvqaiww752{border-width:1pc;}
      .z-1aowg2i1i6ewzi-base-borderStyle-buueqqwfkbbc{border-style:solid;}
      .z-1aowg2i1i6ewzi-base-padding-1v9venz14oaxwd{padding:1rem;padding:var(--z-t1aowg2i1i6ewzi-zyzz-spacing_2e_space,1lh);}
      .z-style-1aowg2i1i6ewzi-244-marginTop-0-fgh30c102ppug{margin-top:2rlh!important;}"
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
      .z-style-1ne2r2w17wkfe-183-color-0-1gvbydy7hu78q{color:#000;color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c);color:var(--z-t1ne2r2w17wkfe-theme-color_2e_brand,#06c)!important;}
      .z-1ne2r2w17wkfe-base-display-1bb1nbg1s0hv98{display:block;display:flex;}
      .z-1ne2r2w17wkfe-base-opacity-1bw06l81vdugw{opacity:0.25!important;opacity:0.75;}
      .z-style-1ne2r2w17wkfe-183-padding-1-k2dkrb1jrvci1{padding:4px!important;padding:8px;}
      .z-style-1ne2r2w17wkfe-183-paddingLeft-2-1ko0odh109i2bz{padding-left:12px;}
      .z-style-1ne2r2w17wkfe-390-color-0-42fa513qc117{color:#fff;}
      .z-style-1ne2r2w17wkfe-390-padding-1-14q167e60x2jc{padding:20px;}"
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
      export const props = ({className:"z-1wr3l4n1jk260t-base-color-c2tu4z1kdh70v z-1wr3l4n1jk260t-base-borderColor-w6swfe1n4jdb6 z-1wr3l4n1jk260t-base-padding-1vwth4jclfo3j"});
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1wr3l4n1jk260t-theme{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#06c;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#123;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z_theme-1wr3l4n1jk260t-alternate{--z-t1wr3l4n1jk260t-theme-color_2e_transparent:#175;--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500:#456;--z-t1wr3l4n1jk260t-theme-spacing_2e_0:8px;}
      .z-1wr3l4n1jk260t-base-color-c2tu4z1kdh70v{color:var(--z-t1wr3l4n1jk260t-theme-color_2e_transparent,#06c);}
      .z-1wr3l4n1jk260t-base-borderColor-w6swfe1n4jdb6{border-color:var(--z-t1wr3l4n1jk260t-theme-color_2e_palette_2e_500,#123);}
      .z-1wr3l4n1jk260t-base-padding-1vwth4jclfo3j{padding:var(--z-t1wr3l4n1jk260t-theme-spacing_2e_0,8px);}"
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
        "{"className":"z-1wr3l4n1jk260t-base-color-c2tu4z1kdh70v z-1wr3l4n1jk260t-base-borderColor-w6swfe1n4jdb6 z-1wr3l4n1jk260t-base-padding-1vwth4jclfo3j"}
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
      export const props = ({className:"z-1dre7461ulsxz8-base-color-wvwsth1owz0uv z-1dre7461ulsxz8-base-padding-m69j1ng0xre9"});"
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1dre7461ulsxz8-theme{--z-t1dre7461ulsxz8-theme-color_2e_brand:light-dark(#000,#fff);--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z_theme-1dre7461ulsxz8-alternate{--z-t1dre7461ulsxz8-theme-color_2e_brand:#f00;--z-t1dre7461ulsxz8-theme-spacing_2e_md:8px;}
      .z-1dre7461ulsxz8-base-color-wvwsth1owz0uv{color:var(--z-t1dre7461ulsxz8-theme-color_2e_brand,light-dark(#000,#fff));}
      .z-1dre7461ulsxz8-base-padding-m69j1ng0xre9{padding:var(--z-t1dre7461ulsxz8-theme-spacing_2e_md,8px);}"
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
      export const props = { className: "z-1kg4lys8lrjea-base-color-vbdistps1pr5" };
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
      export const first = ({className:"z-1ypjmwd1mnjqht-base-color-1ae4wfq8c11t6"});
      export const second = ({className:"z-1ypjmwd1mnjqht-base-padding-13e1ao08prby"});
      export function shadow(css: (input: string) => string) { return css('untouched') }
      "
    `)
    expect(result.css).toMatchInlineSnapshot(`
      ".z_theme-1ypjmwd1mnjqht-theme{--z-t1ypjmwd1mnjqht-theme-color_2e_brand:#06c;--z-t1ypjmwd1mnjqht-theme-spacing_2e_md:8px;}
      .z-1ypjmwd1mnjqht-base-color-1ae4wfq8c11t6{color:var(--z-t1ypjmwd1mnjqht-theme-color_2e_brand,#06c);}
      .z-1ypjmwd1mnjqht-base-padding-13e1ao08prby{padding:var(--z-t1ypjmwd1mnjqht-theme-spacing_2e_md,8px);}"
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
        "{"className":"z-1ypjmwd1mnjqht-base-color-1ae4wfq8c11t6"}
        {"className":"z-1ypjmwd1mnjqht-base-padding-13e1ao08prby"}
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
      export function card(value = ({className:"z-1yrnmp3116l80n-base-color-17tkimx1xfrfdh"})) { var css = 1; return value }
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
      export const props = ({className:"z-14fkufe1imnkw4-base-color-rxarch3qdsl7 z-14fkufe1imnkw4-base-padding-1py2bmyf8tdvm"});"
    `)

    expect(result.css).toMatchInlineSnapshot(
      `
      ".z-14fkufe1imnkw4-base-color-rxarch3qdsl7{color:#f00;}
      .z-14fkufe1imnkw4-base-padding-1py2bmyf8tdvm{padding:8px;}"
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
       const __zyzzProps = 1; export const el = <button {...({className:"z-15sihh01ggr9so-base-color-rxarch3qdsl7"})} />; export const button = __zyzzProps_.create({className:"z-style-15sihh01ggr9so-130"});",
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
            "button": "z_base-padding-137cmb68vul4y",
          },
          "css": ".z_base-padding-137cmb68vul4y{padding:0;}",
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
          "className": "z-fyitz4td647s-base-color-rxarch3qdsl7 z-style-fyitz4td647s-50 external",
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
