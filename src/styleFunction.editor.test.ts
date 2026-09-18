/** Verifies editor completions and diagnostic spans through the public authoring API. @module */
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { expect, test } from 'vite-plus/test'

test('suggests CSS properties and reports invalid declarations on their keys', () => {
  const root = Path.resolve(import.meta.dirname, '..')
  const file = Path.join(root, '.fixture-editor.ts')
  let source = `import { style } from 'zyzz'
const pane = style({
  /* properties */
  alignItems: 'center',
  backgroundColor: 'light-dark(#fff, #171717)',
  border: '1px solid light-dark(#e5e5e5, #303030)',
  display: 'flex',
  selectors: { '&:hover': {

    opacity: 0.5
  } },
})
const dynamic = style((values: { width: \`\${number}px\` }) => ({
  display: 'flex',
  width: values.width,
}))
dynamic({ width: '12px' })
`
  let version = 0
  const snapshots = new Map<string, Ts.IScriptSnapshot>()
  const options: Ts.CompilerOptions = {
    module: Ts.ModuleKind.ESNext,
    moduleResolution: Ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    paths: { zyzz: [Path.join(root, 'src/index.ts')] },
    skipLibCheck: true,
    strict: true,
    target: Ts.ScriptTarget.ESNext,
    types: [],
  }
  const service = Ts.createLanguageService({
    fileExists: (path) => path === file || Ts.sys.fileExists(path),
    getCompilationSettings: () => options,
    getCurrentDirectory: () => root,
    getDefaultLibFileName: Ts.getDefaultLibFilePath,
    getProjectVersion: () => String(version),
    getScriptFileNames: () => [file],
    getScriptSnapshot: (path) => {
      if (path === file) return Ts.ScriptSnapshot.fromString(source)

      const cached = snapshots.get(path)
      if (cached) return cached

      const text = Ts.sys.readFile(path)
      if (text === undefined) return undefined

      const snapshot = Ts.ScriptSnapshot.fromString(text)
      snapshots.set(path, snapshot)
      return snapshot
    },
    getScriptVersion: (path) => (path === file ? String(version) : '0'),
    readDirectory: Ts.sys.readDirectory,
    readFile: (path) => (path === file ? source : Ts.sys.readFile(path)),
  })

  try {
    expect(service.getSemanticDiagnostics(file)).toEqual([])

    const completions = service.getCompletionsAtPosition(
      file,
      source.indexOf('/* properties */'),
      {},
    )
    expect(completions?.entries.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(['color', 'fontSize', 'padding']),
    )

    for (const value of ['', 'ce']) {
      const previous = source
      source = source.replace("alignItems: 'center'", `alignItems: '${value}'`)
      version++

      const position =
        source.indexOf(`alignItems: '${value}'`) +
        "alignItems: '".length +
        value.length
      const suggestions = service.getCompletionsAtPosition(file, position, {})
      expect(suggestions?.entries.map((entry) => entry.name)).toEqual(
        expect.arrayContaining(['center', 'stretch', 'flex-start']),
      )

      source = previous
      version++
    }

    for (const [before, after, key] of [
      ["display: 'flex'", "display: 'invalid-display'", 'display'],
      ['opacity: 0.5', "opacity: 'invalid-opacity'", 'opacity'],
      ["alignItems: 'center'", "unknownProperty: 'center'", 'unknownProperty'],
    ] as const) {
      const previous = source
      source = source.replace(before, after)
      version++

      const diagnostics = service.getSemanticDiagnostics(file)
      expect(diagnostics, key).toHaveLength(1)
      expect(
        source.slice(
          diagnostics[0]!.start!,
          diagnostics[0]!.start! + diagnostics[0]!.length!,
        ),
      ).toBe(key)

      source = previous
      version++
    }
  } finally {
    service.dispose()
  }
})
