/** Checks declaration emit of configured Base UI helpers and declared parts from the packed package. @module */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Ts from 'typescript-api'
import { describe, expect, test } from 'vite-plus/test'

const project = Path.resolve(import.meta.dirname, '../../..')

describe('defineConfig', () => {
  test('emits nameable declarations for configured helpers and declared parts', async () => {
    const root = await Fs.mkdtemp(
      Path.join(project, '.fixture-base-ui-declarations-'),
    )

    try {
      // A copied package keeps its files inside node_modules, as an installed dependency does.
      const installed = Path.join(root, 'node_modules/zyzz')
      await Fs.mkdir(installed, { recursive: true })
      await Fs.copyFile(
        Path.join(project, 'package.json'),
        Path.join(installed, 'package.json'),
      )
      await Fs.cp(Path.join(project, 'dist'), Path.join(installed, 'dist'), {
        recursive: true,
      })
      await Fs.writeFile(
        Path.join(root, 'package.json'),
        '{"name":"design","type":"module"}',
      )
      await Fs.writeFile(
        Path.join(root, 'Tool.tsx'),
        `import { part } from 'zyzz/base-ui/react'

function ToolRoot(props: ToolRoot.Props) {
  return <div className={props.className} data-open={props.open ? '' : undefined} data-status={props.status} />
}

declare namespace ToolRoot {
  type Props = { className?: string | undefined; open: boolean; status: 'running' | 'done' | 'failed' }
}

export const Root = part(ToolRoot, { open: 'boolean', status: ['running', 'done', 'failed'] })
`,
      )
      await Fs.writeFile(
        Path.join(root, 'config.ts'),
        `import { Vars } from 'zyzz'
import { defineConfig } from 'zyzz/base-ui/react'
import * as Tool from './Tool.js'

const tokens = Vars.define({ color: { accent: 'red', rule: 'gray', text: 'black' } }, { id: 'nanocode/tokens' })

export const { style, variants } = defineConfig({ id: 'nanocode', vars: { nanocode: tokens }, defaultVars: 'nanocode' })

export const tool = style(Tool.Root, {
  borderColor: 'rule',
  states: { open: { borderColor: 'text' }, status: { failed: { color: 'accent' } } },
})
`,
      )

      const files = ['Tool.tsx', 'config.ts'].map((file) =>
        Path.join(root, file),
      )
      const emitted: Record<string, string> = {}
      const program = Ts.createProgram(files, {
        declaration: true,
        emitDeclarationOnly: true,
        exactOptionalPropertyTypes: true,
        jsx: Ts.JsxEmit.ReactJSX,
        module: Ts.ModuleKind.NodeNext,
        moduleResolution: Ts.ModuleResolutionKind.NodeNext,
        outDir: Path.join(root, 'out'),
        rootDir: root,
        skipLibCheck: true,
        strict: true,
        target: Ts.ScriptTarget.ESNext,
        types: [],
      })
      const result = program.emit(undefined, (file, text) => {
        emitted[Path.basename(file)] = text
      })

      expect(
        [...Ts.getPreEmitDiagnostics(program), ...result.diagnostics].map(
          (diagnostic) =>
            Ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
      ).toMatchInlineSnapshot(`[]`)
      expect(emitted['Tool.d.ts']).toMatchInlineSnapshot(`
        "import { part } from 'zyzz/base-ui/react';
        declare function ToolRoot(props: ToolRoot.Props): import("react").JSX.Element;
        declare namespace ToolRoot {
            type Props = {
                className?: string | undefined;
                open: boolean;
                status: 'running' | 'done' | 'failed';
            };
        }
        export declare const Root: part.ReturnType<typeof ToolRoot, {
            readonly open: "boolean";
            readonly status: readonly ["running", "done", "failed"];
        }>;
        export {};
        "
      `)
      expect(emitted['config.d.ts']).toMatchInlineSnapshot(`
        "import { Vars } from 'zyzz';
        export declare const style: import("zyzz/base-ui/react").Factory<{
            readonly id: "nanocode";
            readonly vars: {
                readonly nanocode: Vars.Definition<{
                    readonly color: {
                        readonly accent: "red";
                        readonly rule: "gray";
                        readonly text: "black";
                    };
                }>;
            };
            readonly defaultVars: "nanocode";
        }>, variants: import("zyzz").variants.Bound<Pick<{
            readonly color: {
                readonly accent: "red";
                readonly rule: "gray";
                readonly text: "black";
            };
        }, never> & {
            readonly color?: undefined;
            readonly '~vars': {
                readonly values: {
                    readonly color: {
                        readonly accent: "red";
                        readonly rule: "gray";
                        readonly text: "black";
                    };
                };
                readonly mappings: {};
            };
        }, "react", never, {}>;
        export declare const tool: import("zyzz").style.ReturnType<"react">;
        "
      `)
    } finally {
      await Fs.rm(root, { force: true, recursive: true })
    }
  }, 60_000)
})
