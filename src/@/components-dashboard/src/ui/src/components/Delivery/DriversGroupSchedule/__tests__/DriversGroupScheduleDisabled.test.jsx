/* eslint-disable import/first */
import React from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('../../DriversGroupAddForm/ScheduleForm', () => ({
  ScheduleForm: () => <input aria-label='Timezone' />
}))

import { DriversGroupSchedule } from '..'

const baseProps = {
  driversGroupState: { driversGroup: { timezone: 'America/New_York' } },
  changesState: { timezone: 'America/Bogota' },
  actionState: { loading: false },
  isScheduleEnabled: true,
  handleUpdateDriversGroup: vi.fn()
}

const getForm = () => screen.getByLabelText('Timezone').closest('form')

describe('DriversGroupSchedule while the action is disabled', () => {
  it('makes the form inert and aria-disabled, so its fields leave the tab order', () => {
    renderWithProviders(<DriversGroupSchedule {...baseProps} actionDisabled />)

    const form = getForm()
    expect(form).toHaveAttribute('inert', '')
    expect(form).toHaveAttribute('aria-disabled', 'true')
  })

  it('leaves the form untouched when the action is enabled', () => {
    renderWithProviders(<DriversGroupSchedule {...baseProps} actionDisabled={false} />)

    const form = getForm()
    expect(form).not.toHaveAttribute('inert')
    expect(form).not.toHaveAttribute('aria-disabled')
  })
})

// redesign (AD-1, AD-7): Save is a Product button; the missing-timezone message is a Product alert dialog
describe('DriversGroupSchedule · Product pieces', () => {
  it('Save is a Product primary submit button', () => {
    renderWithProviders(<DriversGroupSchedule {...baseProps} actionDisabled={false} />)

    const save = screen.getByRole('button', { name: 'Save' })
    expect(save).toHaveClass('odc-btn')
    expect(save).toHaveAttribute('data-variant', 'primary')
    expect(save).toHaveAttribute('type', 'submit')
    expect(save).toBeEnabled()
  })

  it('Save is disabled with no changes, and while the action runs', () => {
    const { unmount } = renderWithProviders(<DriversGroupSchedule {...baseProps} changesState={{}} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    unmount()
    renderWithProviders(<DriversGroupSchedule {...baseProps} actionState={{ loading: true }} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('saves the changes', async () => {
    const handleUpdateDriversGroup = vi.fn()
    renderWithProviders(<DriversGroupSchedule {...baseProps} handleUpdateDriversGroup={handleUpdateDriversGroup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(handleUpdateDriversGroup).toHaveBeenCalledWith(baseProps.changesState)
  })

  it('a missing timezone opens the dialog with the same message and saves nothing', async () => {
    const handleUpdateDriversGroup = vi.fn()
    renderWithProviders(
      <DriversGroupSchedule
        {...baseProps}
        driversGroupState={{ driversGroup: {} }}
        changesState={{ enabled: true }}
        handleUpdateDriversGroup={handleUpdateDriversGroup}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Ordering' })
    expect(dialog).toHaveTextContent('The timezone is required.')
    expect(handleUpdateDriversGroup).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
