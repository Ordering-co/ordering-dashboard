import React, { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import styled, { ThemeProvider } from 'styled-components'
import { describe, expect, it, vi } from 'vitest'

import theme from '~/theme.json'
import { createDashboardTheme } from '~/brand/adapter'
import { mergeThemePrimary } from '~/utils/bootTheme'

vi.mock('../../../../../index', () => ({
  useConfig: () => [{ configs: { default_country_code: { value: 'us' } } }],
  useLanguage: () => [null, (_key, fallback) => fallback],
  useSession: () => [{ auth: false }]
}))

vi.mock('react-phone-number-input', async () => {
  const ReactModule = await import('react')
  const PhoneInput = ReactModule.forwardRef(function ContractPhoneInput ({ inputComponent: InputComponent, ...props }, ref) {
    return (
      <div className='PhoneInput'>
        <div className='PhoneInputCountry'>
          <select aria-label='Country' className='PhoneInputCountrySelect'><option>US</option></select>
          <span className='PhoneInputCountryIcon' />
          <span className='PhoneInputCountrySelectArrow' />
        </div>
        <InputComponent ref={ref} className='PhoneInputInput' type='tel' value={props.value || ''} onChange={() => {}} />
      </div>
    )
  })
  return { default: PhoneInput }
})

import { InputPhoneNumber as OwnerInputPhoneNumber } from '../UI/InputPhoneNumber'
import * as ownerStyles from '../UI/phone-input-styles'
import { InputPhoneNumber } from '.'
import * as legacyStyles from './styles'

const lightTheme = createDashboardTheme(theme)

describe('legacy phone input facade', () => {
  it('reexports the owner and preserves exact styled identities', () => {
    expect(InputPhoneNumber).toBe(OwnerInputPhoneNumber)
    expect(legacyStyles.Container).toBe(ownerStyles.Container)
    expect(legacyStyles.ErrorMsg).toBe(ownerStyles.ErrorMsg)
  })

  it('keeps native styled polymorphism and final tenant theme attrs', () => {
    const ref = createRef()
    const tenantTheme = mergeThemePrimary(createDashboardTheme(theme, { mode: 'dark' }), '#123456')
    const AttrContainer = styled(legacyStyles.Container).attrs({ theme: tenantTheme })``
    const AttrError = styled(legacyStyles.ErrorMsg).attrs({ theme: tenantTheme })``

    render(
      <ThemeProvider theme={lightTheme}>
        <AttrContainer
          ref={ref}
          as='section'
          className='consumer-phone'
          style={{ '--od-phone-surface': '#abcdef' }}
        />
        <legacyStyles.Container forwardedAs='article' data-testid='forwarded-phone' />
        <AttrError>Invalid phone</AttrError>
      </ThemeProvider>
    )

    expect(ref.current.tagName).toBe('SECTION')
    expect(ref.current).toHaveClass('od-ui', 'od-phone-input', 'consumer-phone')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-phone-surface')).toBe('#abcdef')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-phone-focus')).toBe('#266DF0')
    expect(getComputedStyle(ref.current).getPropertyValue('--od-phone-radius')).toBe('4px')
    expect(screen.getByTestId('forwarded-phone').tagName).toBe('DIV')
    expect(screen.getByTestId('forwarded-phone')).toHaveAttribute('as', 'article')
    expect(getComputedStyle(screen.getByText('Invalid phone')).getPropertyValue('--od-phone-danger')).toBe('#FF6B6B')
  })
})
