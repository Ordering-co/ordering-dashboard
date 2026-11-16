import React, { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { CodeHost } from './styles'

const LANGUAGES = { html, css }

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#FFFFFF' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'monospace', minHeight: '240px', maxHeight: '480px', overflow: 'auto' },
  '.cm-content': { padding: '8px 0' }
})

// CodeMirror is the editor of a single language. It owns its text while it is open: `value` is only the text it starts with, and
// `onChange` hears every edit.
export const CodeEditor = ({ language, value, onChange, label, invalid, describedBy }) => {
  const host = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const attributes = {
      role: 'textbox',
      'aria-multiline': 'true',
      'aria-label': label || '',
      ...(invalid ? { 'aria-invalid': 'true' } : {}),
      ...(describedBy ? { 'aria-describedby': describedBy } : {})
    }
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value ?? '',
        extensions: [
          basicSetup,
          LANGUAGES[language](),
          theme,
          EditorView.contentAttributes.of(attributes),
          EditorView.updateListener.of(update => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          })
        ]
      })
    })
    return () => view.destroy()
    // The editor is created once per tab; `value` is its starting text and typing never goes back through props.
  }, [language])

  return <CodeHost ref={host} />
}

export default CodeEditor
