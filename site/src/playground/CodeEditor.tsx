/** Loads Monaco and the docs highlighter behind an editor-only suspense boundary. @module */
import Editor from '@monaco-editor/react'
import type { EditorProps } from '@monaco-editor/react'
import type * as Monaco from 'monaco-editor'
import { useEffect, useRef, useState } from 'react'
import { style } from '../zyzz.config.js'
import type * as Compiler from './Compiler.js'
import * as EditorConfig from './Editor.js'

/** Renders a source or output editor with the shared docs syntax theme. */
export default function CodeEditor(props: CodeEditor.Props) {
  const [monaco, setMonaco] = useState<typeof Monaco>()
  const [painted, setPainted] = useState(false)
  const frame = useRef(0)
  const instance = useRef<Monaco.editor.IStandaloneCodeEditor | undefined>(
    undefined,
  )

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  useEffect(() => {
    const diagnostics = props.diagnostics
    if (!monaco || !diagnostics) return

    // Monaco can keep an open hover after its diagnostic has been cleared.
    void instance.current?.getAction('editor.action.hideHover')?.run()

    const update = (model: Monaco.editor.ITextModel) => {
      const markers = diagnostics
        .filter(
          (diagnostic) =>
            model.uri.toString() === `file:///${diagnostic.source}`,
        )
        .map((diagnostic) => {
          const end = model.getPositionAt(diagnostic.end)
          const start = model.getPositionAt(diagnostic.start)

          return {
            endColumn: end.column,
            endLineNumber: end.lineNumber,
            message: diagnostic.message,
            severity: monaco.MarkerSeverity.Error,
            source: 'Zyzz',
            startColumn: start.column,
            startLineNumber: start.lineNumber,
          }
        })
      monaco.editor.setModelMarkers(model, 'zyzz', markers)
    }

    // Inactive file models also need fresh markers when another file is edited.
    monaco.editor.getModels().forEach(update)
    const subscription = monaco.editor.onDidCreateModel(update)

    return () => {
      subscription.dispose()
      for (const model of monaco.editor.getModels())
        monaco.editor.setModelMarkers(model, 'zyzz', [])
    }
  }, [monaco, props.diagnostics])

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
          onMount={(editor, monaco) => {
            EditorConfig.onMount(editor)
            instance.current = editor
            setMonaco(monaco)
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

export declare namespace CodeEditor {
  /** Editor configuration and optional source-compiler diagnostics. */
  type Props = EditorProps & {
    /** Located errors for all source files. Omit for read-only output editors. */
    diagnostics?: readonly Compiler.Diagnostic[]
  }
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
    '& .monaco-hover .marker': { color: 'red.900' },
  })

  export const fallback = style({ inset: 0, position: 'absolute' })
}
