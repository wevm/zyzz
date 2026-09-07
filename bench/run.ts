import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs'
import * as Os from 'node:os'

Fs.mkdirSync('bench/results', { recursive: true })
const args = [
  'exec',
  'vp',
  'test',
  'bench',
  '--run',
  '--outputJson',
  'bench/results/define.json',
]
if (Fs.existsSync('bench/results/main/define.json'))
  args.push('--compare', 'bench/results/main/define.json')
const result = ChildProcess.spawnSync('pnpm', args, { stdio: 'inherit' })
Fs.writeFileSync(
  'bench/results/metadata.json',
  JSON.stringify(
    {
      arch: process.arch,
      command: ['pnpm', ...args],
      commit:
        process.env.GITHUB_SHA ??
        ChildProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim(),
      cpu: Os.cpus()[0]?.model,
      lockfileSha256: Crypto.createHash('sha256')
        .update(Fs.readFileSync('pnpm-lock.yaml'))
        .digest('hex'),
      logicalCpus: Os.cpus().length,
      memoryBytes: Os.totalmem(),
      platform: process.platform,
      recordedAt: new Date().toISOString(),
      runtime: process.version,
    },
    null,
    2,
  ),
)
if (result.error) throw result.error
process.exitCode = result.status ?? 1
