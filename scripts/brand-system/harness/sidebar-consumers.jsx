import React, { useRef, useState } from 'react'
import { flushSync } from 'react-dom'

import { Confirm } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Confirm'
import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
import { SideBar } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/SideBar'
// Shared/MoreSidebarLayout was deleted as dead code; its fixture section (more-sidebar-host, 3 controls, 3 state hooks) went with it.
// bugs H the legacy layers read the --od-x-layer-* roles, loaded app-wide by src/index.js; as in the app
import '../../../src/brand/candidates.css'

const PanelContent = ({ label, onOpenConfirm }) => (
  <section aria-label={label} style={{ boxSizing: 'border-box', minWidth: 0, padding: 24, paddingTop: 76 }}>
    <h2>{label}</h2>
    <label>
      Fixture note
      <input defaultValue={`${label} populated value`} />
    </label>
    {onOpenConfirm && <button type='button' onClick={onOpenConfirm}>Open sidebar confirmation</button>}
  </section>
)

export const SidebarConsumersFixture = () => {
  const synchronousClose = new URLSearchParams(window.location.search).get('syncClose') === 'true'
  const [primaryMounted, setPrimaryMounted] = useState(true)
  const [primaryKey, setPrimaryKey] = useState(0)
  const [primaryOpen, setPrimaryOpen] = useState(false)
  const [outsideEnabled, setOutsideEnabled] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [layerOneMounted, setLayerOneMounted] = useState(true)
  const [layerTwoMounted, setLayerTwoMounted] = useState(true)
  const [modalSidebarMounted, setModalSidebarMounted] = useState(true)
  const [layerOneOpen, setLayerOneOpen] = useState(false)
  const [layerTwoOpen, setLayerTwoOpen] = useState(false)
  const [modalLayerOpen, setModalLayerOpen] = useState(false)
  const [modalSidebarOpen, setModalSidebarOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [events, setEvents] = useState([])
  const containerRef = useRef(null)
  const sidebarSettingContainer = useRef(null)
  const modalLayerOpener = useRef(null)

  const record = (kind, id, open) => {
    const element = id ? document.getElementById(id) : null
    setEvents(current => [...current, { kind, id, open, width: element?.style.width || '' }])
  }
  const resetPrimary = (open, closeOutside) => {
    setPrimaryKey(current => current + 1)
    setPrimaryMounted(true)
    setOutsideEnabled(closeOutside)
    setPrimaryOpen(open)
  }
  const closePrimary = () => {
    record('primary-close', 'sidebar-primary', primaryOpen)
    setPrimaryOpen(false)
    setPrimaryMounted(false)
  }

  return (
    <main data-testid='sidebar-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflow: 'hidden', padding: 24, width: '100%' }}>
      <h1>Ordering.co sidebar consumers</h1>
      <section aria-label='Sidebar fixture controls' style={{ maxWidth: 600, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type='button' onClick={() => { setPrimaryMounted(true); setPrimaryOpen(true); setOutsideEnabled(false) }}>Open primary sidebar</button>
        <button type='button' onClick={() => resetPrimary(true, false)}>Mount primary open</button>
        <button type='button' onClick={() => setPrimaryOpen(false)}>Set primary open false</button>
        <button type='button' onClick={() => resetPrimary(false, false)}>Mount primary closed</button>
        <span ref={containerRef} style={{ display: 'contents' }}>
          <button type='button' onClick={() => resetPrimary(true, true)}>Open outside-close sidebar</button>
          <button type='button'>Container ref exclusion</button>
        </span>
        <button type='button' onClick={() => setCustomOpen(true)}>Open custom sidebar</button>
        <button type='button' onClick={() => {
          const sidebar = document.getElementById('sidebar-primary')
          if (sidebar) sidebar.style.width = '620px'
        }}>Write primary width 620</button>
        <button type='button' ref={sidebarSettingContainer}>Setting container exclusion</button>
        <button type='button' data-testid='outside-sidebar'>Outside sidebar target</button>
      </section>

      {primaryMounted && (
        <SideBar
          key={primaryKey}
          open={primaryOpen}
          onClose={closePrimary}
          handleCloseWizard={() => record('primary-wizard-close', 'sidebar-primary', primaryOpen)}
          isCloseOutsideClick={outsideEnabled}
          containerRef={containerRef}
          sidebarSettingContainer={sidebarSettingContainer}
          showExpandIcon
          sidebarId='sidebar-primary'
        >
          <PanelContent label='Primary sidebar content' onOpenConfirm={() => setConfirmOpen(true)} />
        </SideBar>
      )}

      {customOpen && (
        <SideBar
        open={customOpen}
        onClose={() => {
          record('custom-close', 'sidebar-custom', customOpen)
          setCustomOpen(false)
        }}
        defaultSideBarWidth={640}
        moveDistance={36}
        noAnimation
        isBorderShow
        showExpandIcon
        sidebarId='sidebar-custom'
      >
        <PanelContent label='Custom sidebar content' />
      </SideBar>

      )}

      <section aria-label='Layer fixture controls' style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type='button' onClick={() => {
          setLayerOneOpen(true)
          setLayerTwoOpen(true)
        }}>Open two sidebars</button>
        <button type='button' onClick={() => setLayerTwoOpen(true)}>Open upper sidebar first</button>
        <button type='button' onClick={() => setLayerOneOpen(true)}>Open lower sidebar second</button>
        <button type='button' ref={modalLayerOpener} onClick={() => {
          setModalSidebarOpen(true)
          setModalLayerOpen(true)
        }}>Open sidebar and modal</button>
      </section>
      {layerOneMounted && (
        <SideBar
          open={layerOneOpen}
          onClose={() => {
            record('layer-one-close', 'sidebar-layer-one', layerOneOpen)
            setLayerOneOpen(false)
            setLayerOneMounted(false)
          }}
          sidebarId='sidebar-layer-one'
        >
          <PanelContent label='First layered sidebar' />
        </SideBar>
      )}
      {layerTwoMounted && (
        <SideBar
          open={layerTwoOpen}
          onClose={() => {
            record('layer-two-close', 'sidebar-layer-two', layerTwoOpen)
            const close = () => {
              setLayerTwoOpen(false)
              setLayerTwoMounted(false)
            }
            if (synchronousClose) flushSync(close)
            else close()
          }}
          sidebarId='sidebar-layer-two'
        >
          <PanelContent label='Second layered sidebar' />
        </SideBar>
      )}
      {modalSidebarMounted && (
        <SideBar
          open={modalSidebarOpen}
          isCloseOutsideClick
          containerRef={modalLayerOpener}
          onClose={() => {
            record('modal-sidebar-close', 'sidebar-modal-parent', modalSidebarOpen)
            setModalSidebarOpen(false)
            setModalSidebarMounted(false)
          }}
          sidebarId='sidebar-modal-parent'
        >
          <PanelContent label='Sidebar beneath modal' />
        </SideBar>
      )}
      <Modal
        open={modalLayerOpen}
        title='Modal above sidebar'
        onClose={() => {
          record('modal-layer-close', null, modalLayerOpen)
          setModalLayerOpen(false)
        }}
      >
        <PanelContent label='Top modal content' />
      </Modal>

      <Confirm
        open={confirmOpen}
        title='Sidebar confirmation'
        content='The populated sidebar remains mounted below this confirmation.'
        acceptText='Accept sidebar confirmation'
        cancelText='Cancel sidebar confirmation'
        onAccept={() => record('confirm-accept', null, confirmOpen)}
        onCancel={() => record('confirm-cancel', null, confirmOpen)}
        onClose={() => {
          record('confirm-close', null, confirmOpen)
          setConfirmOpen(false)
        }}
      />

      <output data-testid='sidebar-events' style={{ display: 'block', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>{JSON.stringify(events)}</output>
    </main>
  )
}
