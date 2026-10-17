/**
 * Checks the WebAssembly graph compiler contract against the native graph's.
 * @module
 */
import { describe, expectTypeOf, test } from 'vite-plus/test'
import type * as Compiler from 'zyzz/compiler'
import { Graph } from 'zyzz/compiler/wasm'

describe('create', () => {
  test('accepts a compiled module or its bytes', () => {
    Graph.create({ module: new Uint8Array() })
    Graph.create({ module: {} as WebAssembly.Module })

    // @ts-expect-error The host supplies the module it loaded.
    Graph.create({})
  })

  test('returns the native graph output for web options', () => {
    const compiler = Graph.create({ module: new Uint8Array() })
    const output = compiler.compile({
      contracts: { 'library/index.js': '{}' },
      imports: { 'app.ts': { library: 'library/index.js', zyzz: null } },
      modules: { 'app.ts': '' },
    })

    expectTypeOf(output).toEqualTypeOf<Compiler.Graph.compile.ReturnType>()

    compiler.compile({
      modules: {},
      // @ts-expect-error Native graphs compile with the native addon.
      native: { colorScheme: 'light', platform: 'ios' },
    })
    // @ts-expect-error Module source must be text.
    compiler.compile({ modules: { 'app.ts': 1 } })
  })

  test('reports compiler diagnostics on its error', () => {
    expectTypeOf<Graph.CompileError>().toExtend<Graph.compile.ErrorType>()
    expectTypeOf<Graph.CompileError['diagnostics']>().toEqualTypeOf<
      readonly Graph.CompileError.Diagnostic[]
    >()
    expectTypeOf<Compiler.Source.Diagnostic>().toExtend<Graph.CompileError.Diagnostic>()
  })
})
