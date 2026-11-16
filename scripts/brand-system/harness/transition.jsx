import React, { useState } from 'react'
import styled from 'styled-components'
import { Button, Select } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/UI'
import { RecipientSelect } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/RecipientSelect'
import { SchoolModuleToggle } from '../../../src/@/components-dashboard/src/ui/src/components/Schools/SchoolModuleToggle'
import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
import { Button as LegacyButton } from '../../../src/@/components-dashboard/src/ui/src/styles/Buttons'
import { Input as LegacyInput } from '../../../src/@/components-dashboard/src/ui/src/styles/Inputs'
import { DangerOutlineButton } from '../../../src/@/components-dashboard/src/ui/src/components/MyProducts/OrderingWebsite/styles'
import { CommentButton } from '../../../src/@/components-dashboard/src/ui/src/components/Orders/ReviewCustomer/styles'
import { useTheme } from '../../../src/@/components-dashboard/src/ui/src/contexts/ThemeContext'
import { createOrderingTheme } from '../../../src/brand/adapter'
import { mergeThemePrimary } from '../../../src/utils/bootTheme'
// SchoolModuleToggle is on Product pieces since (Button, ConfirmDialog), which read the --od-x-*
// candidates the app loads from src/index.js; without them the fixture paints a UI the app never shows (a 16px Close).
// main.jsx imports this module for every surface, so the candidates load only on this one (as the lazy fixtures do).
if (new URLSearchParams(window.location.search).get('surface') === 'transition') await import('../../../src/brand/candidates.css')

const options = [
  { value: 'alpha', content: 'Alpha' },
  { value: 'beta', content: 'Beta' },
  { value: null, content: 'Null option' },
  { value: 'disabled', content: 'Disabled option', disabled: true },
  ...Array.from({ length: 12 }, (_, index) => ({ value: `long-${index}`, content: `Long option ${index + 1} — A deliberately long translated description that stays readable and scrollable on narrow screens` }))
]
// the legacy styled(Button) extension of the deleted Connect/ImportersPanel, kept as a local fixture
const LogsDeleteButton = styled(LegacyButton)`
  min-height: 36px;
  padding: 0 14px;
  flex-shrink: 0;
`
const ExtendedButton = styled(Button).attrs({ title: 'From fixture attrs' })`letter-spacing: 1px;`
const SelectorContainer = styled.div`${Button} { text-decoration: underline; }`
const cell = { minWidth: 0, padding: 16, border: '1px solid currentColor', borderRadius: 4 }

