import React, { useRef, useEffect, useState, useContext } from 'react'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'

import { useForm } from 'react-hook-form'

import {
  useLanguage,
  ResetPassword as ResetPasswordController
} from '../../../../../index'

import { AuthLayout } from '../AuthLayout'
import {
  Field,
  FormInput,
  TitleFormSide,
  InputWithIcon,
  TextInput,
  PrimaryButton,
  RedirectLink
} from '../AuthLayout/styles'
import { ApiErrorNotice, FieldError, NoticeActionButton, SuccessNotice, apiErrorMessages, focusFirstError, translateFormMessage } from '../AuthLayout/FormFeedback'
import { FolderIcon, LockIcon } from '../AuthLayout/icons'
import { getOrderingSubdomains } from '../../../utils'

// The fields that can fail validation, in the order they are on the page (the first one with an error takes the focus), and the id
// of the control of each one. Only the fields that are on the page can have an error.
const FIELD_ORDER = [
  ['project', 'reset-project'],
  ['password', 'reset-password'],
  ['confirm-password', 'reset-confirm-password'],
  ['code', 'reset-code'],
  ['random', 'reset-random']
]

const ResetPasswordUI = (props) => {
  const {
    code,
    random,
    project,
    formState,
    resetPasswordData,
    handleResetPassword,
    handleChangeInput,
    redirectResetPassword,
    onPasswordReset,
    elementLinkToLogin,
    useProjectDomain
  } = props

  // The first field with an error takes the focus in visual order (focusFirstError); the library would use registration order.
  const { handleSubmit, register, errors, watch, reset } = useForm({ shouldFocusError: false })
  const [configFile, setConfigFile] = useContext(ConfigFileContext)
  const isOrderingSubdomain = getOrderingSubdomains()
  const showProjectField = !project && !configFile?.local_project_pin && (!useProjectDomain || isOrderingSubdomain)
  // what the API answered, as the messages of the form notice. Validation errors are not here: they come from
  // react-hook-form and live next to their field.
  const [apiMessages, setApiMessages] = useState([])

  const [, t] = useLanguage()

  const password = useRef({})
  const projectTimer = useRef(null)
  const submitRef = useRef(null)
  const signInRef = useRef(null)
  const attemptedRef = useRef(false)

  password.current = watch('password', '')

  const translateMessage = (message) => translateFormMessage(t, message)
  const fieldError = (name) => translateMessage(errors?.[name]?.message)
  const clearApiMessages = () => setApiMessages((current) => (current.length ? [] : current))

  // The text main gave in the modal when the API accepted the new password.
  const successText = !formState.loading && !formState.result?.error && formState.result?.result?.length
    ? (formState.result?.result === 'OK' ? t('PASSWORD_RESET_SUCCESS', 'Password changed successfully') : t(formState.result?.result, 'Password changed successfully'))
    : null

  // Typing is the correction of what the API refused: its notice goes, as the modal did when it was closed.
  const handleInput = (e) => {
    clearApiMessages()
    handleChangeInput(e)
  }

  const onInvalid = (fieldErrors) => {
    clearApiMessages()
    focusFirstError(FIELD_ORDER, fieldErrors)
  }

  const onSubmit = () => {
    clearApiMessages()
    if (code && random) {
      attemptedRef.current = true
      handleResetPassword()
    } else {
      redirectResetPassword && redirectResetPassword(resetPasswordData)
      reset({ project: '', password: '' })
    }
  }

  const handleChangeProject = (e) => {
    const project = e.target.value
    clearApiMessages()
    clearTimeout(projectTimer.current)
    projectTimer.current = setTimeout(function () {
      setConfigFile({ ...configFile, project })
    }, 750)
  }

  // An answer of the API that is an error goes to the notice above the submit button.
  useEffect(() => {
    if (formState.loading) {
      clearApiMessages()
      return
    }
    if (!formState.result?.error) return
    setApiMessages(apiErrorMessages(t, formState.result?.result))
    // A button that was disabled while it loaded can lose the focus: it comes back to where the user pressed, so it is not lost.
    // A field the user already moved to is left alone.
    const active = document.activeElement
    if (attemptedRef.current && submitRef.current && (!active || active === document.body || active === submitRef.current)) {
      submitRef.current.focus()
    }
    attemptedRef.current = false
  }, [formState])

  // The success takes the focus on its button (the one that was pressed is disabled now), so it is read and the focus is not lost.
  useEffect(() => {
    if (successText) signInRef.current?.focus()
  }, [Boolean(successText)])

  useEffect(() => {
    if (project) {
      setConfigFile({ ...configFile, project })
    }
    return () => clearTimeout(projectTimer.current)
  }, [])

  const signInLink = elementLinkToLogin && (
    <RedirectLink>
      <span>{t('REMEMBER_YOUR_PASSWORD', 'Remember your password?')}</span>
      {elementLinkToLogin}
    </RedirectLink>
  )

  // Above the submit button: what the API refused, or that the password changed (with the way on, to sign in).
  const notices = (
    <>
      {apiMessages.length > 0 && <ApiErrorNotice messages={apiMessages} translate={translateMessage} />}
      {successText && (
        <SuccessNotice
          action={(
            <NoticeActionButton ref={signInRef} type='button' onClick={() => onPasswordReset && onPasswordReset()}>
              {t('SIGN_IN', 'Sign in')}
            </NoticeActionButton>
          )}
        >
          {successText}
        </SuccessNotice>
      )}
    </>
  )

  return (
    <AuthLayout>
      <TitleFormSide>
        <h1>{t('TITLE_RESET_PASSWORD', 'Reset password')}</h1>
        <p>
          {code && random
            ? t('RESET_PASSWORD_SUBTITLE_NEW', 'Choose a new password for your account.')
            : t('RESET_PASSWORD_SUBTITLE_CODES', 'Enter the codes from your reset email.')}
        </p>
      </TitleFormSide>
      {code && random
        ? (
          <FormInput
            noValidate
            onSubmit={handleSubmit(onSubmit, onInvalid)}
          >
            {showProjectField && (
              <Field>
                <label htmlFor='reset-project'>{t('PROJECT', 'Project')}</label>
                <InputWithIcon>
                  <TextInput
                    id='reset-project'
                    type='text'
                    name='project'
                    spellCheck='false'
                    aria-invalid={fieldError('project') ? 'true' : undefined}
                    aria-describedby={fieldError('project') ? 'reset-project-error' : undefined}
                    ref={register({
                      required: t('VALIDATION_ERROR_PROJECT_REQUIRED', 'Project is required')
                    })}
                    onChange={(e) => handleChangeProject(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                  />
                  <FolderIcon />
                </InputWithIcon>
                {fieldError('project') && <FieldError id='reset-project-error'>{fieldError('project')}</FieldError>}
              </Field>
            )}
            <Field>
              <label htmlFor='reset-password'>{t('NEW_PASSWORD', 'New password')}</label>
              <InputWithIcon>
                <TextInput
                  id='reset-password'
                  type='password'
                  name='password'
                  spellCheck='false'
                  aria-invalid={fieldError('password') ? 'true' : undefined}
                  aria-describedby={fieldError('password') ? 'reset-password-error' : undefined}
                  ref={register({
                    required: t('AUTH_NEW_PASSWORD_REQUIRED', 'New password is required'),
                    // same pattern as «New password is required»; the live catalog keeps «The Password must be…» on
                    // VALIDATION_ERROR_PASSWORD_MIN_STRING, which the user forms still read
                    minLength: {
                      value: 8,
                      message: t('AUTH_NEW_PASSWORD_MIN_LENGTH', 'New password must be at least _min_ characters').replace('_min_', 8)
                    }
                  })}
                  onChange={handleInput}
                  autoComplete='new-password'
                />
                <LockIcon />
              </InputWithIcon>
              {fieldError('password') && <FieldError id='reset-password-error'>{fieldError('password')}</FieldError>}
            </Field>
            <Field>
              <label htmlFor='reset-confirm-password'>{t('CONFIRM_PASSWORD', 'Confirm password')}</label>
              <InputWithIcon>
                <TextInput
                  id='reset-confirm-password'
                  type='password'
                  name='confirm-password'
                  spellCheck='false'
                  aria-invalid={fieldError('confirm-password') ? 'true' : undefined}
                  aria-describedby={fieldError('confirm-password') ? 'reset-confirm-password-error' : undefined}
                  ref={register({
                    required: t('AUTH_CONFIRM_PASSWORD_REQUIRED', 'Confirm password is required'),
                    validate: value =>
                      value === password.current || t('VALIDATION_ERROR_PASSWORDS_MATCH', 'The passwords do not match')
                  })}
                  onChange={handleInput}
                  autoComplete='new-password'
                />
                <LockIcon />
              </InputWithIcon>
              {fieldError('confirm-password') && <FieldError id='reset-confirm-password-error'>{fieldError('confirm-password')}</FieldError>}
            </Field>
            {notices}
            <PrimaryButton
              ref={submitRef}
              type='submit'
              disabled={formState.loading || Boolean(successText)}
              aria-busy={formState.loading || undefined}
            >
              {!formState.loading ? t('CHANGE_PASSWORD', 'Change password') : t('SAVING_PASSWORD', 'Saving…')}
            </PrimaryButton>
            {signInLink}
          </FormInput>
          )
        : (
          <FormInput
            noValidate
            onSubmit={handleSubmit(onSubmit, onInvalid)}
          >
            {!code && (
              <Field>
                <label htmlFor='reset-code'>{t('CODE', 'Code')}</label>
                <TextInput
                  id='reset-code'
                  name='code'
                  aria-invalid={fieldError('code') ? 'true' : undefined}
                  aria-describedby={fieldError('code') ? 'reset-code-error' : undefined}
                  ref={register({
                    required: t('AUTH_RESET_CODE_REQUIRED', 'Code is required')
                  })}
                  onChange={handleInput}
                  autoComplete='off'
                />
                {fieldError('code') && <FieldError id='reset-code-error'>{fieldError('code')}</FieldError>}
              </Field>
            )}
            {!random && (
              <Field>
                <label htmlFor='reset-random'>{t('RESET_PASSWORD_RANDOM_LABEL', 'Verification code')}</label>
                <TextInput
                  id='reset-random'
                  name='random'
                  aria-invalid={fieldError('random') ? 'true' : undefined}
                  aria-describedby={fieldError('random') ? 'reset-random-error' : undefined}
                  ref={register({
                    required: t('AUTH_VERIFICATION_CODE_REQUIRED', 'Verification code is required')
                  })}
                  onChange={handleInput}
                  autoComplete='off'
                />
                {fieldError('random') && <FieldError id='reset-random-error'>{fieldError('random')}</FieldError>}
              </Field>
            )}
            {notices}
            <PrimaryButton ref={submitRef} type='submit'>
              {t('SUBMIT_CODES', 'Submit codes')}
            </PrimaryButton>
            {signInLink}
          </FormInput>
          )}
    </AuthLayout>
  )
}

export const ResetPassword = (props) => {
  const resetPasswordProps = {
    ...props,
    UIComponent: ResetPasswordUI
  }

  return <ResetPasswordController {...resetPasswordProps} />
}
