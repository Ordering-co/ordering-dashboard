import React, { useEffect, useRef, useState } from 'react'

import { BuilderAppCredentials as BuilderAppCredentialsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, LockKeyhole } from '../../Shared/Icon'
import { Button, EmptyState, InlineNotice, StatusBadge, TextField } from '../../Shared/Product'
import { LoadingRows } from '../BuilderAppSettings'
import { GuideLink } from '../BuilderShared'
import { BUILDER_CREDENTIAL_FIELDS, getCredentialsErrorMessage } from '../utils'
import { DefaultKeystoreSwitch, KEYSTORE_FIELDS } from './DefaultKeystoreSwitch'
import '../BuilderAppSettings/builder-app-edit.css'

// redesign B2: Credentials on Product pieces (TextField, Buttons, StatusBadge, InlineNotice, Skeleton, EmptyState) and
// --od-* tokens. Secrets stay write-only as in main: Set or Replace opens an empty password field (a plain P/TextField of type
// password: P/PasswordField and P/SecretField add a «Show» main never had). Each platform is still a form named by its title.

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
      <TextField
        id={id}
        type='password'
        label={label}
        autoComplete='new-password'
        value={value || ''}
        onChange={(next) => onChange(field.name, next)}
        autoFocus
      />
    )
  }

  const status = field.kind === 'file' && value
    ? value.name
    : isSet
      ? t('BUILDER_CONFIGURED', 'Configured')
      : field.kind === 'file' ? t('BUILDER_NO_FILE_UPLOADED', 'No file uploaded') : t('BUILDER_NOT_SET', 'Not set')

  return (
    <div className='odc-be-secret'>
      <div className='odc-be-secret-head'>
        <span id={`${id}-label`}>{label}</span>
        {field.optional && <span className='odc-be-muted'>{t('BUILDER_OPTIONAL', 'Optional')}</span>}
      </div>
      <div className='odc-be-secret-box' data-set={isSet || value ? '' : undefined}>
        <span aria-live='polite'>{status}</span>
        <Button
          size='sm'
          aria-describedby={`${id}-label`}
          onClick={() => field.kind === 'file' ? inputRef.current?.click() : setEditing(true)}
        >
          {isSet ? t('BUILDER_REPLACE', 'Replace') : field.kind === 'file' ? t('BUILDER_UPLOAD', 'Upload') : t('BUILDER_SET', 'Set')}
        </Button>
        {field.kind === 'file' && (
          <input
            ref={inputRef}
            type='file'
            hidden
            accept={field.accept}
            aria-label={label}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) onChange(field.name, file)
            }}
          />
        )}
      </div>
    </div>
  )
}

