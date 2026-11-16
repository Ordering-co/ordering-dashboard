import React, { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { HtmlEditor as HtmlEditorController, useLanguage } from '../../../../../index'
import { Modal } from '../Modal'
import { InsertLink } from '../HtmlEditor/InsertLink'
import { InsertVideo } from '../HtmlEditor/InsertVideo'
import { InsertImage } from '../HtmlEditor/InsertImage'
import { Toolbar } from './Toolbar'
import { editorContextOf, keepsHtml, prepareHtml, richHtmlExtensions, tidyHtml } from './richHtml'
import { Placeholder } from './Placeholder'
import { joinCode, newScopeId, splitCode } from './codeParts'
import { previewDocument } from './preview'
import { CodeArea, CodeHost, CodeTabs, EditorShell, Notice, PreviewFrame, TabHint, VisualArea } from './styles'

// CodeMirror is only needed once someone opens the code view.
const loadCodeEditor = () => import('./CodeEditor')
const CodeEditor = lazy(loadCodeEditor)

const EDITOR_TABS = ['html', 'css']

const attributesOf = ({ label, invalid, describedBy, placeholder }) => ({
  role: 'textbox',
  'aria-multiline': 'true',
  'aria-label': label || '',
  ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
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
    placeholder,
    linkAsButton,
    // Opt in: the code view becomes HTML / CSS tabs plus a Preview. The saved value is still one string: the CSS is joined back as a <style>
    // block that only reaches this content. <script> stays in the HTML tab (the storefront uses innerHTML, so it never runs).
    codeTabs = false,
    video = true,
    imageListState,
    insertImageState,
    handleInsertImage,
    handleDeleteImage,
    selectedImageUrl,
    setSelectedImageUrl
  } = props

  const [, t] = useLanguage()
  const previewLabel = t('HTML_EDITOR_TAB_PREVIEW', 'Preview')
  const tabs = [{ key: 'html', label: 'HTML' }, { key: 'css', label: 'CSS' }, { key: 'preview', label: previewLabel }]
  const tabsId = useId()
  const [start] = useState(() => ({ html: value ?? '', kept: keepsHtml(value ?? '') }))
  // It opens in the visual editor, always. When the HTML has code that editor can't keep, a notice says so and nothing is saved by
  // looking: that code is only dropped once the content is edited there, and «Edit as HTML» shows it whole before that.
  const [codeView, setCodeView] = useState(false)
  const [code, setCode] = useState(start.html)
  const [lost, setLost] = useState(!start.kept)
  const [parts, setParts] = useState(() => splitCode(start.html))
  const [activeTab, setActiveTab] = useState('html')
  // Bumped when the value changes from outside, so the code editors (which own their text) remount with the new one.
  const [resetCount, setResetCount] = useState(0)
  const [openModal, setOpenModal] = useState(null)
  const emitted = useRef(start.html)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const [extensions] = useState(() => (placeholder ? [...richHtmlExtensions, Placeholder.configure({ placeholder })] : richHtmlExtensions))

  const editor = useEditor({
    extensions,
    content: prepareHtml(start.html),
    editorProps: { attributes: attributesOf({ label, invalid, describedBy, placeholder }) },
    onUpdate: ({ editor: current }) => {
      const html = tidyHtml(current.getHTML())
      emitted.current = html
      setLost(false)
      onChangeRef.current(html)
    }
  })

  const editorContext = useMemo(() => editor && editorContextOf(editor), [editor])

  useEffect(() => {
    const next = value ?? ''
    if (!editor || next === emitted.current) return
    emitted.current = next
    setCode(next)
    setParts(splitCode(next))
    setResetCount(count => count + 1)
    setLost(!keepsHtml(next))
    editor.commands.setContent(prepareHtml(next), { emitUpdate: false })
  }, [editor, value])

  const handleToggleCode = () => {
    if (!codeView) {
      setCode(emitted.current)
      setParts(splitCode(emitted.current))
      setLost(!keepsHtml(emitted.current))
      setCodeView(true)
      return
    }
    editor.commands.setContent(prepareHtml(code), { emitUpdate: false })
    setLost(!keepsHtml(code))
    setCodeView(false)
  }

  const handleChangeCode = (event) => {
    const next = event.target.value
    setCode(next)
    setLost(!keepsHtml(next))
    emitted.current = next
    onChange(next)
  }

  const applyParts = (changes) => {
    const next = { ...parts, ...changes }
    // The id is made once, as soon as there is CSS, so it stays the same across keystrokes.
    if (next.css.trim() && !next.scopeId) next.scopeId = newScopeId()
    const joined = joinCode(next)
    setParts(next)
    setCode(joined)
    setLost(!keepsHtml(joined))
    if (joined === emitted.current) return
    emitted.current = joined
    onChange(joined)
  }

  const handleChangePart = (key, text) => applyParts({ [key]: text })

  const handleCloseModal = () => setOpenModal(null)

  return (
    <>
      <EditorShell invalid={invalid}>
        <Toolbar editor={editor} t={t} codeView={codeView} video={video} onToggleCode={handleToggleCode} onCodeIntent={codeTabs ? loadCodeEditor : undefined} onInsert={setOpenModal} />
        {lost && (
          <Notice role='status'>
            {codeView
              ? t('HTML_EDITOR_KEPT_AS_HTML', 'This HTML has code the visual editor can’t keep, like layout, styles or scripts. Edit it here: it’s saved as it is.')
              : t('HTML_EDITOR_VISUAL_DROPS', 'This content has code the visual editor can’t show, like layout, styles or scripts. Editing here removes it. To keep it, use “Edit as HTML”.')}
          </Notice>
        )}
        <VisualArea hidden={codeView}>
          <EditorContent editor={editor} />
        </VisualArea>
        {codeView && codeTabs && (
          <>
            <CodeTabs role='tablist' aria-label={t('HTML_EDITOR_CODE_TABS', 'Code')}>
              {tabs.map(({ key, label: tabLabel }) => (
                <button
                  key={key}
                  type='button'
                  role='tab'
                  id={`${tabsId}-tab-${key}`}
                  aria-selected={activeTab === key}
                  aria-controls={`${tabsId}-panel-${key}`}
                  onClick={() => setActiveTab(key)}
                >
                  {tabLabel}
                </button>
              ))}
            </CodeTabs>
            {tabs.filter(({ key }) => EDITOR_TABS.includes(key)).map(({ key, label: tabLabel }) => (
              <div
                key={key}
                role='tabpanel'
                id={`${tabsId}-panel-${key}`}
                aria-labelledby={`${tabsId}-tab-${key}`}
                hidden={activeTab !== key}
              >
                <Suspense fallback={<CodeHost aria-hidden='true' />}>
                  <CodeEditor
                    key={`${key}-${resetCount}`}
                    language={key}
                    value={parts[key]}
                    label={`${label || ''} (${tabLabel})`.trim()}
                    invalid={invalid}
                    describedBy={describedBy}
                    onChange={(text) => handleChangePart(key, text)}
                  />
                </Suspense>
                {key === 'css' && (
                  <TabHint>{t('HTML_EDITOR_CSS_SCOPED_HELP', 'Your CSS can’t change the rest of the website. Use :scope for the content’s own box.')}</TabHint>
                )}
              </div>
            ))}
            {activeTab === 'preview' && (
              <div role='tabpanel' id={`${tabsId}-panel-preview`} aria-labelledby={`${tabsId}-tab-preview`}>
                {/* Empty sandbox: no scripts, like the storefront. The preview shows the exact string that will be saved. */}
                <PreviewFrame sandbox='' title={`${label || ''} (${previewLabel})`.trim()} srcDoc={previewDocument(code)} />
                <TabHint>{t('HTML_EDITOR_PREVIEW_HELP', 'Your content on its own. The website adds its own fonts and colors. Scripts don’t run.')}</TabHint>
              </div>
            )}
          </>
        )}
        {codeView && !codeTabs && (
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
          <InsertLink editorContext={editorContext} handleRestoreEditor={() => {}} onClose={handleCloseModal} isLinkButton={!!linkAsButton} />
        </Modal>
      )}
      {video && openModal === 'video' && (
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
