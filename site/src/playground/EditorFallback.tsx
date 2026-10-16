/** Renders the default editor before its browser-only language services load. @module */
import { style } from '../zyzz.config.js'

const lines = __PLAYGROUND__.source.split('\n')
const indents = lines.map((line) => line.match(/^ */)![0].length)

/** Matches Monaco's initial gutter, syntax palette, wrapping, and indentation guides. */
export function EditorFallback() {
  return (
    <pre
      aria-label="App.tsx source"
      aria-multiline="true"
      aria-readonly="true"
      role="textbox"
      tabIndex={0}
      {...styles.editor()}
    >
      {__PLAYGROUND__.tokens.map((tokens, index) => {
        const indent = (() => {
          if (lines[index]?.trim()) return indents[index] ?? 0
          let before = index - 1
          while (before >= 0 && !lines[before]?.trim()) before--
          const after = lines.findIndex(
            (line, i) => i > index && Boolean(line.trim()),
          )
          return Math.min(indents[before] ?? 0, indents[after] ?? 0)
        })()

        return (
          <span key={index} {...styles.line()}>
            <span aria-hidden="true" {...styles.number()}>
              {index + 1}
            </span>
            <span
              {...styles.source({
                style: {
                  paddingLeft: `${indent}ch`,
                  textIndent: `-${indent}ch`,
                },
              })}
            >
              {Array.from({ length: Math.floor(indent / 2) }, (_, level) => (
                <span
                  aria-hidden="true"
                  key={level}
                  {...styles.guide({ style: { left: `${level * 2}ch` } })}
                />
              ))}
              {tokens.map((token, i) => (
                <span key={i} style={{ color: token.color }}>
                  {token.content}
                </span>
              ))}
              {'\n'}
            </span>
          </span>
        )
      })}
    </pre>
  )
}

namespace styles {
  export const editor = style({
    backgroundColor: 'background.surface',
    fontFamily: 'mono',
    fontSize: '15px !custom',
    height: '100% !custom',
    lineHeight: '24px !custom',
    margin: 0,
    overflow: 'auto',
    paddingBlock: 5,
    // Monaco reserves 14px for its vertical scrollbar, even before scrolling.
    paddingRight: '14px !custom',
    scrollbarWidth: 'none',
    tabSize: 2,
    width: '100% !custom',
  })

  export const guide = style({
    borderLeft: '1px solid light-dark(#d3d3d3, #404040)',
    height: '100% !custom',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
  })

  export const line = style({
    display: 'grid',
    gridTemplateColumns: 'calc(5ch + 26px) minmax(0, 1fr)',
  })

  export const number = style({
    color: 'light-dark(#737373, #858585) !custom',
    paddingRight: '26px !custom',
    textAlign: 'right',
    userSelect: 'none',
  })

  export const source = style({
    overflowWrap: 'anywhere',
    position: 'relative',
    whiteSpace: 'pre-wrap',
  })
}
