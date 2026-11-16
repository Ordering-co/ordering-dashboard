/* eslint-disable import/first */
// The QueryLogin half of the former AuthForms.test.jsx. Its Login, Forgot and Reset
// halves went with the legacy Shared/UI forms on 2026-10-03, after the merge of `main`:
// production renders `Login/*` (AuthLayout) and no longer imports them. QueryLogin is
// still live (`Login/QueryLogin` re-exports it), so its two cases stay.
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfigFileContext } from '../../../contexts/ConfigFileContext'

const runtime = vi.hoisted(() => ({ calls: {} }))

vi.mock('../../../../../index', () => ({
  QueryLogin: props => { runtime.calls.query = props; return <div data-testid='query-controller' /> },
  useApi: () => [{ project: 'tenant' }, { configurations: {} }],
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [{}, (key, fallback) => fallback || key]
}))

vi.mock('../../Shared', () => ({
  Alert: () => null,
  InputPhoneNumber: () => null,
  SpinnerLoader: () => <div role='status'>Loading</div>
}))

import { QueryLogin, QueryLoginUI } from './QueryLogin'

describe('L2e-E2 QueryLogin owner wiring', () => {
  it('preserves Query controller wiring', () => {
    render(<QueryLogin marker='query' />)
    expect(runtime.calls.query).toMatchObject({ marker: 'query', UIComponent: QueryLoginUI })
  })

  // Owner decision 29 A (2026-10-21): the login by URL lets in the same levels as the login form, level 8 included.
  it('lets in levels 0, 2, 5 and 8, as the login form does (owner decision 29)', () => {
    render(<QueryLogin />)
    expect(runtime.calls.query.allowedLevels).toEqual([0, 2, 5, 8])
  })

  it('preserves QueryLogin ConfigFile merge and loading UI', async () => {
    const setConfigFile = vi.fn()
    render(
      <ConfigFileContext.Provider value={[{ api: 'kept' }, setConfigFile]}>
        <QueryLoginUI project='next-project' />
      </ConfigFileContext.Provider>
    )
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    await waitFor(() => expect(setConfigFile).toHaveBeenCalledWith({ api: 'kept', project: 'next-project' }))
  })
})
