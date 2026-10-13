import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const CheckPassword = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    defaultConfirmTab
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [checkPasswordStatus, setCheckPasswordStatus] = useState({ result: null, loading: false, error: null })
  const [checkCodeState, setCheckCodeState] = useState({ loading: false, result: { error: false } })
  const [credentials, setCredentials] = useState({ email: '', cellphone: '', password: '' })

  const [confirmTab, setConfirmTab] = useState(defaultConfirmTab)
  const [otpType, setOtpType] = useState('email')
  const [otpState, setOtpState] = useState('')
  const [cellphoneStartZero, setCellphoneStartZero] = useState(null)

  /**
   * Change current selected tab
   * @param {string} tab Reference tab email or cellphone
   */
  const handleChangeTab = (tab) => {
    setConfirmTab(tab)
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    })
  }

  /**
   * Update credential data
   */
  const handleChangeCredentials = (changes) => {
    setCredentials({
      ...credentials,
      ...changes
    })
  }

  /**
   * Method to confirm password from API
   */
  const getCheckPassword = async () => {
    try {
      setCheckPasswordStatus({ ...checkPasswordStatus, loading: true })
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: credentials?.password })
      }
      const response = await fetch(`${ordering.root}/users/check_password`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setCheckPasswordStatus({ ...checkPasswordStatus, loading: false, result: content.result, error: null })
      } else {
        setCheckPasswordStatus({ ...checkPasswordStatus, loading: false, error: content.result })
      }
    } catch (err) {
      setCheckPasswordStatus({ ...checkPasswordStatus, loading: false, error: err })
    }
  }

  const generateOtpCode = async (values) => {
    const body = {
      type: 5,
      channel: otpType === 'email' ? 1 : 2,
      size: 6
    }
    const email = values?.email || credentials?.email
    const cellphone = cellphoneStartZero || values?.cellphone || credentials?.cellphone
    const countryPhoneCode = values?.countryPhoneCode || values?.country_phone_code || credentials.country_phone_code

    try {
      if (otpType === 'cellphone') {
        body.country_phone_code = countryPhoneCode
        body.cellphone = cellphone
        setCredentials({
          cellphone,
          country_phone_code: countryPhoneCode
        })
      } else {
        body.email = email
        setCredentials({
          email
        })
      }
      const response = await fetch(`${ordering.root}/codes/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-App-X': ordering.appId,
          'X-INTERNAL-PRODUCT-X': ordering.appInternalName
        },
        body: JSON.stringify(body)
      })
      const { result, error } = await response.json()
      if (!error) {
        setCheckCodeState({ ...checkCodeState, result: { result, error: null } })
        return
      }
      setCheckCodeState({ ...checkCodeState, result: { error: result } })
    } catch (err) {
      setCheckCodeState({ ...checkCodeState, result: { error: err.message } })
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          checkPasswordStatus={checkPasswordStatus}
          getCheckPassword={getCheckPassword}
          confirmTab={confirmTab}
          setOtpType={setOtpType}
          otpType={otpType}
          handleChangeTab={handleChangeTab}
          setOtpState={setOtpState}
          otpState={otpState}
          generateOtpCode={generateOtpCode}
          checkCodeState={checkCodeState}
          credentials={credentials}
          handleChangeInput={handleChangeInput}
          handleChangeCredentials={handleChangeCredentials}
          setCellphoneStartZero={setCellphoneStartZero}
        />
      )}
    </>
  )
}

CheckPassword.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  defaultConfirmTab: 'password'
}