export const TransitionFixture = () => {
  const [theme, { update, merge }] = useTheme()
  const [recipient, setRecipient] = useState('business')
  const [recipientEvents, setRecipientEvents] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const [permission, setPermission] = useState(true)
  const [saving, setSaving] = useState(false)
  const [schoolEvents, setSchoolEvents] = useState({ disable: 0, enable: 0 })
  const [defaultValue, setDefaultValue] = useState('alpha')
  const [noSelected, setNoSelected] = useState(false)
  const [notAsync, setNotAsync] = useState(false)
  const [selectEvents, setSelectEvents] = useState([])
  const [submitEvents, setSubmitEvents] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const mode = theme.ordering.mode

  return (
    <main data-testid='transition-fixture' data-mode={mode} dir={theme.rtl ? 'rtl' : 'ltr'} style={{ boxSizing: 'border-box', maxWidth: 1100, minHeight: '100vh', padding: 24, background: theme.ordering.semantic.background, color: theme.ordering.semantic.text.default, fontFamily: theme.ordering.font.family.sans }}>
      <h1 style={{ fontSize: 24 }}>Piloto de controles de Ordering.co</h1>
      <p>Demostración aislada con los componentes reales de destinatarios y módulo escolar. Los datos son sintéticos; las acciones no modifican cuentas ni servicios.</p>
      <nav aria-label='Fixture variants' style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        <button onClick={() => update({ ...theme, ordering: { ...createOrderingTheme(theme, { mode: mode === 'light' ? 'dark' : 'light' }).ordering, ...(theme.ordering.actionOverride ? { actionOverride: theme.ordering.actionOverride } : {}) } })}>Switch theme fixture</button>
        <button onClick={() => update(mergeThemePrimary(theme, '#123456'))}>Apply tenant fixture</button>
        <button onClick={() => merge({ rtl: !theme.rtl })}>Toggle RTL fixture</button>
        <button onClick={() => update({ ...theme, fonts: { ...theme.fonts, primary: { name: 'Fixture Tenant Sans', family: 'monospace' } } })}>Apply font fixture</button>
      </nav>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
        <section style={cell}>
          <h2 style={{ fontSize: 18 }}>Destinatario</h2>
          <div data-testid='recipient-consumer'><RecipientSelect value={recipient} showInherit onChange={value => { setRecipient(value); setRecipientEvents(count => count + 1) }} /></div>
          <output data-testid='recipient-value'>{String(recipient)}</output>
          <output data-testid='recipient-events'>{recipientEvents}</output>
          <button onClick={() => setModalOpen(true)}>Open legacy modal fixture</button>
        </section>
        <section style={cell}>
          <h2 style={{ fontSize: 18 }}>Módulo escolar</h2>
          <div data-testid='school-consumer'><SchoolModuleToggle isEnabled={enabled} canToggle={permission} saving={saving} handleDisable={async () => { setSchoolEvents(value => ({ ...value, disable: value.disable + 1 })); setEnabled(false) }} handleEnable={() => { setSchoolEvents(value => ({ ...value, enable: value.enable + 1 })); setEnabled(true) }} /></div>
          <output data-testid='school-events'>{JSON.stringify(schoolEvents)}</output>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button onClick={() => setEnabled(value => !value)}>Toggle enabled fixture</button>
            <button onClick={() => setPermission(value => !value)}>Toggle permission fixture</button>
            <button onClick={() => setSaving(value => !value)}>Toggle saving fixture</button>
          </div>
        </section>
        <section data-testid='select-contract' style={cell}>
          <h2 style={{ fontSize: 18 }}>Selección y textos largos</h2>
          <Select options={options} defaultValue={defaultValue} noSelected={noSelected} notAsync={notAsync} onChange={value => setSelectEvents(events => [...events, value])} />
          <output data-testid='select-events'>{JSON.stringify(selectEvents)}</output>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <button onClick={() => { setNoSelected(value => !value); setDefaultValue('alpha') }}>Toggle noSelected fixture</button>
            <button onClick={() => setNotAsync(value => !value)}>Toggle notAsync fixture</button>
            <button onClick={() => setDefaultValue(value => value === 'alpha' ? 'beta' : 'alpha')}>Change default fixture</button>
          </div>
        </section>
        <section data-testid='button-contract' style={cell}>
          <h2 style={{ fontSize: 18 }}>Formulario y extensión</h2>
          <form onSubmit={event => { event.preventDefault(); setSubmitEvents(value => value + 1) }}>
            <label>Fixture required value<input aria-label='Fixture required value' required style={{ maxWidth: '100%' }} /></label>
            <Button color='primary'>Submit fixture</Button>
          </form>
          <output data-testid='submit-events'>{submitEvents}</output>
          <SelectorContainer><ExtendedButton type='button' data-testid='extended-button'>Extended fixture</ExtendedButton></SelectorContainer>
          <Button as='a' href='#fixture-target' data-testid='polymorphic-button'>Anchor fixture</Button>
          <div id='fixture-target'>Destino de prueba</div>
        </section>
      </div>
      <section data-testid='legacy-sibling' style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18 }}>Controles existentes para comparar</h2>
        <p>Fachadas compartidas reales y campo existente para comprobar compatibilidad.</p>
        <LegacyButton data-testid='legacy-button' color='primary'>Existing action</LegacyButton>
        <LegacyInput data-testid='legacy-input' placeholder='Existing field' />
        <LogsDeleteButton data-testid='legacy-logs'>Delete logs</LogsDeleteButton>
        <DangerOutlineButton data-testid='legacy-danger'>Existing danger action</DangerOutlineButton>
        <CommentButton data-testid='legacy-comment'>Existing comment</CommentButton>
      </section>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title='Existing modal host' width='600px'>
        <div data-testid='modal-recipient'><RecipientSelect value={recipient} showInherit onChange={value => { setRecipient(value); setRecipientEvents(count => count + 1) }} /></div>
        <button onClick={() => setModalOpen(false)}>Close legacy modal fixture</button>
      </Modal>
    </main>
  )
}
