import React, { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { HtmlEditor as HtmlEditorController, useLanguage } from '../../../../../index'
import { Modal } from '../Modal'
import { InsertLink } from '../HtmlEditor/InsertLink'
import { InsertVideo } from '../HtmlEditor/InsertVideo'
import { InsertImage } from '../HtmlEditor/InsertImage'
import { Toolbar } from './Toolbar'
import { editorContextOf, keepsHtml, richHtmlExtensions, tidyHtml } from './richHtml'
import { CodeArea, EditorShell, Notice, VisualArea } from './styles'

const attributesOf = ({ label, invalid, describedBy }) => ({
  role: 'textbox',
  'aria-multiline': 'true',
  'aria-label': label || '',
  ...(invalid ? { 'aria-invalid': 'true' } : {}),
  ...(describedBy ? { 'aria-describedby': describedBy } : {})
})

const RichHtmlEditorUI = (props) => {
  const {
    label,
    value,
    onChange,
    invalid,
    describedBy,
    imageListState,
    insertImageState,
    handleInsertImage,
    handleDeleteImage,
    selectedImageUrl,
    setSelectedImageUrl
  } = props

  const [, t] = useLanguage()
  const [start] = useState(() => ({ html: value ?? '', kept: keepsHtml(value ?? '') }))
  const [codeView, setCodeView] = useState(!start.kept)
  const [code, setCode] = useState(start.html)
  const [lost, setLost] = useState(!start.kept)
  const [openModal, setOpenModal] = useState(null)
  const emitted = useRef(start.html)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const editor = useEditor({
    extensions: richHtmlExtensions,
    content: start.kept ? start.html : '',
    editorProps: { attributes: attributesOf({ label, invalid, describedBy }) },
    onUpdate: ({ editor: current }) => {
      const html = tidyHtml(current.getHTML())
      emitted.current = html
      onChangeRef.current(html)
    }
  })

  const editorContext = useMemo(() => editor && editorContextOf(editor), [editor])

  useEffect(() => {
    const next = value ?? ''
    if (!editor || next === emitted.current) return
    emitted.current = next
    const kept = keepsHtml(next)
    setCode(next)
    setLost(!kept)
    setCodeView(!kept)
    if (kept) editor.commands.setContent(next, { emitUpdate: false })
  }, [editor, value])

  const handleToggleCode = () => {
    if (!codeView) {
      setCode(emitted.current)
      setCodeView(true)
      return
    }
    if (!keepsHtml(code)) {
      setLost(true)
      return
    }
    editor.commands.setContent(code, { emitUpdate: false })
    setLost(false)
    setCodeView(false)
  }

  const handleChangeCode = (event) => {
    const next = event.target.value
    setCode(next)
    emitted.current = next
    onChange(next)
  }

  const handleCloseModal = () => setOpenModal(null)

  return (
    <>
      <EditorShell invalid={invalid}>
        <Toolbar editor={editor} t={t} codeView={codeView} onToggleCode={handleToggleCode} onInsert={setOpenModal} />
        {lost && (
          <Notice role='status'>
            {t('HTML_EDITOR_KEPT_AS_HTML', 'This HTML has code the visual editor can’t keep, like layout, styles or scripts. Edit it here: it’s saved as it is.')}
          </Notice>
        )}
        <VisualArea hidden={codeView}>
          <EditorContent editor={editor} />
        </VisualArea>
        {codeView && (
          <CodeArea
            aria-label={label}
            aria-invalid={invalid ? 'true' : undefined}
            aria-describedby={describedBy}
            spellCheck={false}
            value={code}
            onChange={handleChangeCode}
          />
        )}
      </EditorShell>
      {openModal === 'link' && (
        <Modal width='60%' open={openModal === 'link'} onClose={handleCloseModal}>
          <InsertLink editorContext={editorContext} handleRestoreEditor={() => {}} onClose={handleCloseModal} />
        </Modal>
      )}
      {openModal === 'video' && (
        <Modal width='60%' open={openModal === 'video'} onClose={handleCloseModal}>
          <InsertVideo editorContext={editorContext} handleRestoreEditor={() => {}} onClose={handleCloseModal} />
        </Modal>
      )}
      {openModal === 'image' && (
        <Modal width='60%' open={openModal === 'image'} onClose={handleCloseModal}>
          <InsertImage
            imageListState={imageListState}
            editorContext={editorContext}
            handleRestoreEditor={() => {}}
            onClose={handleCloseModal}
            insertImageState={insertImageState}
            handleInsertImage={handleInsertImage}
            handleDeleteImage={handleDeleteImage}
            selectedImageUrl={selectedImageUrl}
            setSelectedImageUrl={setSelectedImageUrl}
          />
        </Modal>
      )}
    </>
  )
}

export const RichHtmlEditor = (props) => {
  const richHtmlEditorProps = {
    ...props,
    UIComponent: RichHtmlEditorUI
  }
  return <HtmlEditorController {...richHtmlEditorProps} />
}

export default RichHtmlEditor
