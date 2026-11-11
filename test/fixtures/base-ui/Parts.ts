/**
 * Installs a plain-JavaScript component package whose parts declare their states, and a
 * design-system consumer that styles them from another package.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

/** Package files in the shape TypeScript emits, without Zyzz contracts. */
export const files = {
  'dist/index.js': `export * as Tool from './Tool.js';
`,
  'dist/Tool.js': `import { createElement } from 'react';
import { part } from 'zyzz/base-ui/react';
export const Root = part(function Root(props) {
  return createElement('div', {
    className: props.className,
    'data-open': props.open ? '' : undefined,
    'data-status': props.status,
    'data-testid': props.testId,
  }, props.status);
}, { open: 'boolean', status: ['running', 'done', 'failed'] });
`,
  'package.json': JSON.stringify({
    exports: { '.': './dist/index.js' },
    name: '@nanocode/ui',
    peerDependencies: { react: '*', zyzz: '*' },
    type: 'module',
  }),
} as const

/** Consumer sources: a configured design system and a page that mounts its parts. */
export const sources = {
  'design.ts': `import { Tool } from '@nanocode/ui'
import { defineVars } from 'zyzz'
import { defineConfig } from 'zyzz/base-ui/react'

const tokens = defineVars({
  color: { accent: 'rgb(255, 0, 0)', agent: 'rgb(0, 0, 255)', rule: 'rgb(128, 128, 128)', text: 'rgb(0, 128, 0)' },
}, { id: 'nanocode/tokens' })

export const { style } = defineConfig({ id: 'nanocode', vars: { nanocode: tokens }, defaultVars: 'nanocode' })

export const tool = style(Tool.Root, {
  borderColor: 'rule',
  borderStyle: 'solid',
  states: {
    open: { borderColor: 'text' },
    status: { failed: { color: 'accent' }, running: { color: 'agent' } },
  },
})
`,
  'page.ts': `import { Tool } from '@nanocode/ui'
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { tool } from './design.js'

export function mount(element) {
  flushSync(() => {
    createRoot(element).render([
      createElement(Tool.Root, { ...tool(), key: 'a', open: true, status: 'running', testId: 'running' }),
      createElement(Tool.Root, { ...tool(), key: 'b', open: false, status: 'failed', testId: 'failed' }),
      createElement(Tool.Root, { ...tool(), key: 'c', open: false, status: 'done', testId: 'done' }),
    ])
  })
}
`,
} as const

/** Writes the package under `node_modules/@nanocode/ui` and returns its directory. */
export async function install(root: string) {
  const directory = Path.join(root, 'node_modules/@nanocode/ui')

  for (const [name, source] of Object.entries(files)) {
    await Fs.mkdir(Path.dirname(Path.join(directory, name)), {
      recursive: true,
    })
    await Fs.writeFile(Path.join(directory, name), source)
  }

  return directory
}
