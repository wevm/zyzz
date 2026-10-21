/** @module Mixes the music bed and the sound effects into `public/soundtrack.wav` with ffmpeg. */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs'
import * as Path from 'node:path'
import { total } from '../src/Theme.ts'

const root = Path.resolve(import.meta.dirname, '..')
const music = Path.join(root, 'audio/instrumental.wav')
const sfx = Path.join(root, 'public/sfx.wav')
const output = Path.join(root, 'public/soundtrack.wav')
const seconds = (total / 30).toFixed(3)

// The music bed is not committed. `audio/instrumental.wav` starts on the beat that frame 0 lands on (see README).
const args = Fs.existsSync(music)
  ? [
      ['-i', music, '-i', sfx],
      [
        '-filter_complex',
        `[0]atrim=0:${seconds},afade=t=in:d=0.02,afade=t=out:st=${(total / 30 - 2.5).toFixed(3)}:d=2.5,loudnorm=I=-14:TP=-1.5:LRA=8,volume=0.8[m];` +
          `[1]atrim=0:${seconds},highpass=f=150,alimiter=limit=0.85:level=false,volume=1.6[s];` +
          '[m][s]amix=inputs=2:normalize=0,alimiter=limit=0.9:level=false,loudnorm=I=-13:TP=-1:LRA=10',
      ],
    ]
  : [
      ['-i', sfx],
      ['-af', `atrim=0:${seconds},loudnorm=I=-16:TP=-1`],
    ]

if (!Fs.existsSync(music))
  console.warn(
    'audio/instrumental.wav is missing, so the soundtrack has sound effects only.',
  )

ChildProcess.execFileSync(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    ...args.flat(),
    '-ar',
    '48000',
    '-t',
    seconds,
    output,
  ],
  { stdio: 'inherit' },
)
console.log('Mixed public/soundtrack.wav')
