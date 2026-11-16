/* eslint-disable import/first */
// redesign tramo A (W0-Q2-05): «Refund not sent» is an alertdialog and is described by its messages, as the AlertDialog (W0-Q1-10).
import React from 'react'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { RefundErrorDialog } from '../RefundErrorDialog'

afterEach(() => document.getElementById('app-modals')?.remove())

describe('RefundErrorDialog · description (W0-Q2-05)', () => {
  it.each([
    ['network', undefined, 'The refund was not sent. No money moved. Try again.'],
    ['api', ['Card declined'], 'Card declined'],
    ['unreadable', undefined, 'The answer could not be read, so the refund may have been sent. Check the payment of this order before you try again.']
  ])('the %s failure is described by its message', (kind, error, text) => {
    render(<RefundErrorDialog open kind={kind} error={error} canRetry onClose={() => {}} onRetry={() => {}} />)
    const dialog = screen.getByRole('alertdialog', { name: 'Refund not sent' })
    expect(dialog).toHaveAccessibleDescription(text)
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  })
})
