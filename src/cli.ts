#!/usr/bin/env node
import Process from 'node:process'
import * as Build from './Build.js'

const args = Process.argv.slice(2)
if (args.length !== 3 || args[1] !== '--out-dir' || !args[0] || !args[2]) {
  console.error(
    'Usage: typestyle <source-directory> --out-dir <new-output-directory>',
  )
  Process.exitCode = 1
} else {
  try {
    const result = await Build.build({ sourceDir: args[0], outDir: args[2] })
    console.log(
      `typestyle: emitted ${result.files.length} files (${Buffer.byteLength(result.css)} CSS bytes)`,
    )
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    Process.exitCode = 1
  }
}
