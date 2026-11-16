import React, { useEffect, useState } from 'react'
import { UsersDeleteButton } from '../../../src/@/components-dashboard/src/ui/src/components/Users/UsersDeleteButton'
import { SyntheticCheckPassword } from './confirm-admin-consumers'

const session = [{ auth: true, loading: false, user: { id: 8202, level: 0, email: 'admin@example.test' } }]
const config = [{ configs: { default_country_code: { value: 'US' }, validation_phone_number_lib: { value: 1 } }, loading: false }]
const idle = { loading: false, error: null }

export const AdminCallerFixture = () => {
  const [selected, setSelected] = useState(false)
  const [requests, setRequests] = useState([])
  const [deletions, setDeletions] = useState([])
  globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__ = SyntheticCheckPassword
  globalThis.__OD_CONFIRM_ADMIN_REQUEST__ = request => setRequests(current => [...current, request])
  globalThis.__OD_PHONE_FIXTURE_SESSION__ = session
  globalThis.__OD_PHONE_FIXTURE_CONFIG__ = config
  useEffect(() => () => {
    delete globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__
    delete globalThis.__OD_CONFIRM_ADMIN_REQUEST__
    delete globalThis.__OD_PHONE_FIXTURE_SESSION__
    delete globalThis.__OD_PHONE_FIXTURE_CONFIG__
  }, [])
  return (
    <main style={{ padding: 24 }}>
      <button onClick={() => setSelected(value => !value)}>Toggle selected users</button>
      <UsersDeleteButton
        selectedUsers={selected ? [8203, 8204] : []}
        deleteUsersActionState={idle}
        handleDeleteSeveralUsers={(...args) => setDeletions(current => [...current, { args, arity: args.length, codeType: typeof args[0] }])}
      />
      <output data-testid='caller-requests'>{JSON.stringify(requests)}</output>
      <output data-testid='caller-deletions'>{JSON.stringify(deletions)}</output>
    </main>
  )
}
