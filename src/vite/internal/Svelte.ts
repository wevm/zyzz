/**
 * Locates top-level Svelte script blocks and splices compiled script output back
 * into the component with a composed source map. Only a tag boundary scan runs
 * here; template syntax never reaches the style compiler and no Svelte compiler
 * is involved.
 * @module
 */
import * as Mapping from '@jridgewell/gen-mapping'
import MagicString from 'magic-string'

/**
 * Concatenates the contents of top-level script blocks into one module text.
 * Module and instance blocks share one scope in Svelte, so imports declared in
 * either block resolve for calls in the other. Blocks keep document order.
 * @param source - Complete component source.
 * @returns Block ranges and the compiler input; `blocks` is empty without scripts.
 */
export function extract(source: string): extract.ReturnType {
  const blocks: extract.Block[] = []
  let depth = 0
  let index = 0
  let offset = 0

  while (index < source.length) {
    const open = source.indexOf('<', index)
    if (open === -1) break

    if (source.startsWith('<!--', open)) {
      const close = source.indexOf('-->', open + 4)

      index = close === -1 ? source.length : close + 3
      continue
    }

    const closing = source[open + 1] === '/'
    const nameStart = open + (closing ? 2 : 1)
    const name = /^[A-Za-z][^\s/>]*/.exec(source.slice(nameStart))?.[0]

    if (!name) {
      index = open + 1
      continue
    }

    const end = tagEnd(source, nameStart + name.length)
    if (end === -1) break

    if (closing) {
      depth = Math.max(0, depth - 1)
      index = end
      continue
    }

    // Script and style contents are raw text; a nested script is an ordinary element.
    if (name === 'script' || name === 'style') {
      const close = new RegExp(`</${name}\\s*>`, 'g')

      close.lastIndex = end

      const match = close.exec(source)
      const contentEnd = match ? match.index : source.length

      if (name === 'script' && depth === 0 && contentEnd > end) {
        blocks.push({ end: contentEnd, offset, start: end })
        offset += contentEnd - end + marker.length
      }

      index = match ? match.index + match[0].length : source.length
      continue
    }

    if (source[end - 2] !== '/' && !voids.has(name.toLowerCase())) depth++

    index = end
  }

  return {
    blocks,
    code: blocks
      .map((block) => source.slice(block.start, block.end))
      .join(marker),
  }
}

/** Script block extraction results. */
export declare namespace extract {
  /** One top-level script block, addressed in the component and in the compiler input. */
  type Block = {
    /** Offset after the block content in the component source. */
    readonly end: number
    /** Offset of the block content within the concatenated compiler input. */
    readonly offset: number
    /** Offset of the block content in the component source. */
    readonly start: number
  }

  type ReturnType = {
    /** Top-level script blocks in document order. */
    readonly blocks: readonly Block[]
    /** Concatenated block contents separated by a marker comment. */
    readonly code: string
  }
}

/**
 * Maps an offset in the concatenated compiler input back to the component source.
 * Offsets on block separators resolve to the end of the preceding block.
 */
export function original(document: extract.ReturnType, offset: number): number {
  let result = 0

  for (const block of document.blocks) {
    if (offset < block.offset) break

    result =
      block.start + Math.min(offset - block.offset, block.end - block.start)
  }

  return result
}

/**
 * Replaces script block contents with compiled output and composes the map.
 * Each block keeps its line count: compiler-inserted lines join the block's
 * first line and collapsed multi-line calls are padded with blank lines, so
 * template positions after a block never move. The Svelte plugin folds the
 * combined map of earlier transforms into its own output, and Vite composes
 * that map with the same transforms again; unchanged lines make that second
 * application an identity, leaving only columns on rewritten lines approximate.
 * @param options - Component source, extracted blocks, and compiled output.
 * @returns The rewritten component and a map from it to the component source.
 * @throws {Error} If the compiled output no longer separates the extracted blocks.
 */
