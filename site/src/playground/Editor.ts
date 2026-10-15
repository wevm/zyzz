/** Applies the docs' Tempo syntax themes to the playground's Monaco editors. @module */
import { loader } from '@monaco-editor/react'
import { shikiToMonaco } from '@shikijs/monaco'
import type * as Monaco from 'monaco-editor'
import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'
import css from 'shiki/langs/css.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import * as Example from '../Example.js'

// Monaco's network requests run alongside the highlighter, not after it.
const highlighterPromise = createHighlighterCore({
  engine: createOnigurumaEngine(import('shiki/wasm')),
  // Keep Monaco's TypeScript language services while highlighting JSX as well.
  langAlias: { typescript: 'tsx' },
  langs: [css, tsx],
  themes: [Example.theme, Example.lightTheme].map((theme) => {
    const replacements: Record<string, string> =
      theme.type === 'light' ? Example.lightTheme.colorReplacements : {}

    return {
      ...theme,
      colors: {
        ...theme.colors,
        // Docs code blocks use the page surface, not Shiki's standalone background.
        'editor.background': theme.type === 'dark' ? '#000000' : '#fafafa',
      },
      // Monaco consumes TextMate rules directly, bypassing Shiki's color replacements.
      settings: theme.settings.map((entry) => ({
        ...entry,
        settings: {
          ...entry.settings,
          foreground:
            replacements[entry.settings.foreground] ??
            entry.settings.foreground,
        },
      })),
    }
  }),
})
const [highlighter] = await Promise.all([highlighterPromise, loader.init()])

let initialized = false

/** Registers highlighting once, before either editor is created. */
export function beforeMount(monaco: typeof Monaco) {
  if (initialized) return
  initialized = true

  shikiToMonaco(highlighter, monaco)
  // Compiler diagnostics are authoritative until package declarations are available.
  monaco.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
  })
  monaco.typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    jsx: monaco.typescript.JsxEmit.ReactJSX,
    target: monaco.typescript.ScriptTarget.ESNext,
  })
}

/** Keeps brackets in the syntax palette when switching between file models. */
export function onMount(editor: Monaco.editor.IStandaloneCodeEditor) {
  // Monaco initializes model options when attaching it, after beforeMount runs.
  const update = () =>
    editor.getModel()?.updateOptions({
      bracketColorizationOptions: {
        enabled: false,
        independentColorPoolPerBracketType: false,
      },
    })
  editor.onDidChangeModel(update)
  update()
}

/** Shared source and output editor options, with wrapping and docs typography. */
export const options = {
  automaticLayout: true,
  bracketPairColorization: { enabled: false },
  fontFamily: 'Geist Mono, monospace',
  fontSize: 15,
  lineHeight: 24,
  minimap: { enabled: false },
  padding: { top: 20 },
  renderLineHighlight: 'none',
  scrollBeyondLastLine: false,
  'semanticHighlighting.enabled': false,
  tabSize: 2,
  wordWrap: 'on',
} satisfies Monaco.editor.IStandaloneEditorConstructionOptions
