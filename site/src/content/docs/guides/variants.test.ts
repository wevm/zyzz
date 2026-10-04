/** Checks the Variants guide examples against the public compiler. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'
import { Graph } from 'zyzz/compiler'

describe('variants guide', () => {
  test('compiles every authored example including conditions and payloads', async () => {
    const document = await Fs.readFile(
      new URL('./variants.mdx', import.meta.url),
      'utf8',
    )
    // Twoslash fences span several files and include completion queries, so the docs build checks them instead.
    const examples = Array.from(
      document.matchAll(/```tsx?(?![^\n]*\btwoslash\b)[^\n]*\n([\s\S]*?)```/g),
    )

    expect(examples).toHaveLength(8)

    const root = Path.resolve(import.meta.dirname, '../../../../..')
    const sources = new Map(
      examples.map((example, index) => [
        Path.join(root, `.fixture-variants-guide-${index}.tsx`),
        example[1]!,
      ]),
    )
    const options: Ts.CompilerOptions = {
      exactOptionalPropertyTypes: true,
      jsx: Ts.JsxEmit.ReactJSX,
      module: Ts.ModuleKind.ESNext,
      moduleResolution: Ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      noUncheckedIndexedAccess: true,
      paths: { zyzz: [Path.join(root, 'src/index.ts')] },
      skipLibCheck: true,
      strict: true,
      target: Ts.ScriptTarget.ESNext,
      types: [],
    }
    const host = Ts.createCompilerHost(options)
    const getSourceFile = host.getSourceFile
    host.getSourceFile = (file, languageVersion, onError, shouldCreate) => {
      const source = sources.get(file)
      if (source !== undefined)
        return Ts.createSourceFile(file, source, languageVersion, true)

      return getSourceFile(file, languageVersion, onError, shouldCreate)
    }
    const program = Ts.createProgram([...sources.keys()], options, host)

    for (const file of sources.keys()) {
      const diagnostics = [
        ...program.getSyntacticDiagnostics(program.getSourceFile(file)),
        ...program.getSemanticDiagnostics(program.getSourceFile(file)),
      ].map((entry) => Ts.flattenDiagnosticMessageText(entry.messageText, '\n'))

      expect(diagnostics, file).toEqual([])
    }

    for (const [index, example] of examples.entries()) {
      const moduleId = `Example${index}.tsx`
      const result = Graph.compile({ modules: { [moduleId]: example[1]! } })

      expect(result.modules[moduleId]?.css).toBeTruthy()
      expect(result.modules[moduleId]?.code).not.toContain('= variants(')
    }
  }, 60000)
})
