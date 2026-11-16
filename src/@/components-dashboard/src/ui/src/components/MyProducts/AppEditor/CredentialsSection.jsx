import React, { useEffect, useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, Field, InlineNotice, SecretField, TextField } from '../../Shared/Product'
import { credentialsUtilities } from '../BasicAppSettings/utils'
import { InputFile } from '../BasicAppSettings/InputFile'
import { DefaultKeystoreSwitch, KEYSTORE_FIELDS } from '../../Builder/BuilderAppCredentials/DefaultKeystoreSwitch'
import { useKeepFocus } from './useKeepFocus'
import './app-sections.css'

// redesign my-products B3 (D3, D5, D6, M-MP-09, M-MP-11, M-MP-12): App › Credentials. The same two blocks (iOS, Android), the
// same fields in the same order with the same `name`, the same FormData and one request per platform with changes
// (main's Credentials tab). What changes:
// - the labels are translated keys (M-MP-09; main printed the field name with its underscores removed) and the accepted formats are
//   a hint under the field, not a suffix of the label;
// - `key_password` and `store_password` are P/SecretField: hidden by default, «Show» reads them (D5; main drew them in the clear);
// - when a platform fails only the others are cleared: what was typed in the one that failed stays (M-MP-12; main cleared all);
// - `changes` is a new object on each edit (main mutated the one in state) and the app is updated with a new object per platform.
// - R1-02: the focus does not fall on <body> when Save ends. The toast stays (as in main) and the section also says how it went on a line
//   that can take the focus: «Saved» (a status) or the notice with the messages. Focus goes back to Save if it is enabled again (a
//   platform failed and its changes stay), or to that line when it is not.
// Spaces are still stripped from the ids and aliases (M-MP-11 stays), but not from the two passwords (main stripped them
// too, which silently changed a keystore password and broke the build). The title is the editor's, not ours.

const SAVED_MS = 3000
const { CREDENTIALINPUTS, formatPlatformName } = credentialsUtilities()
const PLATFORMS = CREDENTIALINPUTS.map(item => item.platform)
const SECRET_FIELDS = ['key_password', 'store_password']
const EMPTY_CHANGES = { ios: {}, android: {} }

// The label of each field: literal calls, never built from the name, so the key scanner and the translators see every key.
const credentialLabels = (t) => ({
  team_id: t('TEAM_ID', 'Team id'),
  itc_team_id: t('ITC_TEAM_ID', 'ITC team id'),
  api_key_id: t('API_KEY_ID', 'Api key id'),
  api_key_issuer_id: t('API_KEY_ISSUER_ID', 'Api key issuer id'),
  api_key_file: t('API_KEY_FILE', 'Api key file'),
  key_alias: t('KEY_ALIAS', 'Key alias'),
  key_password: t('KEY_PASSWORD', 'Key password'),
  store_file: t('STORE_FILE', 'Store file'),
  store_password: t('STORE_PASSWORD', 'Store password'),
  playstore_credential_file: t('PLAYSTORE_CREDENTIAL_FILE', 'Play Store credential file')
})

// the messages of what the API answers (a string, `{ message }`, or a list of either), translated
const messagesOf = (t, result) => {
  const list = Array.isArray(result) ? result : [result]
  return list
    .map(item => translateApiMessage(t, typeof item === 'string' ? item : item?.message, ''))
    .filter(Boolean)
}

