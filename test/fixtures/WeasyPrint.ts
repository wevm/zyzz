/** Renders real print-engine PDFs and rasterizes their visible output for compiler acceptance. @module */
import * as ChildProcess from 'node:child_process'
import * as Fs from 'node:fs/promises'
import * as Os from 'node:os'
import * as Path from 'node:path'

/** Prints authored HTML with the pinned engine and returns its PDF and RGB pixels. */
export async function render(html: string) {
  const root = await Fs.mkdtemp(Path.join(Os.tmpdir(), 'zyzz-weasyprint-'))
  try {
    const executable = process.env.WEASYPRINT_EXECUTABLE ?? 'weasyprint'
    const version = ChildProcess.execFileSync(executable, ['--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim()
    if (version !== 'WeasyPrint version 70.0')
      throw new Error(`Expected WeasyPrint 70.0; received ${version}.`)

    const path = Path.join(root, 'output.pdf')
    ChildProcess.execFileSync(executable, ['-', path], {
      input: html,
      timeout: 20_000,
    })
    const ppm = ChildProcess.execFileSync(
      'pdftoppm',
      ['-singlefile', '-r', '96', path],
      { maxBuffer: 8 * 1024 * 1024, timeout: 10_000 },
    )
    const header = /^P6\n(\d+) (\d+)\n255\n/.exec(
      ppm.subarray(0, 100).toString(),
    )
    if (!header) throw new Error('Expected an 8-bit RGB PPM image.')

    const height = Number(header[2])
    const pixels = ppm.subarray(header[0].length)
    const width = Number(header[1])
    if (pixels.length !== width * height * 3)
      throw new Error('Unexpected print image dimensions.')

    return { height, pdf: await Fs.readFile(path), pixels, version, width }
  } finally {
    await Fs.rm(root, { recursive: true, force: true })
  }
}
