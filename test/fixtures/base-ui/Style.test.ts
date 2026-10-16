/** Exercises selector suggestions through the real TypeScript language service. @module */
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'

describe('style', () => {
  test('completes component-specific selectors and exposes structural collisions', () => {
    const root = Path.resolve(import.meta.dirname, '../../..')
    const contract = Path.join(import.meta.dirname, 'Style.test-d.ts')
    const directory = Fs.mkdtempSync(Path.join(root, '.fixture-base-ui-'))
    const file = Path.join(directory, 'consumer.tsx')
    const source = `
      import { Menu } from '@base-ui/react/menu'
      import { Select } from '@base-ui/react/select'
      import { style } from '../test/fixtures/base-ui/Style.js'

      // These partial keys model an editor with the cursor inside a selector string.
      style(Select.Item, { selectors: { /* item */ '&[data-': {} } })
      style(Select.Popup, { selectors: { /* popup */ '&[data-': {} } })
      style(Select.Trigger, { selectors: { /* trigger */ '&[data-': {} } })
      style(Select.Popup, { selectors: { /* side */ '&[data-side="': {} } })
      style(Select.Item, { selectors: {
        '&[data-selected]': { selectors: { /* nested */ '&[data-': {} } },
      } })

      // A subset state must not accidentally match Select.Item.
      style(Menu.Item, { selectors: { /* unsupported */ '&[data-': {} } })

      // Structural types cannot prove the component renders Base UI attributes.
      function Lookalike(props: {
        className?: string | ((state: Select.Item.State) => string)
      }) { return null }
      style(Lookalike, { selectors: { /* collision */ '&[data-': {} } })

      // Applying the declared result uses the ordinary spread-props contract.
      const item = style(Select.Item, { color: 'red' })
      const element = <Select.Item {...item()} value="apple">Apple</Select.Item>
    `
    Fs.writeFileSync(file, source)

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
      getScriptFileNames: () => [file, contract],
      getScriptSnapshot: (name) => {
        const text = Ts.sys.readFile(name)
        return text === undefined
          ? undefined
          : Ts.ScriptSnapshot.fromString(text)
      },
      getScriptVersion: () => '0',
      useCaseSensitiveFileNames: () => Ts.sys.useCaseSensitiveFileNames,
    })

    const complete = (marker: string, prefix = '&[data-') => {
      const start = source.indexOf(`/* ${marker} */`)
      const position = source.indexOf(prefix, start) + prefix.length
      return (
        service
          .getCompletionsAtPosition(file, position, {})
          ?.entries.map((entry) => entry.name)
          .filter((name) => name.startsWith(prefix))
          .sort() ?? []
      )
    }

    try {
      expect(
        service
          .getSyntacticDiagnostics(file)
          .map((diagnostic) => diagnostic.messageText),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        service
          .getSemanticDiagnostics(file)
          .map((diagnostic) => diagnostic.messageText),
      ).toMatchInlineSnapshot(`[]`)
      expect(
        service
          .getSemanticDiagnostics(contract)
          .map((diagnostic) => diagnostic.messageText),
      ).toMatchInlineSnapshot(`[]`)

      expect(complete('item')).toMatchInlineSnapshot(`
        [
          "&[data-disabled]",
          "&[data-highlighted]",
          "&[data-selected]",
        ]
      `)
      expect(complete('popup')).toMatchInlineSnapshot(`
        [
          "&[data-align="center"]",
          "&[data-align="end"]",
          "&[data-align="start"]",
          "&[data-align]",
          "&[data-closed]",
          "&[data-ending-style]",
          "&[data-open]",
          "&[data-side="bottom"]",
          "&[data-side="inline-end"]",
          "&[data-side="inline-start"]",
          "&[data-side="left"]",
          "&[data-side="none"]",
          "&[data-side="right"]",
          "&[data-side="top"]",
          "&[data-side]",
          "&[data-starting-style]",
        ]
      `)
      expect(complete('trigger')).toMatchInlineSnapshot(`
        [
          "&[data-dirty]",
          "&[data-disabled]",
          "&[data-filled]",
          "&[data-focused]",
          "&[data-invalid]",
          "&[data-placeholder]",
          "&[data-popup-open]",
          "&[data-popup-side="bottom"]",
          "&[data-popup-side="inline-end"]",
          "&[data-popup-side="inline-start"]",
          "&[data-popup-side="left"]",
          "&[data-popup-side="right"]",
          "&[data-popup-side="top"]",
          "&[data-popup-side]",
          "&[data-pressed]",
          "&[data-readonly]",
          "&[data-required]",
          "&[data-touched]",
          "&[data-valid]",
        ]
      `)
      expect(complete('side', '&[data-side="')).toMatchInlineSnapshot(`
        [
          "&[data-side="bottom"]",
          "&[data-side="inline-end"]",
          "&[data-side="inline-start"]",
          "&[data-side="left"]",
          "&[data-side="none"]",
          "&[data-side="right"]",
          "&[data-side="top"]",
        ]
      `)
      expect(complete('nested')).toMatchInlineSnapshot(`
        [
          "&[data-disabled]",
          "&[data-highlighted]",
          "&[data-selected]",
        ]
      `)
      expect(complete('unsupported')).toMatchInlineSnapshot(`[]`)
      expect(complete('collision')).toMatchInlineSnapshot(`
        [
          "&[data-disabled]",
          "&[data-highlighted]",
          "&[data-selected]",
        ]
      `)
    } finally {
      service.dispose()
      Fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
