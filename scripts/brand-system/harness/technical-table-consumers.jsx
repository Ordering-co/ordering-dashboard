import React, { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { IntegrationLogs } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/IntegrationLogs'
import { Modal } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Modal'
import { UserDetailsUI } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UserDetails'

const tokens = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, user_id: 501, token: `fixture-only-token-${index + 1}`, app: 'fixture-app', created_at: '2026-01-01', updated_at: '2026-01-02' }))
export const TechnicalTableConsumersFixture = () => {
  const [open, setOpen] = useState(false)
  return (
    <main style={{ padding: 20 }}>
      <h1>Ordering.co technical table consumers</h1>
      <button type='button' onClick={() => setOpen(true)}>Open business logs</button>
      {open && (
        <Modal title='Business integration logs' open onClose={() => setOpen(false)} width='900px'>
          <IntegrationLogs model='Business' modelId={51} pluginId={9} />
        </Modal>
      )}
      <section data-testid='user-token-consumer' id='user_lateral_bar' style={{ maxWidth: 700 }}>
        <MemoryRouter initialEntries={['/?tab=push_tokens']}>
          <UserDetailsUI
            userState={{ loading: false, user: { id: 501, name: 'Fixture user', lastname: 'Only', level: 3, enabled: true, push_tokens: tokens } }}
            setExtraOpen={() => {}}
            handleSuccessUserUpdate={() => {}}
            handleDeleteUser={() => { throw new Error('Delete outside fixture scope') }}
            handleChangeActiveUser={() => { throw new Error('User writes outside fixture scope') }}
          />
        </MemoryRouter>
      </section>
    </main>
  )
}
