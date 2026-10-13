import React, { useEffect, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, Key } from 'react-bootstrap-icons'

import { BuilderAppCredentials as BuilderAppCredentialsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { BuilderMessage, GuideLink } from '../BuilderShared'
import { BUILDER_CREDENTIAL_FIELDS, getCredentialsErrorMessage } from '../utils'
import {
  CompleteBadge,
  CredentialsCard,
  CredentialsGrid,
  ErrorBanner,
  Field,
  FieldHelp,
  SecretField
} from '../styles'

const PLATFORM_COPY = {
  ios: {
    title: (t) => t('BUILDER_CREDENTIALS_IOS', 'iOS · App Store Connect'),
    help: (t) => t('BUILDER_CREDENTIALS_IOS_HELP', 'Team and API key used to sign and upload the iOS app.')
  },
  android: {
    title: (t) => t('BUILDER_CREDENTIALS_ANDROID', 'Android · Signing'),
    help: (t) => t('BUILDER_CREDENTIALS_ANDROID_HELP', 'Keystore used to sign the Android app, plus the Play Store service account.')
  }
}

/** A password or file the API never sends back: only whether it's set. */
const WriteOnlyField = ({ field, platform, isSet, value, onChange, t }) => {
  const inputRef = useRef(null)
  const [editing, setEditing] = useState(false)
  const id = `builder-credential-${platform}-${field.name}`
  const label = field.label(t)

  useEffect(() => {
    if (value === undefined) setEditing(false)
  }, [value])

  if (field.kind === 'secret' && editing) {
    return (
      <Field>
        <label htmlFor={id}>{label}</label>
        <Input id={id} type='password' autoComplete='new-password' value={value || ''} onChange={(e) => onChange(field.name, e.target.value)} autoFocus />
      </Field>
    )
  }

  const status = field.kind === 'file' && value
    ? value.name
    : isSet
      ? t('BUILDER_CONFIGURED', 'Configured')
      : field.kind === 'file' ? t('BUILDER_NO_FILE_UPLOADED', 'No file uploaded') : t('BUILDER_NOT_SET', 'Not set')

  return (
    <Field>
      <FieldHelp as='div'>
        <label id={`${id}-label`}>{label}</label>
        {field.optional && <span>{t('BUILDER_OPTIONAL', 'Optional')}</span>}
      </FieldHelp>
      <SecretField set={isSet || !!value}>
        <span aria-live='polite'>{status}</span>
        <button
          type='button'
          aria-describedby={`${id}-label`}
          onClick={() => field.kind === 'file' ? inputRef.current?.click() : setEditing(true)}
        >
          {isSet ? t('BUILDER_REPLACE', 'Replace') : field.kind === 'file' ? t('BUILDER_UPLOAD', 'Upload') : t('BUILDER_SET', 'Set')}
        </button>
        {field.kind === 'file' && (
          <input
            ref={inputRef}
            type='file'
            accept={field.accept}
            aria-label={label}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onChange(field.name, file)
            }}
          />
        )}
      </SecretField>
    </Field>
  )
}

const CredentialsForm = ({ platform, credentials, saving, saveCredentials, guideUrl }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const fields = BUILDER_CREDENTIAL_FIELDS[platform] || []
  const [changes, setChanges] = useState({})
  const [error, setError] = useState(null)

  const textValue = (name) => changes[name] !== undefined ? changes[name] : (credentials[name] ?? '')
  const pending = Object.keys(changes).filter(name => {
    const field = fields.find(item => item.name === name)
    if (field.kind === 'text') return String(changes[name]).trim() !== String(credentials[name] ?? '')
    return !!changes[name]
  })

  const handleChange = (name, value) => {
    setChanges(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pending.length) return
    const payload = Object.fromEntries(pending.map(name => [name, typeof changes[name] === 'string' ? changes[name].trim() : changes[name]]))
    const { credentials: saved, errorCodes } = await saveCredentials(platform, payload)
    if (saved) {
      setChanges({})
      showToast(ToastType.Success, t('BUILDER_CREDENTIALS_SAVED', 'Saved. Used to sign the next build.'))
      return
    }
    setError(getCredentialsErrorMessage(platform, errorCodes, t))
  }

  const copy = PLATFORM_COPY[platform]

  return (
    <CredentialsCard onSubmit={handleSubmit} noValidate aria-labelledby={`builder-credentials-${platform}`}>
      <header>
        <div>
          <h2 id={`builder-credentials-${platform}`}>{copy ? copy.title(t) : platform}</h2>
          <CompleteBadge complete={!!credentials.complete}>
            {credentials.complete ? t('BUILDER_COMPLETE', 'Complete') : t('BUILDER_INCOMPLETE', 'Incomplete')}
          </CompleteBadge>
        </div>
        {copy && <p>{copy.help(t)}</p>}
        {guideUrl && <GuideLink href={guideUrl}>{t('BUILDER_GUIDE_HOW_TO_GET', 'How to get these')}</GuideLink>}
      </header>
      {error && (
        <ErrorBanner role='alert'>
          <ExclamationCircle aria-hidden='true' />
          <span>{error}</span>
        </ErrorBanner>
      )}
      {fields.map(field => {
        if (field.kind === 'text') {
          const id = `builder-credential-${platform}-${field.name}`
          return (
            <Field key={field.name}>
              <FieldHelp as='div'>
                <label htmlFor={id}>{field.label(t)}</label>
                {field.optional && <span>{t('BUILDER_OPTIONAL', 'Optional')}</span>}
              </FieldHelp>
              <Input id={id} type='text' autoComplete='off' value={textValue(field.name)} onChange={(e) => handleChange(field.name, e.target.value)} />
            </Field>
          )
        }
        return (
          <WriteOnlyField
            key={field.name}
            field={field}
            platform={platform}
            isSet={!!credentials[field.has]}
            value={changes[field.name]}
            onChange={handleChange}
            t={t}
          />
        )
      })}
      <footer>
        <Button type='submit' color='primary' borderRadius='8px' disabled={saving || !pending.length}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_SAVE_CREDENTIALS', 'Save credentials')}
        </Button>
      </footer>
    </CredentialsCard>
  )
}

const BuilderAppCredentialsUI = (props) => {
  const { credentialsState, reloadCredentials, savingPlatform, saveCredentials, guides } = props
  const [, t] = useLanguage()
  const { loading, credentials, error } = credentialsState

  if (loading && !credentials) {
    return <div aria-busy='true'><Skeleton height={320} /></div>
  }
  if (error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_CREDENTIALS_LOAD_ERROR', 'We couldn’t load the credentials')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadCredentials}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }
  const platforms = ['ios', 'android'].filter(platform => credentials?.[platform])
  if (!platforms.length) {
    return <BuilderMessage icon={<Key aria-hidden='true' />} title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return (
    <CredentialsGrid>
      {platforms.map(platform => (
        <CredentialsForm
          key={platform}
          platform={platform}
          credentials={credentials[platform]}
          saving={savingPlatform === platform}
          saveCredentials={saveCredentials}
          guideUrl={guides?.[`${platform}_credentials`]}
        />
      ))}
    </CredentialsGrid>
  )
}

/** Credentials tab: signing data per platform, written and never read back. */
export const BuilderAppCredentialsForm = (props) => (
  <BuilderAppCredentialsController {...props} UIComponent={BuilderAppCredentialsUI} />
)
