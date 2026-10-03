/** Checks the published React Native package condition with the real compiler. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import * as Util from 'node:util'
import { expect, test } from 'vite-plus/test'

test('resolves native root helpers and their inferred types from published declarations', async () => {
  const directory = await Fs.mkdtemp(Path.resolve('.fixture-native-exports-'))
  try {
    const file = Path.join(directory, 'consumer.ts')
    await Fs.writeFile(
      file,
      `import {defineConfig,Host,StyleSheet,useStyles,useVars} from 'zyzz/react-native';
const {Provider,vars}=defineConfig({defaultVars:'base',vars:{base:{spacing:{gap:'4px'}},alternate:{spacing:{gap:'8px'}}}});
const gap:number=useVars(vars).spacing.gap;
Provider({colorScheme:'light',vars:'alternate'});
// @ts-expect-error The native condition retains the configuration's names.
Provider({colorScheme:'light',vars:'missing'});
// @ts-expect-error Native lengths remain numbers.
const invalid:string=useVars(vars).spacing.gap;
void [gap,invalid,Host,StyleSheet,useStyles];`,
    )
    const result = await Util.promisify(ChildProcess.execFile)(
      process.execPath,
      [
        Path.resolve('node_modules/typescript/bin/tsc'),
        '--ignoreConfig',
        '--noEmit',
        '--module',
        'nodenext',
        '--target',
        'esnext',
        '--strict',
        '--skipLibCheck',
        '--customConditions',
        'react-native',
        file,
      ],
      { timeout: 30000 },
    )
    expect(result.stdout).toBe('')
  } finally {
    await Fs.rm(directory, { recursive: true, force: true })
  }
}, 35000)
