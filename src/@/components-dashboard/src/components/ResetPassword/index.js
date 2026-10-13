import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'

export const ResetPassword = (props) => {
  const {
    UIComponent,
    code,
    random,
    handleCustomResetPassword,
    handleSuccessResetPassword
  } = props

  const [formState, setFormState] = useState({ loading: false, result: { error: false } })
  const [resetPasswordData, setResetPasswordData] = useState({ code, random, password: '' })
  const [isSuccessfulReset, setSuccessfulReset] = useState(false)
  const [ordering] = useApi()

  const handleResetPassword = async () => {
    if (handleCustomResetPassword) {
      return handleCustomResetPassword(resetPasswordData)
    }
    try {
      setFormState({ ...formState, loading: true })
      const { response } = await ordering.users().resetPassword(resetPasswordData)
      const result = response.data
      setFormState({
        result,
        loading: false
      })
      if (!result.error) {
        if (handleSuccessResetPassword) {
          handleSuccessResetPassword(result.result)
        }
        setSuccessfulReset(true)
      }
    } catch (error) {
      if (error.constructor.name !== 'Cancel') {
        setFormState({
          result: {
            error: true,
            result: error.message
          },
          loading: false
        })
      }
    }
  }

  const handleChangeInput = e => {
    setResetPasswordData({ ...resetPasswordData, [e.target.name]: e.target.value })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleResetPassword={handleResetPassword}
          handleChangeInput={handleChangeInput}
          resetPasswordData={resetPasswordData}
          formState={formState}
          isSuccessfulReset={isSuccessfulReset}
        />
      )}
    </>
  )
}

ResetPassword.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   *  Code is generated with the endpoint Users Forgot Password, injected on the link received on the Forgot Password email.
   */
  code: PropTypes.string,
  /**
   *  Random is generated with the endpoint Users Forgot Password, injected on the link received on the Forgot Password email.
   */
  random: PropTypes.string
}
