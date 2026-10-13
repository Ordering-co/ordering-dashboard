import React, { useEffect, useState, useContext } from 'react'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'

import { useForm } from 'react-hook-form'
import { Alert } from '../../Shared'
import {
  ForgotPasswordForm as ForgotPasswordController,
  useLanguage,
  useApi,
  ReCaptcha,
  useConfig
} from '../../../../../index'
import { AuthLayout } from '../AuthLayout'
import {
  Field,
  FormInput,
  TitleFormSide,
  RedirectLink,
  InputWithIcon,
  TextInput,
  PrimaryButton,
  ReCAPTCHAWrapper
} from '../AuthLayout/styles'
import { FolderIcon, MailIcon } from '../AuthLayout/icons'
import { getOrderingSubdomains } from '../../../utils'

const ForgotPasswordUI = (props) => {
  const {
    hanldeChangeInput,
    handleButtonForgotPasswordClick,
    formState,
    elementLinkToLogin,
    isPopup,
    isReCaptchaEnable,
    handleReCaptcha,
    useProjectDomain
  } = props

  const { handleSubmit, register, errors } = useForm()
  const [alertState, setAlertState] = useState({ open: false, title: '', content: [], success: false })
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ loading }] = useConfig()

  const [configFile, setConfigFile] = useContext(ConfigFileContext)
  const [submitted, setSubmitted] = useState(false)

  const isOrderingSubdomain = getOrderingSubdomains()
  const whiteLabelSubdomainValidation = (!useProjectDomain || (useProjectDomain && isOrderingSubdomain))

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        ...alertState,
        success: false,
        open: true,
        title: t('ERROR_UNKNOWN', 'An error has ocurred'),
        content: Object.values(errors).map(error => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    if (!formState.loading && formState.result?.error) {
      setAlertState({
        ...alertState,
        success: false,
        open: true,
        title: t('ERROR_UNKNOWN', 'An error has ocurred'),
        content: formState.result?.result || [t('ERROR', 'Error')]
      })
    }
    if (!formState.loading && !formState.result?.error && alertState.success) {
      setAlertState({
        ...alertState,
        open: true,
        title: t('LINK_SEND_SUCCESSFULLY', 'Link Sent Successfully'),
        content: t('IF_ACCOUNT_EXIST_EMAIL_SEND_PASSWORD', 'If an account exists with this email a password will be sent')
      })
    }
  }, [formState.loading])

  useEffect(() => {
    if (!formState.loading && formState.result?.error) {
      setAlertState({
        open: true,
        content: formState.result?.result || [t('ERROR', 'Error')]
      })
      setSubmitted(false)
    }
  }, [formState])

  const onSubmit = () => {
    // const _configFile = { ...configFile }
    // _configFile.project = projectName
    // setConfigFile(_configFile)
    // localStorage.setItem('project', projectName)
    setSubmitted(true)
  }

  const closeAlert = () => {
    setAlertState({
      ...alertState,
      open: false,
      content: []
    })
  }

  let timeout = null
  const handleChangeProject = (e) => {
    e.persist()
    clearTimeout(timeout)
    setSubmitted(false)
    timeout = setTimeout(function () {
      setConfigFile({ ...configFile, project: e.target.value })
    }, 750)
  }

  useEffect(() => {
    if (ordering.project === '' || !submitted) return
    setAlertState({ ...alertState, success: true })
    handleButtonForgotPasswordClick()
  }, [ordering, submitted])

  useEffect(() => {
    setConfigFile({
      ...configFile,
      project: window.localStorage.getItem('project') || null
    })
  }, [])

  return (
    <>
      {(((useProjectDomain && !loading) || isOrderingSubdomain) || !useProjectDomain) && (
        <AuthLayout isPopup={isPopup}>
          <TitleFormSide>
            <h1>{t('TITLE_FORGOT_PASSWORD', 'Forgot your password?')}</h1>
            <p>{t('SUBTITLE_FORGOT_PASSWORD', 'Enter your email address and we\'ll send you a link to reset your password.')}</p>
          </TitleFormSide>
          <FormInput
            noValidate
            onSubmit={handleSubmit(onSubmit)}
          >
            {whiteLabelSubdomainValidation && (
              <Field>
                <label htmlFor='forgot-project'>{t('PROJECT', 'Project')}</label>
                <InputWithIcon>
                  <TextInput
                    id='forgot-project'
                    type='text'
                    name='project'
                    aria-invalid={errors?.project ? 'true' : undefined}
                    ref={register({
                      required: t(
                        'VALIDATION_ERROR_REQUIRED',
                        'The project field is required'
                      ).replace('_attribute_', t('PROJECT', 'Project'))
                    })}
                    onChange={(e) => handleChangeProject(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                    spellCheck='false'
                  />
                  <FolderIcon />
                </InputWithIcon>
              </Field>
            )}
            <Field>
              <label htmlFor='forgot-email'>{t('EMAIL', 'Email')}</label>
              <InputWithIcon>
                <TextInput
                  id='forgot-email'
                  type='email'
                  name='email'
                  spellCheck='false'
                  aria-invalid={errors?.email ? 'true' : undefined}
                  onChange={(e) => hanldeChangeInput(e)}
                  ref={register({
                    required: t('VALIDATION_ERROR_EMAIL_REQUIRED', 'The field Email is required').replace('_attribute_', t('EMAIL', 'Email')),
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: t('INVALID_ERROR_EMAIL', 'Invalid email address').replace('_attribute_', t('EMAIL', 'Email'))
                    }
                  })}
                  autoComplete='username'
                  autoCapitalize='off'
                />
                <MailIcon />
              </InputWithIcon>
            </Field>
            {isReCaptchaEnable && (
              <ReCAPTCHAWrapper>
                <ReCaptcha
                  handleReCaptcha={handleReCaptcha}
                />
              </ReCAPTCHAWrapper>
            )}
            <PrimaryButton
              type='submit'
              disabled={formState.loading || alertState.success}
              aria-busy={formState.loading || undefined}
            >
              {formState.loading
                ? t('SENDING', 'Sending…')
                : alertState.success && formState.result.result
                  ? t('RESET_LINK_SENT', 'Link sent')
                  : t('SEND_RESET_LINK', 'Send reset link')}
            </PrimaryButton>
            {elementLinkToLogin && (
              <RedirectLink>
                <span>{t('REMEMBER_YOUR_PASSWORD', 'Remember your password?')}</span>
                {elementLinkToLogin}
              </RedirectLink>
            )}
          </FormInput>
          <Alert
            title={alertState.title || t('TITLE_FORGOT_PASSWORD', 'Forgot your password?')}
            content={alertState.content}
            acceptText={t('ACCEPT', 'Accept')}
            open={alertState.open}
            onClose={() => closeAlert()}
            onAccept={() => closeAlert()}
            closeOnBackdrop={false}
          />
        </AuthLayout>
      )}
    </>
  )
}

export const ForgotPasswordForm = (props) => {
  const ForgotPasswordProps = {
    ...props,
    UIComponent: ForgotPasswordUI
  }
  return <ForgotPasswordController {...ForgotPasswordProps} />
}
