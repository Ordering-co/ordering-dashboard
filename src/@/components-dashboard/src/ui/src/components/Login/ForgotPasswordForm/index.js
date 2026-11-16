import React, { useEffect, useState, useContext, useRef } from 'react'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'

import { useForm } from 'react-hook-form'
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
import { ApiErrorNotice, FieldError, SuccessNotice, apiErrorMessages, focusFirstError, translateFormMessage } from '../AuthLayout/FormFeedback'
import { FolderIcon, MailIcon } from '../AuthLayout/icons'
import { getOrderingSubdomains } from '../../../utils'

// The fields that can fail validation, in the order they are on the page (the first one with an error takes the focus), and the id
// of the control of each one.
const FIELD_ORDER = [
  ['project', 'forgot-project'],
  ['email', 'forgot-email']
]

const SUCCESS_ID = 'forgot-success'

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

  // The first field with an error takes the focus in visual order (focusFirstError); the library would use registration order.
  const { handleSubmit, register, errors } = useForm({ shouldFocusError: false })
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ loading }] = useConfig()

  const [configFile, setConfigFile] = useContext(ConfigFileContext)
  // what the API answered, as the messages of the form notice. Validation errors are not here: they come from
  // react-hook-form and live next to their field.
  const [apiMessages, setApiMessages] = useState([])
  const [submitted, setSubmitted] = useState(false)
  // The send was launched and the API has not refused it: as in main, the button stays disabled (as «Link sent» once answered).
  const [sent, setSent] = useState(false)
  const projectTimer = useRef(null)
  const submittedProject = useRef(null)
  const submitRef = useRef(null)
  const attemptedRef = useRef(false)

  const isOrderingSubdomain = getOrderingSubdomains()
  const whiteLabelSubdomainValidation = !configFile?.local_project_pin && (!useProjectDomain || (useProjectDomain && isOrderingSubdomain))

  const translateMessage = (message) => translateFormMessage(t, message)
  const fieldError = (name) => translateMessage(errors?.[name]?.message)
  const clearApiMessages = () => setApiMessages((current) => (current.length ? [] : current))

  // The send of this attempt reached the loading state: its answer, when it comes, is the one to tell (main told any answer that was
  // not an error, whatever `result` held).
  const answeredRef = useRef(false)
  if (sent && formState.loading) answeredRef.current = true
  const sentOk = sent && !formState.loading && !formState.result?.error
  const showSuccess = sentOk && answeredRef.current

  // Typing is the correction of what the API refused: its notice goes, as the modal did when it was closed.
  const handleEmailChange = (e) => {
    clearApiMessages()
    hanldeChangeInput(e)
  }

  const onInvalid = (fieldErrors) => {
    clearApiMessages()
    focusFirstError(FIELD_ORDER, fieldErrors)
  }

  // .1: the send waits for the project the user typed (the same wait as the login), so a quick send does not go to the
  // project that was there before.
  const onSubmit = (values) => {
    clearApiMessages()
    attemptedRef.current = true
    const project = values?.project?.replace(/\s/g, '') || ordering.project
    clearTimeout(projectTimer.current)
    projectTimer.current = null
    submittedProject.current = project
    if (project !== ordering.project) setConfigFile({ ...configFile, project })
    setSubmitted(true)
  }

  const handleChangeProject = (e) => {
    const project = e.target.value.replace(/\s/g, '')
    clearApiMessages()
    clearTimeout(projectTimer.current)
    setSubmitted(false)
    submittedProject.current = null
    projectTimer.current = setTimeout(function () {
      setConfigFile({ ...configFile, project })
      projectTimer.current = null
    }, 750)
  }

  useEffect(() => {
    if (!ordering.project || !submitted || ordering.project !== submittedProject.current) return
    submittedProject.current = null
    setSubmitted(false)
    answeredRef.current = false
    setSent(true)
    handleButtonForgotPasswordClick()
  }, [ordering.project, submitted])

  useEffect(() => {
    setConfigFile({
      ...configFile,
      project: configFile?.local_project_pin || window.localStorage.getItem('project') || configFile?.project || null
    })
    return () => clearTimeout(projectTimer.current)
  }, [])

  // An answer of the API that is an error goes to the notice above the submit button.
  useEffect(() => {
    if (formState.loading) {
      clearApiMessages()
      return
    }
    if (!formState.result?.error) return
    setApiMessages(apiErrorMessages(t, formState.result?.result))
    setSubmitted(false)
    setSent(false)
    // A button that was disabled while it loaded can lose the focus: it comes back to where the user pressed, so it is not lost.
    // A field the user already moved to is left alone.
    const active = document.activeElement
    if (attemptedRef.current && submitRef.current && (!active || active === document.body || active === submitRef.current)) {
      submitRef.current.focus()
    }
    attemptedRef.current = false
  }, [formState])

  // The success takes the focus (the button that was pressed is disabled now), so it is read and the focus is not lost.
  useEffect(() => {
    if (showSuccess) document.getElementById(SUCCESS_ID)?.focus()
  }, [showSuccess])

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
            onSubmit={handleSubmit(onSubmit, onInvalid)}
          >
            {whiteLabelSubdomainValidation && (
              <Field>
                <label htmlFor='forgot-project'>{t('PROJECT', 'Project')}</label>
                <InputWithIcon>
                  <TextInput
                    id='forgot-project'
                    type='text'
                    name='project'
                    aria-invalid={fieldError('project') ? 'true' : undefined}
                    aria-describedby={fieldError('project') ? 'forgot-project-error' : undefined}
                    ref={register({
                      required: t('VALIDATION_ERROR_PROJECT_REQUIRED', 'Project is required')
                    })}
                    onChange={(e) => handleChangeProject(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                    spellCheck='false'
                  />
                  <FolderIcon />
                </InputWithIcon>
                {fieldError('project') && <FieldError id='forgot-project-error'>{fieldError('project')}</FieldError>}
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
                  aria-invalid={fieldError('email') ? 'true' : undefined}
                  aria-describedby={fieldError('email') ? 'forgot-email-error' : undefined}
                  onChange={handleEmailChange}
                  ref={register({
                    required: t('AUTH_EMAIL_REQUIRED', 'Email is required'),
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
              {fieldError('email') && <FieldError id='forgot-email-error'>{fieldError('email')}</FieldError>}
            </Field>
            {isReCaptchaEnable && (
              <ReCAPTCHAWrapper>
                <ReCaptcha
                  handleReCaptcha={handleReCaptcha}
                />
              </ReCAPTCHAWrapper>
            )}
            {apiMessages.length > 0 && <ApiErrorNotice messages={apiMessages} translate={translateMessage} />}
            {showSuccess && (
              <SuccessNotice id={SUCCESS_ID} tabIndex={-1}>
                {/* sentence case; the live catalog keeps «Link Sent Successfully» on the old key */}
                <strong>{t('AUTH_RESET_LINK_SENT', 'Link sent successfully')}</strong>
                <span>{t('IF_ACCOUNT_EXIST_EMAIL_SEND_PASSWORD', 'If an account exists with this email, we\'ll send you a link to reset your password.')}</span>
              </SuccessNotice>
            )}
            <PrimaryButton
              ref={submitRef}
              type='submit'
              disabled={formState.loading || sentOk}
              aria-busy={formState.loading || undefined}
            >
              {formState.loading
                ? t('SENDING', 'Sending…')
                : showSuccess
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
