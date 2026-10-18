/**
 * Verifies pinned Base UI attribute generation through the command-line boundary.
 * @module
 */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'

import { catalog } from '../src/base-ui/react/internal/Catalog.generated.js'

describe('generate', () => {
  test('checks the installed declarations against all reviewed outputs', () => {
    // Repository formatting must not change generated JSON before the drift check.
    ChildProcess.execFileSync(
      Path.resolve(import.meta.dirname, '../node_modules/.bin/vp'),
      [
        'fmt',
        '--check',
        Path.resolve(
          import.meta.dirname,
          '../crates/compiler/src/generated/base_ui.json',
        ),
        Path.resolve(import.meta.dirname, '../test/conformance/base-ui.json'),
      ],
      { encoding: 'utf8' },
    )

    const output = ChildProcess.execFileSync(
      process.execPath,
      [Path.join(import.meta.dirname, 'base-ui.ts'), '--check'],
      { encoding: 'utf8' },
    )

    expect(output).toMatchInlineSnapshot(`
      "Base UI 1.8.0: 208 supported parts, 67 deferred entries
      "
    `)
  }, 30_000)

  test('preserves public aliases, descriptions, and finite literal values', () => {
    expect(catalog['Select.Trigger'].states.popupSide).toMatchInlineSnapshot(`
      {
        "attribute": "data-popup-side",
        "description": "Indicates which side the corresponding popup is positioned relative to its anchor.",
        "url": "https://base-ui.com/react/components/select#trigger",
        "values": [
          "top",
          "bottom",
          "left",
          "right",
          "inline-end",
          "inline-start",
        ],
      }
    `)
    expect(catalog['Select.Item'].states.highlighted).toMatchInlineSnapshot(`
      {
        "attribute": "data-highlighted",
        "description": "Present when the select item is highlighted.",
        "url": "https://base-ui.com/react/components/select#item",
        "values": null,
      }
    `)
    expect(catalog['Select.Popup'].states.side.values).toMatchInlineSnapshot(`
      [
        "none",
        "top",
        "bottom",
        "left",
        "right",
        "inline-end",
        "inline-start",
      ]
    `)

    const inventory = JSON.parse(
      Fs.readFileSync(
        Path.resolve(import.meta.dirname, '../test/conformance/base-ui.json'),
        'utf8',
      ),
    ) as { deferred: Record<string, string> }
    expect(inventory.deferred['Accordion.Item']).toMatchInlineSnapshot(
      `"Unbounded or unhandled @type for index"`,
    )
    expect(inventory.deferred['Slider.Thumb']).toMatchInlineSnapshot(
      `"Missing value domain for index"`,
    )
    expect(inventory.deferred.DirectionProvider).toMatchInlineSnapshot(
      `"No className contract (provider, root, or non-DOM component)"`,
    )
    expect('DirectionProvider' in catalog).toMatchInlineSnapshot(`false`)
    expect(catalog['AlertDialog.Popup'].member).toMatchInlineSnapshot(`"Popup"`)
    expect(catalog['Autocomplete.Clear'].member).toMatchInlineSnapshot(
      `"Clear"`,
    )
  })

  test('checks augmentation without skipLibCheck and offers language-service hints', () => {
    const root = Path.resolve(import.meta.dirname, '..')
    const file = Path.join(root, '.base-ui-consumer.mts')
    const source = `
import type { ComponentProps, ElementType } from 'react'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog } from '@base-ui/react/dialog'
import { Menu } from '@base-ui/react/menu'
import { Toolbar } from '@base-ui/react/toolbar'
import { part, type States, type Selectors } from './src/base-ui/react/internal/Types.generated.js'
type Hint<c extends ElementType> = ComponentProps<c> extends { readonly [part]?: infer identity } ? NonNullable<identity> : never
const alias: Hint<typeof AlertDialog.Popup> = 'Dialog.Popup'
const canonical: Hint<typeof Dialog.Popup> = 'AlertDialog.Popup'
// @ts-expect-error Unrelated DOM contracts do not share a hint.
const unrelated: Hint<typeof Dialog.Popup> = 'Select.Popup'
type HasHint<t> = typeof part extends keyof t ? true : false
const parent: HasHint<ComponentProps<typeof Menu.Separator>> = false
const child: HasHint<ComponentProps<typeof Toolbar.Separator>> = false
const triggerParent: HasHint<ComponentProps<typeof Dialog.Trigger>> = false
const triggerChild: HasHint<ComponentProps<typeof AlertDialog.Trigger>> = false
const states: States<{}>['Select.Trigger'] = { popupSide: { top: {} } }
// @ts-expect-error Null means the attribute is absent, not a literal value.
const absent: States<{}>['Select.Trigger'] = { popupSide: { null: {} } }
const selectors: Selectors<{}>['Select.Trigger'] = { '&[data-popup-side="top"]': {} }
`
    const options: Ts.CompilerOptions = {
      exactOptionalPropertyTypes: true,
      module: Ts.ModuleKind.NodeNext,
      moduleResolution: Ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: false,
      strict: true,
      target: Ts.ScriptTarget.ESNext,
      types: ['node'],
    }
    const host: Ts.LanguageServiceHost = {
      ...Ts.sys,
      getCompilationSettings: () => options,
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
    }
    const service = Ts.createLanguageService(host)
    try {
      const program = service.getProgram()!
      expect(
        Ts.getPreEmitDiagnostics(program).map((diagnostic) =>
          Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
      ).toMatchInlineSnapshot(`[]`)

      const position = source.indexOf(' top:') + 1
      const completions = service.getCompletionsAtPosition(file, position, {})
      expect(
        completions?.entries
          .map((entry) =>
            entry.name.startsWith('"') ? JSON.parse(entry.name) : entry.name,
          )
          .sort(),
      ).toMatchInlineSnapshot(`
        [
          "bottom",
          "inline-end",
          "inline-start",
          "left",
          "right",
          "top",
        ]
      `)

      const details = service.getCompletionEntryDetails(
        file,
        position,
        'top',
        {},
        undefined,
        {},
        undefined,
      )
      expect(
        Ts.displayPartsToString(details?.documentation).includes(
          'data-popup-side',
        ),
      ).toMatchInlineSnapshot(`true`)
    } finally {
      service.dispose()
    }

    const mapping = JSON.parse(
      Fs.readFileSync(
        Path.join(root, 'crates/compiler/src/generated/base_ui.json'),
        'utf8',
      ),
    )
    expect(
      JSON.stringify(mapping) === JSON.stringify(catalog),
    ).toMatchInlineSnapshot(`true`)
  }, 30_000)
})
