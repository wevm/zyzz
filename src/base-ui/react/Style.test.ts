/** Exercises real editor completions and rendered Base UI state styles. @module */
import { NavigationMenu } from '@base-ui/react/navigation-menu'
import { Popover } from '@base-ui/react/popover'
import { Select } from '@base-ui/react/select'
import { Toast } from '@base-ui/react/toast'
import * as Esbuild from 'esbuild'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { chromium } from 'playwright'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'
import { style as rootStyle } from 'zyzz'
import { defineConfig, style } from 'zyzz/base-ui/react'
import { Graph, Transform } from 'zyzz/compiler'

const root = Path.resolve(import.meta.dirname, '../../..')

describe('style', () => {
  test('offers component-specific editor hints, documentation, and spelling diagnostics', () => {
    const file = Path.join(root, '.fixture-base-ui-editor.tsx')
    const source = `
      import { Select } from '@base-ui/react/select'
      import { style } from 'zyzz/base-ui/react'
      style(Select.Item, { states: { /* state */ highlighted: { color: 'red' } } })
      style(Select.Popup, { states: { side: { /* value */ bottom: {} } } })
      style(Select.Item, { selectors: { /* selector */ '&[data-': {} } })
      style(Select.Item, { selectors: { '&[data-app-mode="busy"]': { opacity: 0.5 } } })
      const item = style(Select.Item, { color: 'red' })
      const element = <Select.Item {...item()} value="apple">Apple</Select.Item>
      style(Select.Item, { states: { higlighted: { color: 'red' } } })
    `
    const config = Ts.readConfigFile(
      Path.join(root, 'tsconfig.json'),
      Ts.sys.readFile,
    )
    const parsed = Ts.parseJsonConfigFileContent(config.config, Ts.sys, root)
    const service = Ts.createLanguageService({
      ...Ts.sys,
      getCompilationSettings: () => parsed.options,
      getCurrentDirectory: () => root,
      getDefaultLibFileName: Ts.getDefaultLibFilePath,
      getScriptFileNames: () => [file],
      getScriptSnapshot: (name) => {
        const text = name === file ? source : Ts.sys.readFile(name)
        return text === undefined
          ? undefined
          : Ts.ScriptSnapshot.fromString(text)
      },
      getScriptVersion: () => '0',
      useCaseSensitiveFileNames: () => Ts.sys.useCaseSensitiveFileNames,
    })
    const position = (marker: string) =>
      source.indexOf(`/* ${marker} */`) + marker.length + 7

    try {
      expect(
        service
          .getCompletionsAtPosition(file, position('state'), {})
          ?.entries.map((entry) => entry.name)
          .sort(),
      ).toMatchInlineSnapshot(`
        [
          "disabled",
          "highlighted",
          "selected",
        ]
      `)
      expect(
        service
          .getCompletionsAtPosition(file, position('value'), {})
          ?.entries.map((entry) => entry.name.replaceAll('"', ''))
          .sort(),
      ).toMatchInlineSnapshot(`
        [
          "bottom",
          "inline-end",
          "inline-start",
          "left",
          "none",
          "right",
          "top",
        ]
      `)
      const cursor = source.indexOf("'&[data-'") + "'&[data-".length
      expect(
        service
          .getCompletionsAtPosition(file, cursor, {})
          ?.entries.map((entry) => entry.name)
          .sort(),
      ).toMatchInlineSnapshot(`
        [
          "&[data-disabled]",
          "&[data-highlighted]",
          "&[data-selected]",
        ]
      `)
      const details = service.getCompletionEntryDetails(
        file,
        position('state'),
        'highlighted',
        {},
        undefined,
        {},
        undefined,
      )
      expect(Ts.displayPartsToString(details?.documentation))
        .toMatchInlineSnapshot(`"Present when the select item is highlighted.
Attribute: \`data-highlighted\`. Presence selector."`)
      expect(service.getSemanticDiagnostics(file).map((entry) => entry.code))
        .toMatchInlineSnapshot(`
        [
          2769,
        ]
      `)
    } finally {
      service.dispose()
    }
  }, 60_000)

  test('matches CSS-only identities without loading a component registry', () => {
    const output = Transform.compile({
      compiler: false,
      moduleId: 'item.ts',
      source: `import { Select } from '@base-ui/react/select'; import { style } from 'zyzz/base-ui/react';
        export const item = style(Select.Item, { states: { highlighted: {color:'red'} }, selectors: {'&[data-highlighted]': {color:'blue'}} });`,
    })
    const item = style(Select.Item, {
      states: { highlighted: { color: 'red' } },
      selectors: { '&[data-highlighted]': { color: 'blue' } },
    })

    expect(Object.values(output.classes)).toMatchInlineSnapshot(`
      [
        "z-content-_5b__5b__22__26__5b_data_2d_highlighted_5d__22__2c__5b__5b__22_color_22__2c__22_red_22__2c_false_5d__5d__5d__2c__5b__22__26__5b_data_2d_highlighted_5d__2f__2a_base_2d_ui_2d_1_2a__2f__22__2c__5b__5b__22_color_22__2c__22_blue_22__2c_false_5d__5d__5d__5d_",
      ]
    `)
    expect(item()).toMatchInlineSnapshot(`
      {
        "className": "z-content-_5b__5b__22__26__5b_data_2d_highlighted_5d__22__2c__5b__5b__22_color_22__2c__22_red_22__2c_false_5d__5d__5d__2c__5b__22__26__5b_data_2d_highlighted_5d__2f__2a_base_2d_ui_2d_1_2a__2f__22__2c__5b__5b__22_color_22__2c__22_blue_22__2c_false_5d__5d__5d__5d_",
      }
    `)
    expect(output.css).toMatchInlineSnapshot(`
      ".z-content-_5b__5b__22__26__5b_data_2d_highlighted_5d__22__2c__5b__5b__22_color_22__2c__22_red_22__2c_false_5d__5d__5d__2c__5b__22__26__5b_data_2d_highlighted_5d__2f__2a_base_2d_ui_2d_1_2a__2f__22__2c__5b__5b__22_color_22__2c__22_blue_22__2c_false_5d__5d__5d__5d_{&[data-highlighted]{color:red;}}
      .z-content-_5b__5b__22__26__5b_data_2d_highlighted_5d__22__2c__5b__5b__22_color_22__2c__22_red_22__2c_false_5d__5d__5d__2c__5b__22__26__5b_data_2d_highlighted_5d__2f__2a_base_2d_ui_2d_1_2a__2f__22__2c__5b__5b__22_color_22__2c__22_blue_22__2c_false_5d__5d__5d__5d_{&[data-highlighted]/*base-ui-1*/{color:blue;}}"
    `)
    expect(
      Object.values(output.classes).includes(item().className),
    ).toMatchInlineSnapshot('true')
    const dynamic = style(
      (values: { opacity: number }) => ({ opacity: values.opacity }),
      { id: 'ordinary-dynamic' },
    )
    expect(dynamic({ opacity: 0.3 })).toMatchInlineSnapshot(`
      {
        "className": "z-style-id-ordinary_2d_dynamic",
        "style": {
          "--z-ordinary_2d_dynamic-opacity": 0.3,
        },
      }
    `)

    const configured = defineConfig({ shorthands: { click: ['color'] } })
    const presence = configured.style(NavigationMenu.Positioner, {
      states: { instant: { click: 'red' } },
    })
    const valued = style(Popover.Popup, {
      states: { instant: { click: { color: 'red' } } },
    })
    expect(
      presence().className ===
        rootStyle({ selectors: { '&[data-instant]': { color: 'red' } } })()
          .className,
    ).toMatchInlineSnapshot('true')
    expect(
      valued().className ===
        rootStyle({
          selectors: { '&[data-instant="click"]': { color: 'red' } },
        })().className,
    ).toMatchInlineSnapshot('true')
  })

  test.each([true, false])(
    'renders numeric, arbitrary-string, supplemental, and child states (compiler=%s)',
    async (compiler) => {
      const output = Transform.compile({
        compiler,
        moduleId: 'Coverage.tsx',
        source: Fs.readFileSync(
          Path.join(root, 'test/fixtures/base-ui/Coverage.tsx'),
          'utf8',
        ),
      })
      const browser = await chromium.launch()
      const directory = Fs.mkdtempSync(
        Path.join(root, '.fixture-base-ui-browser-'),
      )

      try {
        Fs.writeFileSync(Path.join(directory, 'Coverage.tsx'), output.code)
        const bundle = await Esbuild.build({
          bundle: true,
          conditions: ['src'],
          entryPoints: [Path.join(directory, 'Coverage.tsx')],
          format: 'iife',
          globalName: 'Fixture',
          jsx: 'automatic',
          write: false,
        })
        const page = await browser.newPage()
        page.setDefaultTimeout(5_000)
        await page.setContent(
          `<style>${output.css}</style><div id="root"></div>`,
        )
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
        await page.evaluate('Fixture.mount(document.getElementById("root"))')
        await page.getByTestId('custom').waitFor({ state: 'visible' })
        const computed = (testId: string, property: string) =>
          page
            .getByTestId(testId)
            .evaluate(
              (element, name) =>
                getComputedStyle(element).getPropertyValue(name),
              property,
            )

        expect(
          await computed('first', 'border-left-width'),
        ).toMatchInlineSnapshot(`"4px"`)
        expect(
          await computed('second', 'border-left-width'),
        ).toMatchInlineSnapshot(`"6px"`)
        expect(await computed('disabled', 'color')).toMatchInlineSnapshot(
          `"rgb(128, 0, 128)"`,
        )
        expect(await computed('enabled', 'color')).toMatchInlineSnapshot(
          `"rgb(0, 0, 0)"`,
        )
        expect(await computed('custom', 'color')).toMatchInlineSnapshot(
          `"rgb(0, 128, 0)"`,
        )
        expect(await computed('other', 'color')).toMatchInlineSnapshot(
          `"rgb(0, 0, 0)"`,
        )
        expect(
          await page
            .locator('[data-index="0"]')
            .filter({ has: page.getByRole('slider', { name: 'Lower' }) })
            .evaluate((element) => getComputedStyle(element).backgroundColor),
        ).toMatchInlineSnapshot(`"rgb(255, 0, 0)"`)
        expect(
          await page
            .locator('[data-index="1"]')
            .filter({ has: page.getByRole('slider', { name: 'Upper' }) })
            .evaluate((element) => getComputedStyle(element).backgroundColor),
        ).toMatchInlineSnapshot(`"rgb(0, 0, 255)"`)
        expect(
          await computed('viewport', 'border-left-width'),
        ).toMatchInlineSnapshot(`"1px"`)
        expect(
          await page
            .locator('[data-testid="viewport"] > [data-current]')
            .evaluate((element) => getComputedStyle(element).borderLeftWidth),
        ).toMatchInlineSnapshot(`"7px"`)
      } finally {
        await browser.close()
        Fs.rmSync(directory, { force: true, recursive: true })
      }
    },
  )

  test('rejects invalid numeric domains and NUL in arbitrary state values', () => {
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { Slider } from '@base-ui/react/slider'; import { style } from 'zyzz/base-ui/react'; style(Slider.Thumb, { states: { index: { first: { color: 'red' } } } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:133: Unknown Base UI state value: index.first.]`,
    )
    expect(() =>
      Transform.compile({
        moduleId: 'invalid.ts',
        source: `import { Toast } from '@base-ui/react/toast'; import { style } from 'zyzz/base-ui/react'; style(Toast.Root, { states: { type: { 'a\\0b': { color: 'red' } } } });`,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Source.ExtractError: invalid.ts:128: Base UI state values cannot contain NUL.]`,
    )
    expect(() =>
      style(Toast.Root, { states: { type: { 'a\0b': { color: 'red' } } } }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Style.InvalidError: []: Base UI state values cannot contain NUL.]`,
    )
  })

  test.each([true, false])(
    'renders selected, highlighted, disabled and placement states (compiler=%s)',
    async (compiler) => {
      const modules = Object.fromEntries(
        ['Config.ts', 'Select.tsx'].map((file) => [
          file,
          Fs.readFileSync(
            Path.join(root, 'test/fixtures/base-ui', file),
            'utf8',
          ),
        ]),
      )
      const output = Graph.compile({ compiler, modules })
      const browser = await chromium.launch()
      const directory = Fs.mkdtempSync(
        Path.join(root, '.fixture-base-ui-browser-'),
      )

      try {
        for (const [file, module] of Object.entries(output.modules))
          Fs.writeFileSync(Path.join(directory, file), module.code)

        const bundle = await Esbuild.build({
          bundle: true,
          conditions: ['src'],
          entryPoints: [Path.join(directory, 'Select.tsx')],
          format: 'iife',
          globalName: 'Fixture',
          jsx: 'automatic',
          write: false,
        })
        const page = await browser.newPage()
        await page.setContent(
          `<style>${Object.values(output.modules)
            .map((module) => module.css)
            .join('\n')}</style><div id="root"></div>`,
        )
        await page.addScriptTag({ content: bundle.outputFiles[0]!.text })
        await page.evaluate('Fixture.mount(document.getElementById("root"))')
        const trigger = page.getByRole('combobox', { name: 'Fruit' })
        await trigger.click()
        const apple = page.getByRole('option', { name: 'Apple' })
        const banana = page.getByRole('option', { name: 'Banana' })
        const cherry = page.getByRole('option', { name: 'Cherry' })
        await apple.waitFor({ state: 'visible' })
        expect(
          await apple.evaluate(
            (element) => getComputedStyle(element).fontWeight,
          ),
        ).toMatchInlineSnapshot('"700"')
        expect(
          await cherry.evaluate((element) => getComputedStyle(element).opacity),
        ).toMatchInlineSnapshot('"0.4"')
        await page
          .locator('[data-testid="popup"][data-side="bottom"]')
          .waitFor({ state: 'visible' })
        expect(
          await page
            .getByTestId('popup')
            .evaluate((element) => getComputedStyle(element).paddingTop),
        ).toMatchInlineSnapshot('"12px"')
        await page.keyboard.press('ArrowDown')
        await page.waitForFunction(
          () =>
            document.querySelector('[role="option"][data-highlighted]')
              ?.textContent === 'Banana',
        )
        expect(
          await banana.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          ),
        ).toMatchInlineSnapshot('"rgb(219, 234, 254)"')
        expect(
          await banana.evaluate(
            (element) => getComputedStyle(element).paddingLeft,
          ),
        ).toMatchInlineSnapshot('"10px"')
        await page.keyboard.press('Enter')
        expect(await trigger.textContent()).toMatchInlineSnapshot('"banana▾"')
      } finally {
        await browser.close()
        Fs.rmSync(directory, { force: true, recursive: true })
      }
    },
  )
})
