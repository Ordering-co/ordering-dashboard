/* eslint-disable import/first */
// redesign F6d-1 (P4-04): the Filters sheet shows the id of a driver group again (main wrote «34. Name»; Q2-04
// removed it because a bare «34» read like a count). It is a labelled, muted «ID 34», and a group is found by it.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback]
}))

import { ConfigFileContext } from '../../../../contexts/ConfigFileContext'
import { DriversGroupTypeSelector } from '..'

const GROUPS = [{ id: 3, name: 'Night' }, { id: 34, name: 'Shipday Downtown' }]

const renderSelector = (onChange = vi.fn()) => render(
  <ThemeProvider theme={createDashboardTheme(theme)}>
    <ConfigFileContext.Provider value={[{ app_internal_name: 'ordering' }]}>
      <DriversGroupTypeSelector
        driverGroupList={{ loading: false, groups: GROUPS }}
        handleChangeGroup={onChange}
        filterValues={[]}
        title='Any'
      />
    </ConfigFileContext.Provider>
  </ThemeProvider>
)

const open = async (user) => {
  await user.click(screen.getByRole('button', { name: /Any/ }))
  return screen.findByRole('listbox').catch(() => document.body)
}

describe('DriversGroupTypeSelector · the id of the group (P4-04)', () => {
  it('writes «ID 34» after the name, as its own muted element', async () => {
    const user = userEvent.setup()
    renderSelector()
    const root = await open(user)
    const ids = [...document.querySelectorAll('.odc-ofs-group-id, [data-group-id]')]
    expect(ids.map(node => node.textContent)).toEqual(['ID 3', 'ID 34'])
    expect(within(root).getByText('Shipday Downtown')).toBeInTheDocument()
  })

  it('finds a group by its number, and the word «ID» alone brings none', async () => {
    const user = userEvent.setup()
    renderSelector()
    await open(user)
    const search = document.querySelector('.od-multi-select-options input')
    await user.type(search, '34')
    expect(screen.queryByText('Night')).toBeNull()
    expect(screen.getByText('Shipday Downtown')).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'Night')
    expect(screen.queryByText('Shipday Downtown')).toBeNull()
  })

  it('still finds a group by its name', async () => {
    const user = userEvent.setup()
    renderSelector()
    await open(user)
    const search = document.querySelector('.od-multi-select-options input')
    await user.type(search, 'ship')
    expect(screen.getByText('Shipday Downtown')).toBeInTheDocument()
    expect(screen.queryByText('Night')).toBeNull()
  })
})
