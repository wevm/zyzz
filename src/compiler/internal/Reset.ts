/** Inserts the web reset without disturbing CSS preludes or source mappings. @module */
import * as Mapping from '@jridgewell/gen-mapping'
import * as CssTree from 'css-tree'
import * as ResetCss from './ResetCss.js'

/** Adds the reset to a complete stylesheet and reserves its lowest-priority layer. */
export function inject(css: string, map: Mapping.EncodedSourceMap) {
  const ast = CssTree.parse(css, { positions: true })
  let offset = 0
  if (ast.type === 'StyleSheet') {
    for (const node of ast.children) {
      if (
        node.type !== 'Atrule' ||
        node.block ||
        !['charset', 'import', 'namespace', 'layer'].includes(node.name)
      )
        break
      offset = node.loc!.end.offset
    }
  }

  const before = css.slice(0, offset)
  const insertionLine = before.split('\n').length
  const insertionColumn = before.length - (before.lastIndexOf('\n') + 1)
  const insertion = `\n${ResetCss.css.trim()}\n`
  const addedLines = insertion.split('\n').length - 1
  const output = new Mapping.GenMapping({ file: map.file ?? null })
  Mapping.addMapping(output, { generated: { line: 1, column: 0 } })
  for (const mapping of Mapping.allMappings(
    Mapping.fromMap(JSON.stringify(map)),
  )) {
    const generated = { ...mapping.generated }
    if (
      generated.line > insertionLine ||
      (generated.line === insertionLine && generated.column >= insertionColumn)
    ) {
      if (generated.line === insertionLine) generated.column -= insertionColumn
      generated.line += addedLines
    }
    generated.line++
    if (mapping.source !== undefined && mapping.original !== undefined) {
      const location = {
        generated,
        original: mapping.original,
        source: mapping.source,
      }
      if (mapping.name === undefined) Mapping.addMapping(output, location)
      else Mapping.addMapping(output, { ...location, name: mapping.name })
    } else Mapping.addMapping(output, { generated })
  }
  for (const [index, source] of map.sources.entries())
    if (source !== null)
      Mapping.setSourceContent(
        output,
        source,
        map.sourcesContent?.[index] ?? null,
      )
  Mapping.setSourceContent(output, 'zyzz/reset.css', ResetCss.css)
  for (let line = 0; line < ResetCss.css.trim().split('\n').length; line++)
    Mapping.addMapping(output, {
      generated: { line: insertionLine + 2 + line, column: 0 },
      original: { line: line + 1, column: 0 },
      source: 'zyzz/reset.css',
    })

  return {
    css: `@layer reset;\n${before}${insertion}${css.slice(offset)}`,
    map: Mapping.toEncodedMap(output),
  }
}
