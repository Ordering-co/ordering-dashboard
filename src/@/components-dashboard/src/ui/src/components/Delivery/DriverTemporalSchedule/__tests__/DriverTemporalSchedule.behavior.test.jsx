/* eslint-disable import/first */
import React, { forwardRef, useImperativeHandle } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

const nextDate = new Date('2030-05-06T19:30:00.000Z')

vi.mock('react-datepicker', () => ({
  default: forwardRef(function DatePickerMock (props, ref) {
    useImperativeHandle(ref, () => ({ setOpen: vi.fn() }))
    return (
      <div>
        <input aria-label={props['aria-label']} value='' readOnly />
        <button type='button' onClick={() => props.onChange(nextDate)}>Choose date</button>
        {props.onCalendarClose && <button type='button' onClick={props.onCalendarClose}>Close calendar</button>}
      </div>
    )
  })
}))

vi.mock('../../../../../../contexts/LanguageContext', () => ({
  useLanguage: () => [{ language: { code: 'en' } }, (_key, fallback) => fallback]
}))

vi.mock('../../../../../index', () => ({
  Button: ({ children, borderRadius: _borderRadius, color: _color, ...props }) => <button {...props}>{children}</button>
}))

import { DriverTemporalSchedule } from '..'

describe('DriverTemporalSchedule behavior', () => {
  it('commits the UTC value immediately and preserves calendar-close and Save callbacks', () => {
    const handleSelectDriverTemporary = vi.fn()
    const onClose = vi.fn()

    renderWithProviders(
      <DriverTemporalSchedule
        driverSchedule={{ id: 77 }}
        handleSelectDriverTemporary={handleSelectDriverTemporary}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Choose date' }))
    expect(handleSelectDriverTemporary).toHaveBeenCalledWith(77, true, '2030-05-06 19:30:00')
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close calendar' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