export function splice(options: splice.Options): splice.ReturnType {
  const { blocks } = options.document
  const outputs = options.code.split(marker)
  if (outputs.length !== blocks.length)
    throw new Error('Compiled Svelte script blocks do not match the component.')

  const compiledLines = lineStarts(options.code)
  const inputLines = lineStarts(options.document.code)
  const sourceLines = lineStarts(options.source)

  // Lowest original line for each compiled line; rewritten calls stay single-line.
  const origins = new Map<number, number>()
  const mappings = Mapping.allMappings(
    Mapping.fromMap(JSON.stringify(options.map)),
  )

  for (const mapping of mappings) {
    if (mapping.original === undefined) continue

    const line = mapping.generated.line - 1
    const original = mapping.original.line - 1
    const known = origins.get(line)

    if (known === undefined || original < known) origins.set(line, original)
  }

  type Placement = { block: number; column: number; line: number }

  const component = new MagicString(options.source)
  const placements = new Map<number, Placement>()
  const componentStarts: number[] = []
  const laid: string[] = []
  let compiledOffset = 0
  let shift = 0

  for (const [index, block] of blocks.entries()) {
    const output = outputs[index]!
    const inputStart = positionOf(inputLines, block.offset).line - 1
    const inputHeight =
      positionOf(inputLines, block.offset + block.end - block.start).line -
      inputStart
    const outputStart = positionOf(compiledLines, compiledOffset).line - 1
    const placed = [index === 0 ? options.prepend : '']
    let current = 0

    for (const [offset, text] of output.split('\n').entries()) {
      const origin = origins.get(outputStart + offset)
      const target = origin === undefined ? undefined : origin - inputStart

      if (target !== undefined && target > current) {
        while (placed.length <= target) placed.push('')

        current = target
      }

      const existing = placed[current] ?? ''
      const column = existing && text ? existing.length + 1 : existing.length

      placements.set(outputStart + offset, {
        block: index,
        column,
        line: current,
      })

      if (text) placed[current] = existing ? `${existing} ${text}` : text
    }

    while (placed.length < inputHeight) placed.push('')

    const text = placed.join('\n')

    laid.push(text)
    componentStarts.push(block.start + shift)
    component.overwrite(block.start, block.end, text)
    compiledOffset += output.length + marker.length
    shift += text.length - (block.end - block.start)
  }

  const code = component.toString()
  const codeLines = lineStarts(code)
  const map = new Mapping.GenMapping({ file: options.file })
  const blockStarts = componentStarts.map((start) =>
    positionOf(codeLines, start),
  )

  for (const mapping of mappings) {
    const placement = placements.get(mapping.generated.line - 1)
    if (!placement) continue

    const start = blockStarts[placement.block]!
    const generated = {
      column:
        (placement.line === 0 ? start.column : 0) +
        placement.column +
        mapping.generated.column,
      line: start.line + placement.line,
    }
    const offset =
      mapping.original === undefined
        ? -1
        : offsetOf(inputLines, mapping.original)
    const block = blocks.find(
      (block) =>
        offset >= block.offset &&
        offset < block.offset + block.end - block.start,
    )

    if (!block) {
      Mapping.addMapping(map, { generated })
      continue
    }

    const location = {
      generated,
      original: positionOf(sourceLines, block.start + offset - block.offset),
      source: options.file,
    }

    if (mapping.name === undefined) Mapping.addMapping(map, location)
    else Mapping.addMapping(map, { ...location, name: mapping.name })
  }

  const identity = component.generateMap({ hires: true, source: options.file })

  for (const mapping of Mapping.allMappings(
    Mapping.fromMap(JSON.stringify(identity)),
  )) {
    const offset = offsetOf(codeLines, mapping.generated)
    const inside = componentStarts.some(
      (start, index) => offset >= start && offset < start + laid[index]!.length,
    )
    if (inside || mapping.original === undefined) continue

    Mapping.addMapping(map, {
      generated: mapping.generated,
      original: mapping.original,
      source: options.file,
    })
  }

  Mapping.setSourceContent(map, options.file, options.source)

  return { code, map: Mapping.toEncodedMap(map) }
}

/** Component splicing contracts. */
export declare namespace splice {
  type Options = {
    /** Compiled concatenated script text. */
    readonly code: string
    /** Extraction result for `source`. */
    readonly document: extract.ReturnType
    /** Map source name for the component, usually its absolute path. */
    readonly file: string
    /** Map from `code` to the concatenated compiler input. */
    readonly map: Mapping.EncodedSourceMap
    /** Complete statements placed on the first script line, such as stylesheet imports. */
    readonly prepend: string
    /** Complete component source. */
    readonly source: string
  }

  type ReturnType = {
    /** Component source with compiled script blocks. */
    readonly code: string
    /** Map from `code` to the original component. */
    readonly map: Mapping.EncodedSourceMap
  }
}

const marker = '\n/*@zyzz-svelte-block*/\n'

const voids = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

function lineStarts(text: string): readonly number[] {
  const starts = [0]

  for (let index = 0; index < text.length; index++)
    if (text[index] === '\n') starts.push(index + 1)

  return starts
}

function offsetOf(
  starts: readonly number[],
  position: { readonly column: number; readonly line: number },
) {
  return (
    (starts[position.line - 1] ?? starts[starts.length - 1]!) + position.column
  )
}

function positionOf(starts: readonly number[], offset: number) {
  let low = 0
  let high = starts.length - 1

  while (low < high) {
    const middle = (low + high + 1) >> 1

    if (starts[middle]! <= offset) low = middle
    else high = middle - 1
  }

  return { column: offset - starts[low]!, line: low + 1 }
}

/** Returns the offset after the closing `>` of a tag, honoring quoted and braced attributes. */
function tagEnd(source: string, from: number) {
  let braces = 0
  let quote = ''

  for (let index = from; index < source.length; index++) {
    const char = source[index]!

    if (quote) {
      if (char === '\\' && braces) index++
      else if (char === quote) quote = ''
      continue
    }

    if (char === '"' || char === "'" || (char === '`' && braces)) quote = char
    else if (char === '{') braces++
    else if (char === '}') braces = Math.max(0, braces - 1)
    else if (char === '>' && !braces) return index + 1
  }

  return -1
}
