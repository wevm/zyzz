/** Loads Monaco and the docs highlighter behind an editor-only suspense boundary. @module */
import Editor from '@monaco-editor/react'
import type { EditorProps } from '@monaco-editor/react'
import * as EditorConfig from './Editor.js'

/** Renders a source or output editor with the shared docs syntax theme. */
export default function CodeEditor(props: EditorProps) {
  return (
    <Editor
      {...props}
      beforeMount={EditorConfig.beforeMount}
      onMount={EditorConfig.onMount}
      options={{ ...EditorConfig.options, ...props.options }}
    />
  )
}
