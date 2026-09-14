#!/usr/bin/env node
/**
 * Exposes standalone compilation and recoverable development watching through Incur.
 * @module
 */
import * as Fs from 'node:fs/promises'
import * as Path from 'node:path'
import { Cli, z } from 'incur'
import * as Host from '../node/Host.js'

const args = z.object({
  src: z.string().optional().describe('Source directory (default: src)'),
})
const options = z.object({
  minify: z.boolean().default(false).describe('Minify emitted CSS'),
  'out-dir': z.string().default('dist').describe('Output directory'),
  'package-id': z
    .string()
    .optional()
    .describe('Stable compiled package identity'),
})
const { version } = JSON.parse(
  await Fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string }

await Cli.create('zyzz', {
  description: 'Extract static CSS without writing source modules.',
  version,
})
  .command('build', {
    args,
    description: 'Compile once and publish the output.',
    options,
    async run(context) {
      let host: Host.Runtime | undefined
      const interrupt = () => {
        process.exitCode = 130
      }
      const terminate = () => {
        process.exitCode = 143
      }
      process.once('SIGINT', interrupt)
      process.once('SIGTERM', terminate)

      try {
        host = await open(context)
        return await host.build()
      } finally {
        try {
          await host?.close()
        } finally {
          process.removeListener('SIGINT', interrupt)
          process.removeListener('SIGTERM', terminate)
        }
      }
    },
  })
  .command('dev', {
    args,
    description: 'Compile immediately and watch for changes.',
    options,
    async *run(context) {
      const events: Host.Event[] = []
      let host: Host.Runtime | undefined
      let notify: (() => void) | undefined
      let stopped = false
      const stop = () => {
        stopped = true
        notify?.()
      }

      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)

      try {
        host = await open(context)
        if (stopped) return

        host.watch({
          onResult(event) {
            events.push(event)
            notify?.()
          },
        })

        while (!stopped) {
          if (!events.length)
            await new Promise<void>((resolve) => {
              notify = resolve
            })
          notify = undefined
          if (stopped) break

          const event = events.shift()!
          if ('error' in event)
            yield {
              message:
                event.error instanceof Error
                  ? event.error.message
                  : String(event.error),
              status: 'error',
            }
          else yield { ...event.result, status: 'built' }
        }
      } finally {
        try {
          await host?.close()
        } finally {
          process.removeListener('SIGINT', stop)
          process.removeListener('SIGTERM', stop)
        }
      }
    },
  })
  .serve()

async function identity(): Promise<string> {
  try {
    const value: unknown = JSON.parse(await Fs.readFile('package.json', 'utf8'))
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      typeof value.name === 'string'
    )
      return value.name

    return 'app'
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    )
      return 'app'

    throw error
  }
}

async function open(context: open.Context) {
  const packageId = context.options['package-id'] ?? (await identity())

  return Host.create({
    compiler: false,
    css: { minify: context.options.minify },
    modules: false,
    outDir: Path.resolve(context.options['out-dir']),
    packageId,
    root: Path.resolve(context.args.src ?? 'src'),
  })
}

declare namespace open {
  type Context = {
    args: z.infer<typeof args>
    options: z.infer<typeof options>
  }
}
