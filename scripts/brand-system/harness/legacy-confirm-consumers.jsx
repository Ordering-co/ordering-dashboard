import React, { useRef, useState } from 'react'

import { Alert, Confirm } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'

const nestedErrors = [
  'Primary fixture error with enough text to wrap in a narrow viewport.',
  ['Nested fixture error one.', 42, null, 'Nested fixture error two with a deliberately long explanation for short screens.'],
  { ignored: true },
  'Final fixture error remains visible after the ignored values.'
]

export const LegacyConfirmConsumersFixture = () => {
  const parentOpenerRef = useRef(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [protectedOpen, setProtectedOpen] = useState(false)
  const [parentOpen, setParentOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [richTitle, setRichTitle] = useState(false)
  const [labelOnlyOpen, setLabelOnlyOpen] = useState(false)
  const probeRichTitle = new URLSearchParams(window.location.search).has('probeRichTitle')
  const [events, setEvents] = useState([])
  const record = event => setEvents(current => [...current, event])
  const outputStyle = { display: 'block', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }

  return (
    <main data-testid='legacy-confirm-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflow: 'hidden', padding: 24, width: '100%' }}>
      <button type='button' onClick={() => setConfirmOpen(true)}>Open populated legacy confirmation</button>
      <button type='button' onClick={() => setProtectedOpen(true)}>Open protected legacy confirmation</button>
      <button type='button' onClick={() => setLabelOnlyOpen(true)}>Open labelled legacy alert</button>
      <button ref={parentOpenerRef} type='button' onClick={() => setParentOpen(true)}>Open parent modal for legacy alert</button>

      <Confirm
        open={confirmOpen}
        title={richTitle ? <span>Legacy <em>rich</em> confirmation</span> : 'Legacy populated confirmation'}
        content={nestedErrors}
        width='620px'
        acceptText='Keep legacy change'
        cancelText='Cancel legacy change'
        closeOnBackdrop
        onAccept={() => record('confirm-accept')}
        onCancel={() => record('confirm-cancel')}
        onClose={() => {
          record('confirm-close')
          setConfirmOpen(false)
        }}
      >
        <form onSubmit={event => event.preventDefault()}>
          <label htmlFor='legacy-confirm-value'>Confirmation value</label>
          <input id='legacy-confirm-value' name='value' defaultValue='Preserved legacy value' />
          {probeRichTitle && <button type='button' onClick={() => setRichTitle(true)}>Use rich title</button>}
        </form>
      </Confirm>

      <Confirm
        open={protectedOpen}
        title='Protected legacy confirmation'
        content='Backdrop dismissal is disabled for this confirmation.'
        closeOnBackdrop={false}
        onClose={() => {
          record('protected-close')
          setProtectedOpen(false)
        }}
      />

      <Modal
        open={parentOpen}
        title='Parent modal with legacy alert'
        width='600px'
        onClose={() => {
          record('parent-close')
          setAlertOpen(false)
          setParentOpen(false)
        }}
      >
        <label htmlFor='parent-modal-value'>Parent value</label>
        <input id='parent-modal-value' defaultValue='Parent remains populated' autoFocus />
        <button type='button' onClick={() => setAlertOpen(true)}>Open legacy alert</button>
        <Alert
          open={alertOpen}
          title='Legacy alert above modal'
          content={nestedErrors}
          acceptText='Acknowledge alert'
          onAccept={() => record('alert-accept')}
          onClose={() => {
            record('alert-close')
            setAlertOpen(false)
          }}
        >
          <strong>Parent modal data must remain mounted.</strong>
        </Alert>
      </Modal>

      <Alert open={labelOnlyOpen} aria-label='Description-only alert' content='Description-only fixture message.' onClose={() => setLabelOnlyOpen(false)} />

      <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <output data-testid='legacy-confirm-events' style={outputStyle}>{JSON.stringify(events)}</output>
        <output data-testid='legacy-confirm-state' style={outputStyle}>{JSON.stringify({ confirmOpen, protectedOpen, parentOpen, alertOpen })}</output>
      </div>
    </main>
  )
}
