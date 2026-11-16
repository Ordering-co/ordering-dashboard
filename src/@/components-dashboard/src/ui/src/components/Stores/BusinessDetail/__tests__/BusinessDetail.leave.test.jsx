/* eslint-disable import/first */
// redesign stores 5.1a (G2-03): changing tab in Store details goes through the editor's leave guard. With unsaved
// work in the open tab it asks first; without, it switches at once. The tabs and their bodies are stand-ins: the Information
// stand-in registers a form in the guard the way the real one does (useLeaveGuard).
import React, { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from 'styled-components'

import { LeaveDialog, LeaveGuardContext, useLeaveGuard, useLeaveGuardHost } from '../../../Shared/Product/LeaveGuard'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (key, fallback) => fallback ?? key],
  useSession: () => [{ user: { level: 0 } }]
}))
vi.mock('../../../../hooks/useBusinessOwnerRestriction', () => ({ useBusinessOwnerRestriction: () => false }))
vi.mock('../../../../utils', () => ({
  addQueryToUrl: vi.fn()
}))
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '?tab=information' })
}))
vi.mock('../../BusinessInfoSettingList', () => ({
  visibleStoreDetailsTabs: () => ['information', 'owner', 'categories', 'location', 'agents', 'images', 'videos', 'seo_options'],
  BusinessInfoSettingList: ({ selectedInfoItem, handleSelectInfoItem }) => (
    <div role='tablist'>
      {['information', 'location'].map(tab => (
        <button key={tab} type='button' aria-pressed={selectedInfoItem === tab} onClick={() => handleSelectInfoItem(tab)}>{tab}</button>
      ))}
    </div>
  )
}))
vi.mock('../../BusinessInformation', () => ({
  BusinessInformation: () => {
    const [dirty, setDirty] = useState(false)
    useLeaveGuard({ dirty, save: async () => ({ ok: true }), discard: () => setDirty(false) })
    return <button type='button' onClick={() => setDirty(true)}>Edit information</button>
  }
}))
vi.mock('../../BusinessLocation', () => ({ BusinessLocation: () => <p>Location body</p> }))
vi.mock('../../BusinessOwners', () => ({ BusinessOwners: () => null }))
vi.mock('../../BusinessTypes', () => ({ BusinessTypes: () => null }))
vi.mock('../../BusinessImages', () => ({ BusinessImages: () => null }))
vi.mock('../../BusinessVideos', () => ({ BusinessVideos: () => null }))
vi.mock('../../SeoOptions', () => ({ SeoOptions: () => null }))

import { BusinessDetail } from '../index'

const Host = ({ children }) => {
  const host = useLeaveGuardHost()
  return (
    <LeaveGuardContext.Provider value={host.context}>
      {children}
      <LeaveDialog {...host.dialog} title='Save your changes?' keepLabel='Keep editing' saveLabel='Save and continue' discardLabel='Discard' closeLabel='Close' />
    </LeaveGuardContext.Provider>
  )
}

const THEME = { colors: { headingColor: '#000000' } }
const draw = () => render(
  <ThemeProvider theme={THEME}>
    <Host><BusinessDetail business={{ id: 7 }} setIsExtendExtraOpen={() => {}} /></Host>
  </ThemeProvider>
)

describe('Store details tabs · leave guard (G2-03)', () => {
  it('without unsaved work another tab opens at once', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'location' }))
    expect(screen.getByText('Location body')).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('with unsaved work it asks; «Keep editing» stays on the tab, «Discard» goes', async () => {
    draw()
    await userEvent.click(screen.getByRole('button', { name: 'Edit information' }))
    await userEvent.click(screen.getByRole('button', { name: 'location' }))
    let dialog = await screen.findByRole('alertdialog')
    expect(screen.queryByText('Location body')).toBeNull()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Edit information' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'location' }))
    dialog = await screen.findByRole('alertdialog')
    await act(async () => { await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' })) })
    await waitFor(() => expect(screen.getByText('Location body')).toBeInTheDocument())
  })
})
