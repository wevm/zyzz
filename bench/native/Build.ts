/** Builds host orchestration tools without executing benchmark workloads. @module */
import * as Esbuild from 'esbuild'
await Esbuild.build({
  entryPoints: [
    'bench/native/Prepare.ts',
    'bench/native/CompileReport.ts',
    'bench/native/Collect.ts',
    'bench/native/Run.ts',
    'bench/native/Report.ts',
  ],
  outdir: 'bench/results/native/tools',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  outExtension: { '.js': '.mjs' },
})
