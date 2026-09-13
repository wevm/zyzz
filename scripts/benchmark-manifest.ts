#!/usr/bin/env node
/** Aligns build entrypoints with baseline source while retaining candidate benchmark tooling. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'

const revision = process.env.BASE_SHA
if (!revision) throw new Error('BASE_SHA is required for baseline exports.')

type Manifest = { exports: Record<string, unknown> }
const baseline = JSON.parse(
  ChildProcess.execFileSync('git', ['show', `${revision}:package.json`], {
    encoding: 'utf8',
  }),
) as Manifest
const candidate = JSON.parse(
  Fs.readFileSync('package.json', 'utf8'),
) as Manifest

candidate.exports = baseline.exports
Fs.writeFileSync('package.json', `${JSON.stringify(candidate, null, 2)}\n`)