export const CredentialsSection = (props) => {
  const { app, updateAppValues, updateProductAppCredentials } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [changes, setChanges] = useState(EMPTY_CHANGES)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errorText, setErrorText] = useState(null)
  const mounted = useRef(true)
  const savedTimer = useRef(null)
  const statusRef = useRef(null)
  const errorRef = useRef(null)
  const { remember, restore } = useKeepFocus()
  // the app as it is when the answers arrive, so a save started a moment ago writes over the newest credentials
  const appRef = useRef(app)
  appRef.current = app

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(savedTimer.current)
    }
  }, [])

  const labels = credentialLabels(t)
  const credentialsOf = (platform) => app?.[`${platform}_credentials`]

  const handleChange = (platform, name, value) => {
    setSaved(false)
    setChanges(current => {
      if (value === null) {
        const { [name]: removed, ...rest } = current[platform] ?? {}
        return { ...current, [platform]: rest }
      }
      const clean = value?.replace && !SECRET_FIELDS.includes(name) ? value.replace(/\s+/g, '') : value
      return { ...current, [platform]: { ...current[platform], [name]: clean } }
    })
  }

  const savedDefaultKeystore = !!credentialsOf('android')?.uses_default_keystore
  const pendingDefaultKeystore = changes.android?.use_default_keystore
  const useDefaultKeystore = pendingDefaultKeystore !== undefined ? pendingDefaultKeystore === '1' : savedDefaultKeystore
  const showDefaultKeystore = !!app?.android_default_keystore_available || savedDefaultKeystore
  const savedOf = (platform, name) => (
    platform === 'android' && savedDefaultKeystore && KEYSTORE_FIELDS.includes(name) ? undefined : credentialsOf(platform)?.[name]
  )

  const handleDefaultKeystore = (next) => {
    setSaved(false)
    setChanges(current => {
      const { use_default_keystore: removed, ...own } = current.android ?? {}
      const kept = next ? Object.fromEntries(Object.entries(own).filter(([name]) => !KEYSTORE_FIELDS.includes(name))) : own
      return { ...current, android: next === savedDefaultKeystore ? kept : { ...kept, use_default_keystore: next ? '1' : '0' } }
    })
  }

  const showError = (message) => {
    const text = t('SETTINGS_SAVE_FAILED', "We couldn't save your changes. _message_").replace('_message_', () => message)
    setErrorText(text.trim())
  }

  const showSaved = () => {
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => { if (mounted.current) setSaved(false) }, SAVED_MS)
  }

  const handleSave = async () => {
    remember()
    setLoading(true)
    setErrorText(null)
    setSaved(false)
    let failedSave = false
    const sent = changes
    const platforms = (app?.base?.platforms ?? PLATFORMS).filter(platform => Object.keys(sent[platform] ?? {}).length)
    try {
      const outcomes = await Promise.all(platforms.map(async (platform) => {
        const body = new FormData()
        Object.keys(sent[platform]).forEach(field => {
          if (typeof sent[platform][field] !== 'undefined') body.append(field, sent[platform][field])
        })
        try {
          const { error, result } = await updateProductAppCredentials({ body, platform })
          return { platform, error: !!error, result }
        } catch (err) {
          return { platform, error: true, result: [err?.message] }
        }
      }))
      if (!mounted.current) return
      if (outcomes.length) {
        const messages = outcomes.filter(item => item.error).flatMap(item => messagesOf(t, item.result))
        showToast(
          messages.length ? ToastType.Error : ToastType.Success,
          messages.length ? messages.join('\n') : t('CREDENTIALS_SAVED', 'Credentials saved successfully')
        )
        if (outcomes.some(item => item.error)) {
          failedSave = true
          showError(messages.join(' '))
        } else {
          showSaved()
        }
        const done = outcomes.filter(item => !item.error)
        if (done.length) {
          const values = {}
          done.forEach(({ platform, result }) => {
            const key = `${platform}_credentials`
            values[key] = { ...appRef.current?.[key], ...result }
          })
          updateAppValues(values)
        }
      }
      // only what was sent and saved is cleared: the platform that failed keeps what was typed (M-MP-12)
      const failed = outcomes.filter(item => item.error).map(item => item.platform)
      setChanges(current => {
        const next = { ...current }
        PLATFORMS.forEach(platform => {
          if (!failed.includes(platform)) next[platform] = {}
        })
        return next
      })
    } catch (err) {
      if (!mounted.current) return
      const message = translateApiMessage(t, err?.message, t('ERROR', 'Error'))
      showToast(ToastType.Error, message)
      failedSave = true
      showError(message)
    }
    if (!mounted.current) return
    setLoading(false)
    // redesign my-products R1-02: Save was disabled while it saved, so the focus fell on <body>
    restore(failedSave ? errorRef : statusRef, { preferFallback: failedSave })
  }

  const secretEnding = (ending) => {
    const [before, after] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return <>{before}{ending}{after}</>
  }

  const acceptedHint = (accept) => {
    const [before, after] = t('ACCEPTED_FILE_FORMATS', 'Accepted formats: _formats_').split('_formats_')
    return <>{before}<span className='odc-figure'>{accept.split(',').join(', ')}</span>{after}</>
  }

  const hasChanges = PLATFORMS.some(platform => Object.keys(changes[platform] ?? {}).length)

  return (
    <div className='odc-aps'>
      {CREDENTIALINPUTS.map(({ platform, inputs }) => (
        <div key={platform} className='odc-aps-platform'>
          <h3 className='odc-aps-platform-title'>{formatPlatformName(platform)}</h3>
          {platform === 'android' && showDefaultKeystore && (
            <DefaultKeystoreSwitch
              className='odc-aps-check'
              hintClassName='odc-aps-status'
              checked={useDefaultKeystore}
              hasOwnKeystore={!!savedOf('android', 'store_file')}
              usesDefaultKeystore={savedDefaultKeystore}
              onChange={handleDefaultKeystore}
            />
          )}
          <div className='odc-aps-grid'>
            {inputs.filter(item => !(platform === 'android' && useDefaultKeystore && KEYSTORE_FIELDS.includes(item.name))).map(item => {
              const label = labels[item.name]
              const value = changes[platform]?.[item.name] ?? savedOf(platform, item.name) ?? ''
              if (item.type === 'file') {
                return (
                  <Field key={item.name} label={label} hint={acceptedHint(item.accept)}>
                    <InputFile
                      name={item.name}
                      maxFileSize={1024}
                      accept={item.accept}
                      defaultValue={savedOf(platform, item.name)}
                      updateInput={file => handleChange(platform, item.name, file)}
                    />
                  </Field>
                )
              }
              if (SECRET_FIELDS.includes(item.name)) {
                return (
                  <SecretField
                    key={item.name}
                    name={item.name}
                    label={label}
                    showLabel={t('SHOW', 'Show')}
                    hideLabel={t('HIDE', 'Hide')}
                    endingLabel={secretEnding}
                    minLength='1'
                    maxLength='255'
                    value={value}
                    onChange={next => handleChange(platform, item.name, next)}
                  />
                )
              }
              return (
                <TextField
                  key={item.name}
                  name={item.name}
                  type={item.type}
                  label={label}
                  minLength='1'
                  maxLength='255'
                  value={value}
                  onChange={next => handleChange(platform, item.name, next)}
                />
              )
            })}
          </div>
        </div>
      ))}
      {errorText && (
        <div ref={errorRef} tabIndex={-1} className='odc-aps-result'>
          <InlineNotice tone='danger'>{errorText}</InlineNotice>
        </div>
      )}
      <div className='odc-aps-foot'>
        <Button variant='primary' busy={loading} disabled={loading || !hasChanges} onClick={handleSave}>
          {t('SAVE', 'Save')}
        </Button>
        <p role='status' ref={statusRef} tabIndex={-1} className='odc-aps-status'>{saved ? t('SAVED', 'Saved') : ''}</p>
      </div>
    </div>
  )
}
