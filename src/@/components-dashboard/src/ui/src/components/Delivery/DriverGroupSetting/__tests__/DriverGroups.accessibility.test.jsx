/* eslint-disable import/first */
import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  DriverGroupSetting: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  DriversGroupsList: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../../Shared', () => ({
  Alert: () => null,
  Confirm: () => null,
  Pagination: () => null,
  SearchBar: ({ placeholder }) => <input aria-label={placeholder} />
}))

import { DriverGroupSetting } from '..'

const group = { id: 12, name: 'Central', drivers: [{ id: 1 }, { id: 2 }] }

describe('driver group selection semantics', () => {
  it('exposes setting rows as pressed buttons and preserves the id callback', () => {
    const handleCheckboxClick = vi.fn()
    renderWithProviders(
      <DriverGroupSetting
        includedGroupIds={[12]}
        driversGroupsState={{ loading: false, groups: [group] }}
        actionState={{ loading: false }}
        handleCheckboxClick={handleCheckboxClick}
        handleSelectAllDriver={vi.fn()}
      />
    )

    const option = screen.getByRole('button', { name: 'Central' })
    expect(option).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(option)
    expect(handleCheckboxClick).toHaveBeenCalledWith(12)
  })
})
