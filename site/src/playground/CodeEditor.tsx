/** Loads Monaco and the docs highlighter behind an editor-only suspense boundary. @module */
import Editor from '@monaco-editor/react'
import type { EditorProps } from '@monaco-editor/react'
import { useEffect, useRef, useState } from 'react'
import { style } from '../zyzz.config.js'
import * as EditorConfig from './Editor.js'

/** Renders a source or output editor with the shared docs syntax theme. */
export default function CodeEditor(props: EditorProps) {
  const [painted, setPainted] = useState(false)
  const frame = useRef(0)

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <div {...styles.container()}>
      <div
        aria-hidden={!painted || undefined}
        inert={!painted}
        data-painted={painted || undefined}
        {...styles.editor()}
      >
        <Editor
          {...props}
          beforeMount={EditorConfig.beforeMount}
          loading={null}
          onMount={(editor) => {
            EditorConfig.onMount(editor)
            // The React wrapper reveals its previously display:none host before onMount.
            // Keep the fallback until Monaco has rendered at the host's actual dimensions.
            frame.current = requestAnimationFrame(() => {
              editor.layout()
              editor.render(true)
              frame.current = requestAnimationFrame(() => setPainted(true))
            })
          }}
          options={{ ...EditorConfig.options, ...props.options }}
        />
      </div>
      {!painted && <div {...styles.fallback()}>{props.loading}</div>}
    </div>
  )
}

namespace styles {
  export const container = style({
    height: '100% !custom',
    position: 'relative',
    width: '100% !custom',
  })

  export const editor = style({
    height: '100% !custom',
    visibility: 'hidden',
    '&[data-painted]': { visibility: 'visible' },
  })

  export const fallback = style({ inset: 0, position: 'absolute' })
}
