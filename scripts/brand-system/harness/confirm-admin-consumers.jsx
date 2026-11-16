import React, { useEffect, useState } from 'react'

import { ConfirmAdmin } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ConfirmAdmin'

const fixtureSession = [{
  auth: true,
  loading: false,
  user: { id: 8201, level: 0, email: 'admin@example.test' }
}]
const fixtureConfig = [{
  configs: {
    default_country_code: { value: 'US' },
    validation_phone_number_lib: { value: 1 }
  },
  loading: false
}]

export const SyntheticCheckPassword = props => {
  const {
    UIComponent,
    defaultConfirmTab = 'password',
    onSyntheticRequest,
    syntheticState = 'default'
  } = props
  const [checkPasswordStatus, setCheckPasswordStatus] = useState({ result: null, loading: syntheticState === 'password-loading', error: null })
  const [checkCodeState, setCheckCodeState] = useState({ loading: false, result: { error: false } })
  const [credentials, setCredentials] = useState({ email: '', cellphone: '', password: '' })
  const [confirmTab, setConfirmTab] = useState(defaultConfirmTab)
  const [otpType, setOtpType] = useState('email')
  const [otpState, setOtpState] = useState('')
  const [cellphoneStartZero, setCellphoneStartZero] = useState(null)

  const handleChangeInput = event => setCredentials(current => ({ ...current, [event.target.name]: event.target.value }))
  const handleChangeCredentials = changes => setCredentials(current => ({ ...current, ...changes }))

  const getCheckPassword = () => {
    const request = { kind: 'password', body: { password: credentials.password } }
    onSyntheticRequest(request)
    if (credentials.password === 'fixture-secret') {
      setCheckPasswordStatus({ result: 'OK', loading: false, error: null })
    } else {
      setCheckPasswordStatus({ result: null, loading: false, error: ['Password mismatch'] })
    }
  }

  const generateOtpCode = values => {
    const body = { type: 5, channel: otpType === 'email' ? 1 : 2, size: 6 }
    if (otpType === 'cellphone') {
      body.country_phone_code = values?.countryPhoneCode || values?.country_phone_code || credentials.country_phone_code
      body.cellphone = cellphoneStartZero || values?.cellphone || credentials.cellphone
      setCredentials({ country_phone_code: body.country_phone_code, cellphone: body.cellphone })
    } else {
      body.email = values?.email || credentials.email
      setCredentials({ email: body.email })
    }
    onSyntheticRequest({ kind: 'otp', body })
    setCheckCodeState(syntheticState === 'otp-error'
      ? { loading: false, result: { result: null, error: ['Fixture OTP delivery error'] } }
      : { loading: false, result: { result: 'sent', error: null } })
  }

  return (
    <UIComponent
      {...props}
      checkPasswordStatus={checkPasswordStatus}
      getCheckPassword={getCheckPassword}
      confirmTab={confirmTab}
      setOtpType={setOtpType}
      otpType={otpType}
      handleChangeTab={setConfirmTab}
      setOtpState={setOtpState}
      otpState={otpState}
      generateOtpCode={generateOtpCode}
      checkCodeState={checkCodeState}
      credentials={credentials}
      handleChangeInput={handleChangeInput}
      handleChangeCredentials={handleChangeCredentials}
      setCellphoneStartZero={setCellphoneStartZero}
    />
  )
}

export const ConfirmAdminConsumersFixture = () => {
  const [open, setOpen] = useState(false)
  const [requests, setRequests] = useState([])
  const [confirmations, setConfirmations] = useState([])
  const [closeCalls, setCloseCalls] = useState(0)
  const syntheticState = new URLSearchParams(window.location.search).get('adminState') || 'default'
  const outputStyle = { display: 'block', maxWidth: '100%', minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }

  globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__ = SyntheticCheckPassword
  globalThis.__OD_PHONE_FIXTURE_SESSION__ = fixtureSession
  globalThis.__OD_PHONE_FIXTURE_CONFIG__ = fixtureConfig

  useEffect(() => () => {
    delete globalThis.__OD_CONFIRM_ADMIN_CONTROLLER__
    delete globalThis.__OD_PHONE_FIXTURE_SESSION__
    delete globalThis.__OD_PHONE_FIXTURE_CONFIG__
  }, [])

  return (
    <main data-testid='confirm-admin-consumers' style={{ boxSizing: 'border-box', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, overflow: 'hidden', padding: 24, width: '100%' }}>
      <button type='button' onClick={() => setOpen(true)}>Open administrator confirmation</button>
      <ConfirmAdmin
        open={open}
        width='600px'
        syntheticState={syntheticState}
        onSyntheticRequest={request => setRequests(current => [...current, request])}
        onConfirm={(...args) => {
          setConfirmations(current => [...current, { args, arity: args.length }])
          setOpen(false)
        }}
        onClose={() => {
          setCloseCalls(current => current + 1)
          setOpen(false)
        }}
      />
      <div style={{ maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <output data-testid='confirm-admin-requests' style={outputStyle}>{JSON.stringify(requests)}</output>
        <output data-testid='confirm-admin-confirmations' style={outputStyle}>{JSON.stringify(confirmations)}</output>
        <output data-testid='confirm-admin-close-calls' style={outputStyle}>{closeCalls}</output>
      </div>
    </main>
  )
}
