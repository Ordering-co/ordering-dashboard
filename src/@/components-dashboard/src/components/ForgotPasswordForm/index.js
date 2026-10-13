import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../contexts/LanguageContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage forgot password behavior without UI component
 */
export const ForgotPasswordForm = (props) => {
  const {
    UIComponent,
    defaultEmail,
    handleButtonForgotPasswordClick,
    handleSuccessForgotPassword
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const [formState, setFormState] = useState({ loading: false, result: { error: false } })
  const [formData, setFormData] = useState({ email: defaultEmail || '' })
  const [reCaptchaValue, setReCaptchaValue] = useState(null)
  const [isReCaptchaEnable, setIsReCaptchaEnable] = useState(false)

  /**
   * Default fuction for forgot password workflow
   */
  const handleForgotPasswordClick = async (data) => {
    if (isReCaptchaEnable) {
      if (reCaptchaValue === null) {
        setFormState({
          result: {
            error: true,
            result: t('RECAPTCHA_VALIDATION_IS_REQUIRED', 'The captcha validation is required')
          },
          loading: false
        })
        return
      }
    }
    try {
      setFormState({ ...formState, loading: true })
      const values = data || formData
      const response = await ordering.users().forgotPassword(values)
      setFormState({
        result: response.content,
        loading: false
      })
      if (isReCaptchaEnable) {
        window.grecaptcha.reset()
        setReCaptchaValue(null)
      }
      if (!response.content.error) {
        if (handleSuccessForgotPassword) {
          handleSuccessForgotPassword(formData.email)
        }
      }
    } catch (err) {
      setFormState({
        result: {
          error: true,
          result: err.message
        },
        loading: false
      })
    }
  }

  /**
   * Update form data data
   * @param {EventTarget} e Related HTML event
   */
  const hanldeChangeInput = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  useEffect(() => {
    setIsReCaptchaEnable(ordering?.project && configs &&
      Object.keys(configs).length > 0 &&
      configs?.security_recaptcha_auth?.value === '1')
  }, [configs, ordering?.project])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          formData={formData}
          hanldeChangeInput={hanldeChangeInput}
          handleButtonForgotPasswordClick={handleButtonForgotPasswordClick || handleForgotPasswordClick}
          isReCaptchaEnable={isReCaptchaEnable}
          handleReCaptcha={setReCaptchaValue}
        />
      )}
    </>
  )
}

ForgotPasswordForm.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Function to change default forgot password behavior
   */
  handleButtonForgotPasswordClick: PropTypes.func,
  /**
   * Function to get forgot password success event
   * @param {string} email Email to which it was sent
   */
  handleSuccessForgotPassword: PropTypes.func,
  /**
   * Default email to forgot password form
   */
  defaultEmail: PropTypes.string,
  /**
   * Url to signup page
   * Url to create element link to signup page
   */
  linkToSignup: PropTypes.string,
  /**
   * Url to login page
   * Url to create element link to login
   */
  linkToLogin: PropTypes.string,
  /**
   * Element to custom link to signup
   * You can provide de link element as react router Link or your custom Anchor to signup page
   */
  elementLinkToSignup: PropTypes.element,
  /**
   * Element to custo link to Login
   * You can provide de link element as react router Link or your custom Anchor to login page
   */
  elementLinkToLogin: PropTypes.element
}
