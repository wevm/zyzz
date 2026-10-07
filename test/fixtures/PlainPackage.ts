/**
 * Installs a package that publishes plain compiled JavaScript authoring without contracts.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/** Package files in the shape TypeScript emits, including a lowered namespace. */
export const files = {
  // Component modules stay runtime code; this definition is not statically compilable.
  'dist/Button.js': `import { style } from './config.js';
export function Button() {
  return styles.button();
}
var styles;
(function (styles) {
  styles.button = style({ color: globalThis.color });
})(styles || (styles = {}));
`,
  'dist/config.js': `import { Config } from 'zyzz';
import { variables } from './vars.js';
export const { style, vars } = Config.create({ id: 'acme', vars: variables });
`,
  'dist/global.js': `import { global } from 'zyzz/web';
global({ body: { color: 'blue' } });
`,
  'dist/index.js': `export { Button } from './Button.js';
export { style, vars } from './config.js';
`,
  'dist/utils.js': `export const add = (a, b) => a + b;
`,
  'dist/vars.js': `import { Vars } from 'zyzz';
export const variables = Vars.define({ color: { ink: '#123456' }, spacing: { '16': '16px' } }, { id: 'acme/variables' });
`,
  'package.json': JSON.stringify({
    exports: {
      '.': './dist/index.js',
      './global': './dist/global.js',
      './utils': './dist/utils.js',
    },
    name: '@acme/tokens',
    peerDependencies: { zyzz: '*' },
    type: 'module',
  }),
} as const

/** Writes the package under `node_modules/@acme/tokens` and returns its directory. */
export async function install(
  root: string,
  overrides: Readonly<Record<string, string>> = {},
) {
  const directory = Path.join(root, 'node_modules/@acme/tokens')

  for (const [name, source] of Object.entries({ ...files, ...overrides })) {
    await Fs.mkdir(Path.dirname(Path.join(directory, name)), {
      recursive: true,
    })
    await Fs.writeFile(Path.join(directory, name), source)
  }

  return directory
}
