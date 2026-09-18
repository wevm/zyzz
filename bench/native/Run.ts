/** Runs a prepared release app against the local collector with bounded cleanup. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'

const platform = process.argv[2]
const device = process.argv[3]
if ((platform !== 'ios' && platform !== 'android') || !device)
  throw new Error('Usage: node bench/native/Run.ts ios|android DEVICE_ID')
const directory = Path.resolve('bench/results/native', platform)
await Fs.mkdir(directory, { recursive: true })
await Fs.writeFile(
  Path.join(directory, 'device.txt'),
  platform === 'ios'
    ? ChildProcess.execFileSync(
        'xcrun',
        ['simctl', 'list', 'devices', '--json'],
        { encoding: 'utf8' },
      )
    : ChildProcess.execFileSync('adb', ['-s', device, 'shell', 'getprop'], {
        encoding: 'utf8',
      }),
)
await Fs.writeFile(Path.join(directory, 'device-id.txt'), device + '\n')
const collector = ChildProcess.spawn(
  process.execPath,
  ['bench/results/native/tools/Collect.mjs', platform],
  { stdio: ['ignore', 'pipe', 'inherit'] },
)
const complete = new Promise<void>((resolve, reject) => {
  collector.once('error', reject)
  collector.once('exit', (code) =>
    code === 0 ? resolve() : reject(new Error(`Collector exited ${code}`)),
  )
})
// Attach rejection handling before waiting for readiness or launching the app.
void complete.catch(() => {})
const log = await Fs.open(Path.join(directory, 'app.log'), 'w')
let appConsole: ChildProcess.ChildProcess | undefined
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Collector readiness timeout')),
      15000,
    )
    collector.once('exit', () => {
      clearTimeout(timeout)
      reject(new Error('Collector exited before launch'))
    })
    collector.stdout?.on('data', (data) => {
      process.stdout.write(data)
      if (String(data).includes('ready on 8765')) {
        clearTimeout(timeout)
        resolve()
      }
    })
  })
  if (platform === 'ios') {
    appConsole = ChildProcess.spawn(
      'xcrun',
      ['simctl', 'launch', '--console', device, 'dev.zyzz.nativebench'],
      { stdio: ['ignore', log.fd, log.fd] },
    )
  } else {
    appConsole = ChildProcess.spawn(
      'adb',
      [
        '-s',
        device,
        'logcat',
        '-v',
        'threadtime',
        'ReactNativeJS:V',
        'AndroidRuntime:E',
        '*:S',
      ],
      { stdio: ['ignore', log.fd, log.fd] },
    )
    ChildProcess.execFileSync(
      'adb',
      [
        '-s',
        device,
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        'dev.zyzz.nativebench/.MainActivity',
      ],
      { stdio: 'inherit' },
    )
  }
  await Promise.race([
    complete,
    new Promise<never>((_, reject) => {
      appConsole!.once('error', reject)
      appConsole!.once('exit', (code) =>
        reject(new Error(`App console exited ${code}; see app.log`)),
      )
    }),
  ])
  ChildProcess.execFileSync(
    process.execPath,
    ['bench/results/native/tools/Report.mjs', platform],
    { stdio: 'inherit' },
  )
} catch (error) {
  console.error(await Fs.readFile(Path.join(directory, 'app.log'), 'utf8'))
  throw error
} finally {
  appConsole?.kill('SIGTERM')
  await log.close()
  if (collector.exitCode === null) collector.kill('SIGTERM')
}
