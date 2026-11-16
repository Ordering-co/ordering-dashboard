import React from 'react'
import PhoneInput from 'react-phone-number-input'

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

const localFlagUrl = `${baseUrl}brand-fixture-flags/{XX}.svg`

const PhoneInputFixtureWidget = React.forwardRef(function PhoneInputFixtureWidget (props, ref) {
  return <PhoneInput {...props} ref={ref} flagUrl={localFlagUrl} />
})

PhoneInputFixtureWidget.displayName = 'PhoneInputFixtureWidget'

export default PhoneInputFixtureWidget
