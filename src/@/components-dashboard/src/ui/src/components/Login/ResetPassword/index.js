import React, { useRef, useEffect, useState, useContext } from 'react'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'

import { useForm } from 'react-hook-form'

import { Alert } from '../../Shared'

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
import { FolderIcon, LockIcon } from '../AuthLayout/icons'

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
    isSuccessfulReset,
    elementLinkToLogin
  } = props

  const { handleSubmit, register, errors, watch, reset } = useForm()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [configFile, setConfigFile] = useContext(ConfigFileContext)

  const [, t] = useLanguage()

  const password = useRef({})

  password.current = watch('password', '')

  const onSubmit = () => {
    if (code && random) {
      handleResetPassword()
    } else {
      redirectResetPassword && redirectResetPassword(resetPasswordData)
      reset({ project: '', password: '' })
    }
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  let timeout = null
  const handleChangeProject = (e) => {
    e.persist()
    clearTimeout(timeout)
    timeout = setTimeout(function () {
      setConfigFile({ ...configFile, project: e.target.value })
    }, 750)
  }

  useEffect(() => {
    if (!formState.loading && formState.result?.error) {
      setAlertState({
        open: true,
        content: formState.result?.result || [t('ERROR', 'Error')]
      })
    } else if (!formState.loading && formState.result?.result?.length) {
      setAlertState({
        open: true,
        content: formState.result?.result === 'OK' ? t('PASSWORD_RESET_SUCCESS', 'Password changed successfully') : t(formState.result?.result, 'Password changed successfully')
      })
    }
  }, [formState])

  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      setAlertState({
        open: true,
        content: Object.values(errors).map(error => error.message)
      })
    }
  }, [errors])

  useEffect(() => {
    if (project) {
      setConfigFile({ ...configFile, project })
    }
    return () => closeAlert()
  }, [])

  const signInLink = elementLinkToLogin && (
    <RedirectLink>
      <span>{t('REMEMBER_YOUR_PASSWORD', 'Remember your password?')}</span>
      {elementLinkToLogin}
    </RedirectLink>
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
            onSubmit={handleSubmit(onSubmit)}
          >
            {!project && (
              <Field>
                <label htmlFor='reset-project'>{t('PROJECT', 'Project')}</label>
                <InputWithIcon>
                  <TextInput
                    id='reset-project'
                    type='text'
                    name='project'
                    spellCheck='false'
                    aria-invalid={errors?.project ? 'true' : undefined}
                    ref={register({
                      required: t(
                        'VALIDATION_ERROR_REQUIRED',
                        'Project is required'
                      ).replace('_attribute_', t('PROJECT', 'Project'))
                    })}
                    onChange={(e) => handleChangeProject(e)}
                    autoComplete='off'
                    autoCapitalize='off'
                  />
                  <FolderIcon />
                </InputWithIcon>
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
                  aria-invalid={errors?.password ? 'true' : undefined}
                  ref={register({
                    required: t('VALIDATION_ERROR_PASSWORD_REQUIRED', 'The field password is required'),
                    minLength: {
                      value: 8,
                      message: t('VALIDATION_ERROR_PASSWORD_MIN_STRING', 'The Password must be at least 8 characters.').replace('_attribute_', t('PASSWORD', 'Password')).replace('_min_', 8)
                    }
                  })}
                  onChange={handleChangeInput}
                  autoComplete='new-password'
                />
                <LockIcon />
              </InputWithIcon>
            </Field>
            <Field>
              <label htmlFor='reset-confirm-password'>{t('CONFIRM_PASSWORD', 'Confirm password')}</label>
              <InputWithIcon>
                <TextInput
                  id='reset-confirm-password'
                  type='password'
                  name='confirm-password'
                  spellCheck='false'
                  aria-invalid={errors?.['confirm-password'] ? 'true' : undefined}
                  ref={register({
                    required: t('VALIDATION_ERROR_PASSWORD_CONFIRM_REQUIRED', 'The field password confirm is required'),
                    validate: value =>
                      value === password.current || t('VALIDATION_ERROR_PASSWORDS_MATCH', 'The passwords do not match')
                  })}
                  onChange={handleChangeInput}
                  autoComplete='new-password'
                />
                <LockIcon />
              </InputWithIcon>
            </Field>
            <PrimaryButton
              type='submit'
              disabled={formState.loading}
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
            onSubmit={handleSubmit(onSubmit)}
          >
            {!code && (
              <Field>
                <label htmlFor='reset-code'>{t('CODE', 'Code')}</label>
                <TextInput
                  id='reset-code'
                  name='code'
                  aria-invalid={errors?.code ? 'true' : undefined}
                  ref={register({
                    required: t('RESET_PASSWORD_CODE_REQUIRED', 'The field code is required')
                  })}
                  onChange={handleChangeInput}
                  autoComplete='off'
                />
              </Field>
            )}
            {!random && (
              <Field>
                <label htmlFor='reset-random'>{t('RESET_PASSWORD_RANDOM_LABEL', 'Verification code')}</label>
                <TextInput
                  id='reset-random'
                  name='random'
                  aria-invalid={errors?.random ? 'true' : undefined}
                  ref={register({
                    required: t('RESET_PASSWORD_RANDOM_REQUIRED', 'The field random is required')
                  })}
                  onChange={handleChangeInput}
                  autoComplete='off'
                />
              </Field>
            )}
            <PrimaryButton type='submit'>
              {t('SUBMIT_CODES', 'Submit codes')}
            </PrimaryButton>
            {signInLink}
          </FormInput>
          )}
      <Alert
        title={t('RESET_PASSWORD', 'Reset Password')}
        content={alertState?.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => isSuccessfulReset ? onPasswordReset() : closeAlert()}
        closeOnBackdrop={false}
      />
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
