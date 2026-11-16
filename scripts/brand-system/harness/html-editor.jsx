import React, { useMemo, useState } from 'react'
import { useTheme } from 'styled-components'

import { InsertImage } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/HtmlEditor/InsertImage'
import { InsertLink } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/HtmlEditor/InsertLink'
import { InsertVideo } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/HtmlEditor/InsertVideo'
import { HtmlEditorFixtureBoundary } from './html-editor-language'

const firstImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcng9IjEyIiBmaWxsPSIjMjY2REYwIi8+PC9zdmc+'
const secondImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgcng9IjEyIiBmaWxsPSIjMDBEMTdFIi8+PC9zdmc+'

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='html-editor-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)

const InvokeCase = ({ children, testId }) => {
  const [events, setEvents] = useState([])
  const record = event => setEvents(current => [...current, event])
  const editorContext = useMemo(() => ({ invoke: (...args) => record({ args, kind: 'invoke' }) }), [])
  return (
    <div data-testid={testId} className='html-editor-fixture-cell'>
      {children({
        editorContext,
        handleRestoreEditor: () => record({ kind: 'restore' }),
        onClose: () => record({ kind: 'close' }),
        record
      })}
      <output data-testid={`${testId}-events`}>{JSON.stringify(events)}</output>
    </div>
  )
}

const DialogCases = () => {
  const [selectedImageUrl, setSelectedImageUrl] = useState(firstImage)
  return (
    <Section label='Insertion dialog contracts' testId='html-editor-dialogs'>
      <div className='html-editor-fixture-grid'>
        <InvokeCase testId='insert-link-case'>{props => <InsertLink {...props} />}</InvokeCase>
        <InvokeCase testId='insert-link-button-case'>{props => <InsertLink {...props} isLinkButton />}</InvokeCase>
        <InvokeCase testId='insert-video-case'>{props => <InsertVideo {...props} />}</InvokeCase>
        <InvokeCase testId='insert-image-case'>{props => (
          <InsertImage
            {...props}
            imageListState={{ images: [{ id: 31, source: firstImage }, { id: 32, source: secondImage }], loading: false, error: null }}
            insertImageState={{ loading: false, change: { source: secondImage } }}
            handleInsertImage={file => props.record({ file: { name: file.name, size: file.size, type: file.type }, kind: 'upload' })}
            handleDeleteImage={id => props.record({ id, kind: 'delete' })}
            selectedImageUrl={selectedImageUrl}
            setSelectedImageUrl={value => { setSelectedImageUrl(value); props.record({ kind: 'select-image', value }) }}
          />
        )}</InvokeCase>
      </div>
      <output data-testid='direct-selected-image'>{selectedImageUrl}</output>
    </Section>
  )
}

export const HtmlEditorFixture = () => {
  const theme = useTheme()
  return (
    <HtmlEditorFixtureBoundary>
      <main data-testid='html-editor-fixture' className='html-editor-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}>
        <style>{`
          .html-editor-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
          .html-editor-fixture * { box-sizing: border-box; }
          .html-editor-fixture > h1, .html-editor-fixture-section > h2 { margin: 0; }
          .html-editor-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
          .html-editor-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); min-width: 0; }
          .html-editor-fixture-cell { border: 1px dashed currentColor; min-width: 0; padding: 12px; }
          .html-editor-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
          .html-editor-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
          @media (max-width: 420px) { .html-editor-fixture { gap: 12px; padding: 12px; } .html-editor-fixture-section { padding: 12px; } }
        `}</style>
        <h1>Ordering.co HTML editor insertion dialogs</h1>
        <DialogCases />
      </main>
    </HtmlEditorFixtureBoundary>
  )
}
