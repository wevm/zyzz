/** Compiles once, then runs the Zyzz CLI watcher beside the Vite dev server. @module */
import * as ChildProcess from 'node:child_process'

const options = {
  shell: process.platform === 'win32',
  stdio: 'inherit',
} as const
const output = ['--out-dir', '.zyzz']

// index.html references the compiled entry, so the first build completes before Vite serves.
const initial = ChildProcess.spawnSync('zyzz', ['build', ...output], options)
if (initial.status !== 0) process.exit(initial.status ?? 1)

const compiler = ChildProcess.spawn('zyzz', ['dev', ...output], options)
const server = ChildProcess.spawn('vite', [], options)

for (const child of [compiler, server])
  child.once('exit', (code) => {
    compiler.kill()
    server.kill()
    process.exitCode ??= code ?? 0
  })
