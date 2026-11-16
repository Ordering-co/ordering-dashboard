/* eslint-disable import/first */
// redesign bugs-d row 61 (delivery-services): the auto-assign controls of a drivers group had no accessible name. Two checkboxes sat
// next to a <span>, and the three inputs of the auto-reject time sat under a <label> that pointed to none of them. The controller is the
// only stub; the Checkbox and Input are the real ones.
import React from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{ dictionary: {} }, (_key, fallback) => fallback],
  DriversGroupAutoassign: ({ UIComponent, ...props }) => <UIComponent {...props} />
}))

import { DriversGroupAutoassignService } from '..'

const group = { autoassign_amount_drivers: 1, autoassign_autoaccept_by_driver: false, autoassign_autoassign_driver: false, autoreject_after_expiration: false }

const mount = (props = {}) => renderWithProviders(
  <DriversGroupAutoassignService
    autoAssign={1}
    curDriversGroup={group}
    changesState={{}}
    autoRejectOrderGroup={{ hour: '1', minute: '30', second: '15' }}
    onChangeSave={vi.fn()}
    onChangeAutoRejectOrderGroup={vi.fn()}
    {...props}
  />
)

describe('DriversGroupAutoassignService · accessible names', () => {
  it('names both checkboxes with the text beside them', () => {
    mount()
    expect(screen.getByRole('checkbox', { name: 'Assign Automatically' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Autoreject after expiration' })).toBeInTheDocument()
  })

  it('groups the three time inputs under the auto-reject label, each named by its unit', () => {
    mount()
    const group = screen.getByRole('group', { name: 'Auto reject Order if not assign in' })
    expect(within(group).getByRole('textbox', { name: 'Hours' })).toHaveValue('1')
    expect(within(group).getByRole('textbox', { name: 'Minutes' })).toHaveValue('30')
    expect(within(group).getByRole('textbox', { name: 'Seconds' })).toHaveValue('15')
  })
})
