/** Collects bounded emulator results and records host and dependency metadata. @module */
import * as ChildProcess from 'node:child_process'
import * as Crypto from 'node:crypto'
import * as Fs from 'node:fs/promises'
import * as Http from 'node:http'
import * as Os from 'node:os'
import * as Path from 'node:path'

const platform = process.argv[2]
if (platform !== 'ios' && platform !== 'android')
  throw new Error('Expected ios or android')
const directory = Path.resolve('bench/results/native', platform)
await Fs.mkdir(directory, { recursive: true })
const metadata = {
  commit: ChildProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  lockfile: Crypto.hash('sha256', await Fs.readFile('pnpm-lock.yaml')),
  node: process.version,
  host: {
    platform: Os.platform(),
    release: Os.release(),
    architecture: Os.arch(),
    cpus: Os.cpus(),
    memory: Os.totalmem(),
  },
  packages: JSON.parse(
    await Fs.readFile('bench/native/app/package.json', 'utf8'),
  ).dependencies,
}
await Fs.writeFile(
  Path.join(directory, 'host.json'),
  JSON.stringify(metadata, null, 2),
)
let failed = false
const server = Http.createServer(async (request, response) => {
  try {
    if (
      request.method !== 'POST' ||
      !['/results', '/error', '/progress'].includes(request.url ?? '')
    ) {
      response.writeHead(404).end()
      return
    }
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (body.length > 10_000_000)
        throw new Error('Result payload exceeds 10 MB')
    }
    if (request.url === '/progress') {
      console.log(body)
      await Fs.appendFile(Path.join(directory, 'progress.txt'), body + '\n')
      idle.refresh()
      response.writeHead(200).end('saved')
      return
    }
    if (request.url === '/error') {
      failed = true
      await Fs.writeFile(Path.join(directory, 'error.txt'), body)
    } else {
      const result = JSON.parse(body)
      if (
        result.environment?.platform !== platform ||
        result.environment?.development !== false ||
        result.schema !== 1 ||
        !Array.isArray(result.samples)
      )
        throw new Error('Invalid native release result')
      await Fs.writeFile(
        Path.join(directory, 'render.json'),
        JSON.stringify(result, null, 2),
      )
    }
    response.writeHead(200).end('saved')
    clearTimeout(idle)
    clearTimeout(timeout)
    server.close(() => {
      process.exitCode = failed ? 1 : 0
    })
  } catch (error) {
    failed = true
    await Fs.writeFile(Path.join(directory, 'error.txt'), String(error))
    response.writeHead(400).end(String(error))
    clearTimeout(idle)
    clearTimeout(timeout)
    server.close(() => {
      process.exitCode = 1
    })
  }
})
const idle = setTimeout(() => {
  console.error('Native app sent no progress for two minutes')
  clearTimeout(timeout)
  server.close()
  process.exitCode = 1
}, 120_000)
const timeout = setTimeout(() => {
  clearTimeout(idle)
  console.error('Native benchmark collector timed out')
  server.close()
  process.exitCode = 1
}, 20 * 60_000)
server.listen(8765, '127.0.0.1', () =>
  console.log('Native collector ready on 8765'),
)
