/* eslint-disable import/first */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'
import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'

let isOrderingHost = false

vi.mock('../../../../utils', async importOriginal => ({
  ...await importOriginal(),
  getOrderingSubdomains: () => isOrderingHost
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null
}))

vi.mock('../../../../../../index.js', () => ({
  ResetPassword: ({ UIComponent, ...props }) => (
    <UIComponent
      {...props}
      formState={{ loading: false, result: { error: false } }}
      resetPasswordData={{}}
      handleResetPassword={vi.fn()}
      handleChangeInput={vi.fn()}
      isSuccessfulReset={false}
    />
  ),
  useConfig: () => [{ configs: {}, loading: false }],
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { ResetPassword } from '..'

const renderReset = (props = {}, configFile = { project: 'yaak' }) => renderWithProviders(
  <ConfigFileContext.Provider value={[configFile, vi.fn()]}>
    <ResetPassword code='code' random='random' {...props} />
  </ConfigFileContext.Provider>
)

describe('ResetPassword project field', () => {
  beforeEach(() => {
    isOrderingHost = false
  })

  it('does not ask for the project on a custom dashboard domain', () => {
    renderReset({ useProjectDomain: true })

    expect(screen.queryByLabelText('Project')).toBeNull()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
  })

  it('asks for the project on an Ordering dashboard host', () => {
    isOrderingHost = true
    renderReset({ useProjectDomain: true })

    expect(screen.getByLabelText('Project')).toHaveAttribute('id', 'reset-project')
  })

  it('asks for the project when the project domain is not in use', () => {
    renderReset({ useProjectDomain: false })

    expect(screen.getByLabelText('Project')).toBeInTheDocument()
  })

  it('does not ask for the project when the link carries it', () => {
    isOrderingHost = true
    renderReset({ useProjectDomain: true, project: 'yaak' })

    expect(screen.queryByLabelText('Project')).toBeNull()
  })

  it('does not ask for the project when a local project is pinned', () => {
    renderReset({ useProjectDomain: false }, { project: 'demo', local_project_pin: 'demo' })

    expect(screen.queryByLabelText('Project')).toBeNull()
  })
})