const CredentialsForm = ({ platform, credentials, saving, saveCredentials, guideUrl }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [changes, setChanges] = useState({})
  const [error, setError] = useState(null)

  const savedDefaultKeystore = !!credentials.uses_default_keystore
  const useDefaultKeystore = changes.use_default_keystore !== undefined ? changes.use_default_keystore : savedDefaultKeystore
  const showDefaultKeystore = platform === 'android' && (!!credentials.default_keystore_available || savedDefaultKeystore)
  const isKeystoreField = (name) => platform === 'android' && KEYSTORE_FIELDS.includes(name)
  const fields = (BUILDER_CREDENTIAL_FIELDS[platform] || []).filter(field => !(useDefaultKeystore && isKeystoreField(field.name)))
  const savedOf = (name) => savedDefaultKeystore && isKeystoreField(name) ? undefined : credentials[name]

  const textValue = (name) => changes[name] !== undefined ? changes[name] : (savedOf(name) ?? '')
  const pending = Object.keys(changes).filter(name => {
    if (name === 'use_default_keystore') return changes[name] !== savedDefaultKeystore
    const field = fields.find(item => item.name === name)
    if (!field) return false
    if (field.kind === 'text') return String(changes[name]).trim() !== String(savedOf(name) ?? '')
    return !!changes[name]
  })

  const handleChange = (name, value) => {
    setChanges(prev => ({ ...prev, [name]: value }))
    setError(null)
  }

  const handleDefaultKeystore = (next) => {
    setChanges(prev => {
      const kept = next ? Object.fromEntries(Object.entries(prev).filter(([name]) => !isKeystoreField(name))) : prev
      return { ...kept, use_default_keystore: next }
    })
    setError(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!pending.length) return
    const payload = Object.fromEntries(pending.map(name => {
      if (name === 'use_default_keystore') return [name, changes[name] ? '1' : '0']
      return [name, typeof changes[name] === 'string' ? changes[name].trim() : changes[name]]
    }))
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
    <form className='odc-be-card' onSubmit={handleSubmit} noValidate aria-labelledby={`builder-credentials-${platform}`}>
      <header>
        <div>
          <h2 id={`builder-credentials-${platform}`}>{copy ? copy.title(t) : platform}</h2>
          <StatusBadge
            family={credentials.complete ? 'done' : 'pending'}
            label={credentials.complete ? t('BUILDER_COMPLETE', 'Complete') : t('BUILDER_INCOMPLETE', 'Incomplete')}
          />
        </div>
        {copy && <p>{copy.help(t)}</p>}
        {guideUrl && <GuideLink href={guideUrl}>{t('BUILDER_GUIDE_HOW_TO_GET', 'How to get these')}</GuideLink>}
      </header>
      {error && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{error}</InlineNotice>
      )}
      {showDefaultKeystore && (
        <DefaultKeystoreSwitch
          className='odc-be-secret'
          hintClassName='odc-be-muted'
          checked={useDefaultKeystore}
          hasOwnKeystore={!!credentials.has_store_file && !savedDefaultKeystore}
          usesDefaultKeystore={savedDefaultKeystore}
          onChange={handleDefaultKeystore}
        />
      )}
      {fields.map(field => {
        if (field.kind === 'text') {
          return (
            <div key={field.name} className='odc-be-field'>
              {field.optional && <span className='odc-be-field-action odc-be-muted'>{t('BUILDER_OPTIONAL', 'Optional')}</span>}
              <TextField
                id={`builder-credential-${platform}-${field.name}`}
                label={field.label(t)}
                autoComplete='off'
                value={textValue(field.name)}
                onChange={(value) => handleChange(field.name, value)}
              />
            </div>
          )
        }
        return (
          <WriteOnlyField
            key={field.name}
            field={field}
            platform={platform}
            isSet={!!credentials[field.has] && !(savedDefaultKeystore && isKeystoreField(field.name))}
            value={changes[field.name]}
            onChange={handleChange}
            t={t}
          />
        )
      })}
      <footer>
        <Button type='submit' variant='primary' disabled={saving || !pending.length}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_SAVE_CREDENTIALS', 'Save credentials')}
        </Button>
      </footer>
    </form>
  )
}

const BuilderAppCredentialsUI = (props) => {
  const { credentialsState, reloadCredentials, savingPlatform, saveCredentials, guides } = props
  const [, t] = useLanguage()
  const { loading, credentials, error } = credentialsState

  if (loading && !credentials) {
    return <LoadingRows count={1} block='calc(var(--od-space-10) * 2.5)' />
  }
  if (error) {
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_CREDENTIALS_LOAD_ERROR', 'We couldn’t load the credentials')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadCredentials}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }
  const platforms = ['ios', 'android'].filter(platform => credentials?.[platform])
  if (!platforms.length) {
    // shortcut: Shared/Icon has no Key glyph; LockKeyhole is the closest until one is added
    return <EmptyState icon={LockKeyhole} titleAs='h2' title={t('BUILDER_NOTHING_TO_EDIT', 'This base has nothing to edit here')} />
  }
  return (
    <div className='odc-be-credentials'>
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
    </div>
  )
}

/** Credentials tab: signing data per platform, written and never read back. */
export const BuilderAppCredentialsForm = (props) => (
  <BuilderAppCredentialsController {...props} UIComponent={BuilderAppCredentialsUI} />
)
