import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import styled from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../index', () => ({
  CheckPassword: () => null,
  Popup: () => null,
  useConfig: () => [{ configs: {} }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ user: null }]
}))

import { ConfirmAdmin as OwnerConfirmAdmin } from '../UI/ConfirmAdmin'
import * as ownerStyles from '../UI/confirm-admin-styles'
import { ConfirmAdmin } from '.'
import * as facadeStyles from './styles'

describe('ConfirmAdmin compatibility facades', () => {
  it('reexports the shared owner and all seven styled identities', () => {
    expect(ConfirmAdmin).toBe(OwnerConfirmAdmin)
    for (const name of ['WrapperCheckPassword', 'FormController', 'Tabs', 'Tab', 'CountdownTimer', 'OtpWrapper', 'ResendCode']) {
      expect(facadeStyles[name]).toBe(ownerStyles[name])
      expect(typeof facadeStyles[name].styledComponentId).toBe('string')
    }
  })

  it('preserves ResendCode as and forwardedAs tags while keeping Base keyboard activation', async () => {
    const user = userEvent.setup()
    const asClick = vi.fn()
    const forwardedClick = vi.fn()
    const asRef = createRef()
    const forwardedRef = createRef()
    const AsResend = styled(facadeStyles.ResendCode).attrs({ as: 'a', href: '#as-resend' })``
    const ForwardedResend = styled(facadeStyles.ResendCode).attrs({ forwardedAs: 'a', href: '#forwarded-resend' })``
    render(
      <>
        <AsResend ref={asRef} onClick={event => { event.preventDefault(); asClick() }}>As resend</AsResend>
        <ForwardedResend ref={forwardedRef} onClick={event => { event.preventDefault(); forwardedClick() }}>Forwarded resend</ForwardedResend>
      </>
    )

    const as = screen.getByText('As resend')
    const forwarded = screen.getByRole('button', { name: 'Forwarded resend' })
    expect(as.tagName).toBe('A')
    expect(as).toHaveAttribute('href', '#as-resend')
    expect(asRef.current).toBe(as)
    expect(forwarded.tagName).toBe('SPAN')
    expect(forwarded).toHaveAttribute('as', 'a')
    expect(forwarded).toHaveAttribute('href', '#forwarded-resend')
    expect(forwardedRef.current).toBe(forwarded)
    forwarded.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')
    expect(forwardedClick).toHaveBeenCalledTimes(2)
  })
})
