/**
 * Checks the native addons in `binding/` before they ship. `--target <triple>` loads that
 * target's addon in this process and compiles a module with it, so each release build proves its
 * addon runs on a matching host. Without a target, the check requires an addon for every native
 * target in `crates/binding/package.json`, so a publish never ships a partial set and leaves the
 * missing platforms on the WebAssembly fallback.
 * @module
 */
import * as Fs from 'node:fs'
import * as Module from 'node:module'
import * as Path from 'node:path'
import * as Util from 'node:util'

import { parseTriple } from '@napi-rs/cli'

type Binding = {
  readonly call: (operation: string, input: string) => string
  readonly version: () => string
}

const root = Path.resolve(import.meta.dirname, '..')
const config = JSON.parse(
  Fs.readFileSync(Path.join(root, 'crates/binding/package.json'), 'utf8'),
) as {
  readonly napi: {
    readonly binaryName: string
    readonly targets: readonly string[]
  }
}

const { values } = Util.parseArgs({ options: { target: { type: 'string' } } })

/** Resolves the addon path that `napi build --platform` writes for a target. */
function addon(target: string): string {
  return Path.join(
    root,
    'binding',
    `${config.napi.binaryName}.${parseTriple(target).platformArchABI}.node`,
  )
}

if (values.target) {
  const require = Module.createRequire(import.meta.url)
  const binding = require(addon(values.target)) as Binding
  const output = binding.call(
    'transform.compile',
    JSON.stringify({
      moduleId: 'check.ts',
      source: `import { style } from 'zyzz'\nexport const card = style({ color: 'red' })\n`,
    }),
  )

  if (!output.includes('color:'))
    throw new Error(`The ${values.target} addon emitted no CSS:\n${output}`)

  console.log(`Loaded the ${values.target} addon ${binding.version()}.`)
} else {
  const targets = config.napi.targets.filter(
    (target) => !target.startsWith('wasm32-'),
  )
  const missing = targets.filter((target) => !Fs.existsSync(addon(target)))

  if (missing.length > 0)
    throw new Error(
      `Missing native addons in binding/ for ${missing.join(', ')}. Download every build from the Binding workflow before publishing.`,
    )

  console.log(`Found native addons for ${targets.length} targets.`)
}
