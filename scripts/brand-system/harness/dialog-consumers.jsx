import React, { useRef, useState } from 'react'

import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
import { Confirm } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI/Confirm'

const LongContent = () => (
  <div data-testid='dialog-long-content'>
    {Array.from({ length: 12 }, (_, index) => (
      <p key={index}>Long fixture paragraph {index + 1}: operational content remains readable and every action remains reachable in a short viewport.</p>
    ))}
  </div>
)

export const DialogConsumersFixture = () => {
  const openerRef = useRef(null)
  const [primaryOpen, setPrimaryOpen] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [hiddenCloseOpen, setHiddenCloseOpen] = useState(false)
  const [topPositionOpen, setTopPositionOpen] = useState(false)
  const [siblingOpen, setSiblingOpen] = useState(false)
  const [tripleOpen, setTripleOpen] = useState([false, false, false])
  const [nestedConfirmOpen, setNestedConfirmOpen] = useState(false)
  const [siblingConfirmOpen, setSiblingConfirmOpen] = useState(false)
  const [reverseConfirmOpen, setReverseConfirmOpen] = useState(false)
  const [reverseDialogOpen, setReverseDialogOpen] = useState(false)
  const [reverseNested, setReverseNested] = useState(false)
  const [events, setEvents] = useState([])
  const record = event => setEvents(current => [...current, event])
  const outputStyle = { display: 'block', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }

  const closePrimary = () => {
    record('primary-close')
    setNestedOpen(false)
    setNestedConfirmOpen(false)
    setSiblingConfirmOpen(false)
    setPrimaryOpen(false)
  }
  const closeNested = () => {
    record('nested-close')
    setNestedOpen(false)
  }

  const reverseDialog = (
    <Modal open={reverseDialogOpen} title='Child dialog above confirmation' width='420px' onClose={() => { record('reverse-dialog-close'); setReverseDialogOpen(false) }}>
      <label>Child dialog value<input autoFocus defaultValue='Preserved child value' /></label>
    </Modal>
  )

  return (
    <main data-testid='dialog-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflow: 'hidden', padding: 24, width: '100%' }}>
      <button ref={openerRef} type='button' onClick={() => setPrimaryOpen(true)}>Open primary dialog</button>
      <button type='button' onClick={() => setRemoveOpen(true)}>Open removable dialog</button>
      <button type='button' onClick={() => setHiddenCloseOpen(true)}>Open hidden-close dialog</button>
      <button type='button' onClick={() => { setTopPositionOpen(true); setSiblingOpen(false) }}>Open top-position dialog</button>
      <button type='button' onClick={() => { setTopPositionOpen(true); setSiblingOpen(true) }}>Open sibling dialog stack</button>

      <button type='button' onClick={() => setTripleOpen([true, true, true])}>Open three sibling dialogs</button>
      <button type='button' onClick={() => { setReverseNested(true); setReverseConfirmOpen(true) }}>Open Confirm for nested child</button>
      <button type='button' onClick={() => { setReverseNested(false); setReverseConfirmOpen(true) }}>Open Confirm for sibling child</button>
      <button type='button' onClick={() => { setPrimaryOpen(true); setSiblingConfirmOpen(true) }}>Open simultaneous mixed dialogs</button>

      <Modal
        open={primaryOpen}
        isTopPosition
        title='Edit populated record'
        className='fixture-primary-dialog'
        width='640px'
        maxWidth='680px'
        padding='24px'
        overflow='visible'
        acceptText='Keep changes'
        cancelText='Discard changes'
        onAccept={() => record('primary-accept')}
        onCancel={() => record('primary-cancel')}
        onClose={closePrimary}
      >
        <form onSubmit={event => event.preventDefault()}>
          <label htmlFor='fixture-dialog-name'>Record name</label>
          <input id='fixture-dialog-name' name='name' defaultValue='Populated fixture record' autoFocus />
          <button type='button' onClick={() => setNestedOpen(true)}>Open nested dialog</button>
          <button type='button' onClick={() => setNestedConfirmOpen(true)}>Open nested confirmation</button>
          <button type='button' onClick={() => setSiblingConfirmOpen(true)}>Open sibling confirmation</button>
          <LongContent />
        </form>
        <Modal
          open={nestedOpen}
          title='Nested confirmation'
          width='420px'
          maxWidth='460px'
          padding='18px'
          onClose={closeNested}
        >
          <p>Nested dialog content with an independently owned close callback.</p>
          <input aria-label='Nested value' defaultValue='Nested populated value' autoFocus />
        </Modal>
        <Confirm
          open={nestedConfirmOpen}
          title='Approve nested change?'
          content='The parent modal and its populated form must remain mounted.'
          acceptText='Apply nested change'
          cancelText='Keep editing nested'
          width='480px'
          onAccept={() => record('nested-confirm-accept')}
          onCancel={() => record('nested-confirm-cancel')}
          onClose={() => {
            record('nested-confirm-close')
            setNestedConfirmOpen(false)
          }}
        />
      </Modal>

      <Confirm
        open={siblingConfirmOpen}
        title='Approve sibling change?'
        content='This controlled confirmation is a React sibling of the legacy modal.'
        acceptText='Apply sibling change'
        cancelText='Keep editing sibling'
        width='460px'
        onAccept={() => record('sibling-confirm-accept')}
        onCancel={() => record('sibling-confirm-cancel')}
        onClose={() => {
          record('sibling-confirm-close')
          setSiblingConfirmOpen(false)
        }}
      />

      <Modal
        open={removeOpen}
        title='Removable attachment'
        onClose={() => record('remove-on-close-unexpected')}
        onRemove={() => {
          record('remove-on-remove')
          setRemoveOpen(false)
        }}
      >
        <p>Closing the icon must prefer onRemove.</p>
      </Modal>

      <Modal
        open={hiddenCloseOpen}
        hideCloseDefault
        title='Protected progress'
        className='fixture-hidden-close-dialog'
        width='520px'
        maxWidth='540px'
        padding='30px'
        overflow='hidden'
        onClose={() => {
          record('hidden-close')
          setHiddenCloseOpen(false)
        }}
      >
        <p>The default close icon is intentionally hidden.</p>
        <button type='button' onClick={() => setHiddenCloseOpen(false)}>Finish protected progress</button>
      </Modal>

      <Modal
        open={siblingOpen}
        closeOnBackdrop={false}
        title='Sibling protected layer'
        className='fixture-sibling-dialog'
        onClose={() => {
          record('sibling-close')
          setSiblingOpen(false)
        }}
      >
        <p>This sibling ignores backdrop clicks and closes only through its explicit action.</p>
      </Modal>

      <Modal
        open={topPositionOpen}
        isTopPosition
        closeOnBackdrop
        title='Top-position exception'
        className='fixture-top-position-dialog'
        onClose={() => {
          record('top-position-close')
          setTopPositionOpen(false)
        }}
      >
        <p>This layer vetoes backdrop dismissal while another popup is mounted and allows it when it is alone.</p>
      </Modal>

      {tripleOpen.map((open, index) => (
        <Modal
          key={index}
          open={open}
          title={`Sibling layer ${index + 1}`}
          width={`${600 - index * 80}px`}
          onClose={() => {
            record(`layer-${index + 1}-close`)
            setTripleOpen(current => current.map((value, position) => position === index ? false : value))
          }}
        >
          <label>
            Layer {index + 1} value
            <input autoFocus defaultValue={`Preserved value ${index + 1}`} />
          </label>
        </Modal>
      ))}

      <Confirm open={reverseConfirmOpen} title='Parent alert confirmation' onClose={() => { record('reverse-confirm-close'); setReverseConfirmOpen(false) }}>
        <p>Open a later dialog and retain this confirmation until it is dismissed.</p>
        <button type='button' onClick={() => setReverseDialogOpen(true)}>Open dialog above confirmation</button>
        <button type='button'>Next parent action</button>
        {reverseNested && reverseDialog}
      </Confirm>
      {!reverseNested && reverseDialog}

      <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <output data-testid='dialog-events' style={outputStyle}>{JSON.stringify(events)}</output>
        <output data-testid='dialog-state' style={outputStyle}>{JSON.stringify({ primaryOpen, nestedOpen, nestedConfirmOpen, siblingConfirmOpen, removeOpen, hiddenCloseOpen, topPositionOpen, siblingOpen })}</output>
      </div>
    </main>
  )
}
