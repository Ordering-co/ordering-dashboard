import React, { useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, FileEarmarkCheck } from 'react-bootstrap-icons'

import { BuilderProductPush as BuilderProductPushController, ToastType, useLanguage, useToast } from '../../../../../index'
import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import { BuilderMessage } from '../BuilderShared'
import { getPushErrorMessage, parseServiceAccount } from '../utils'
import {
  DetailsList,
  ErrorBanner,
  FileDrop,
  HelpDetails,
  LinkButton,
  MutedText,
  Pill,
  PushCard,
  PushEditor
} from '../styles'

/** The look and words of each `source`. */
const SOURCES = {
  site: {
    pill: { kind: 'success' },
    label: (t) => t('BUILDER_PUSH_OWN_ACCOUNT', 'Own account'),
    text: (t) => t('BUILDER_PUSH_OWN_ACCOUNT_HELP', 'Push notifications to this app’s devices use its own Firebase account.')
  },
  project: {
    pill: { status: 'draft' },
    label: (t) => t('BUILDER_PUSH_PROJECT_ACCOUNT', 'Project account'),
    text: (t) => t('BUILDER_PUSH_PROJECT_ACCOUNT_HELP', 'Push notifications to this app’s devices use your project’s Firebase account.')
  },
  none: {
    pill: { kind: 'progress' },
    label: (t) => t('BUILDER_PUSH_NO_ACCOUNT', 'No account'),
    text: (t) => t('BUILDER_PUSH_NO_ACCOUNT_HELP', 'Neither this app nor your project has a Firebase account, so push notifications aren’t sent. Add one to send them.')
  }
}

/** The file's text; `FileReader` where `Blob.text()` is missing. */
const readAsText = (file) => {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/**
 * Loads a service account from the `.json` Firebase downloads, or from its
 * content pasted, checks it like the API does and shows which account it is
 * before saving it.
 */
const FirebaseAccountForm = (props) => {
  const { saving, saveFirebase, onSaved, onCancel } = props
  const [, t] = useLanguage()
  const fileRef = useRef(null)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState(null)
  const [errorCodes, setErrorCodes] = useState([])

  const parsed = text ? parseServiceAccount(text) : null
  const account = parsed?.account ?? null
  const error = errorCodes.length ? getPushErrorMessage(errorCodes, 'save', t) : null

  const readFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const content = await readAsText(file)
      setFileName(file.name)
      setText(content)
      const check = parseServiceAccount(content)
      setErrorCodes(check.errorCode ? [check.errorCode] : [])
    } catch (err) {
      setFileName(null)
      setText('')
      setErrorCodes(['file.unreadable'])
    }
  }

  const switchMode = () => {
    setPasting(!pasting)
    setText('')
    setFileName(null)
    setErrorCodes([])
  }

  const save = async () => {
    const check = parseServiceAccount(text)
    if (check.errorCode) {
      setErrorCodes([check.errorCode])
      return
    }
    const answer = await saveFirebase(text.trim())
    if (answer.ok) {
      onSaved()
      return
    }
    setErrorCodes(answer.errorCodes.length ? answer.errorCodes : ['save.failed'])
  }

  return (
    <PushEditor invalid={!!error}>
      <div>
        <h3 id='builder-push-editor-title'>{t('BUILDER_PUSH_USE_OWN', 'Use its own account')}</h3>
        <MutedText>{t('BUILDER_PUSH_USE_OWN_HELP', 'For an app with its own Firebase project. The private key is never shown again after you save it.')}</MutedText>
      </div>

      {error && (
        <ErrorBanner role='alert'>
          <ExclamationCircle aria-hidden='true' />
          <span>{error}</span>
        </ErrorBanner>
      )}

      {!pasting && (
        <FileDrop>
          <div>
            {fileName
              ? (
                <>
                  <strong style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 500 }}>
                    <FileEarmarkCheck aria-hidden='true' color='#2C7BE5' />
                    {fileName}
                  </strong>
                  {account && (
                    <MutedText small>
                      {t('BUILDER_PUSH_DETECTED', 'Firebase project _project_ · _email_')
                        .replace('_project_', account.projectId)
                        .replace('_email_', account.clientEmail)}
                    </MutedText>
                  )}
                </>
                )
              : <MutedText>{t('BUILDER_PUSH_CHOOSE_HELP', 'The .json file Firebase downloads for a service account.')}</MutedText>}
          </div>
          <Button type='button' color='primary' outline borderRadius='8px' onClick={() => fileRef.current?.click()}>
            {fileName ? t('BUILDER_PUSH_CHOOSE_ANOTHER', 'Choose another file') : t('BUILDER_PUSH_CHOOSE_FILE', 'Choose .json file')}
          </Button>
          <input
            ref={fileRef}
            type='file'
            accept='.json,application/json'
            aria-label={t('BUILDER_PUSH_FILE', 'Service account file (.json)')}
            onChange={readFile}
          />
        </FileDrop>
      )}

      {pasting && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor='builder-push-paste' style={{ fontWeight: 500, margin: 0 }}>
            {t('BUILDER_PUSH_PASTE_LABEL', 'Content of the .json file')}
          </label>
          <textarea
            id='builder-push-paste'
            value={text}
            spellCheck={false}
            aria-invalid={error ? 'true' : 'false'}
            onChange={(e) => { setText(e.target.value); setErrorCodes([]) }}
            onBlur={() => {
              const check = text ? parseServiceAccount(text) : null
              if (check?.errorCode) setErrorCodes([check.errorCode])
            }}
          />
          {account && (
            <MutedText small>
              {t('BUILDER_PUSH_DETECTED', 'Firebase project _project_ · _email_')
                .replace('_project_', account.projectId)
                .replace('_email_', account.clientEmail)}
            </MutedText>
          )}
        </div>
      )}

      <LinkButton type='button' style={{ alignSelf: 'flex-start', fontSize: 13 }} onClick={switchMode}>
        {pasting ? t('BUILDER_PUSH_UPLOAD_INSTEAD', 'Upload the file instead') : t('BUILDER_PUSH_PASTE_INSTEAD', 'Paste the content instead')}
      </LinkButton>

      <HelpDetails>
        <summary>{t('BUILDER_PUSH_WHERE_FILE', 'Where do I get this file?')}</summary>
        <ol>
          <li>{t('BUILDER_PUSH_STEP_CONSOLE', 'Open the Firebase console and choose the app’s project.')}</li>
          <li>{t('BUILDER_PUSH_STEP_SETTINGS', 'Go to Project settings → Service accounts.')}</li>
          <li>{t('BUILDER_PUSH_STEP_GENERATE', 'Click Generate new private key and confirm. Firebase downloads a .json file.')}</li>
          <li>{t('BUILDER_PUSH_STEP_UPLOAD', 'Upload that file here. Keep it private: it lets anyone send pushes to your app.')}</li>
        </ol>
      </HelpDetails>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {onCancel && (
          <Button type='button' color='secundary' borderRadius='8px' disabled={saving} onClick={onCancel}>{t('CANCEL', 'Cancel')}</Button>
        )}
        <Button type='button' color='primary' borderRadius='8px' disabled={saving || !account} onClick={save}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_PUSH_SAVE', 'Save account')}
        </Button>
      </div>
    </PushEditor>
  )
}

const BuilderProductPushUI = (props) => {
  const { pushState, reloadPush, saving, removing, saveFirebase, removeFirebase, productName } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [editing, setEditing] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const { loading, firebase, error } = pushState

  if (error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_PUSH_LOAD_ERROR', 'We couldn’t load the push settings')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadPush}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }

  if (loading && !firebase) {
    return <div aria-busy='true' style={{ maxWidth: 1100 }}><Skeleton height={180} borderRadius={12} /></div>
  }

  const source = firebase?.source === 'site' || firebase?.source === 'project' ? firebase.source : 'none'
  const copy = SOURCES[source]
  // The project's account shows the form right away; the others open it from a button
  const formOpen = source === 'project' || editing
  const name = productName || ''

  const handleSaved = () => {
    setEditing(false)
    showToast(ToastType.Success, t('BUILDER_PUSH_SAVED', 'Saved. Push notifications to _name_ use its own Firebase account.').replace('_name_', name))
  }

  const handleRemove = async () => {
    setRemoveOpen(false)
    const answer = await removeFirebase()
    if (!answer.ok) {
      showToast(ToastType.Error, getPushErrorMessage(answer.errorCodes, 'remove', t))
      return
    }
    showToast(ToastType.Success, (answer.source === null
      ? t('BUILDER_PUSH_REMOVED_NONE', 'Removed. Push notifications to _name_ aren’t sent until you add an account.')
      : t('BUILDER_PUSH_REMOVED', 'Removed. Push notifications to _name_ use your project’s account.')).replace('_name_', name))
  }

  return (
    <PushCard aria-labelledby='builder-push-firebase'>
      <header>
        <div>
          <h2 id='builder-push-firebase'>
            Firebase
            <Pill {...copy.pill}>{copy.label(t)}</Pill>
          </h2>
          <p>{copy.text(t)}</p>
        </div>
        {source === 'site' && !editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button type='button' color='primary' outline borderRadius='8px' onClick={() => setEditing(true)}>{t('BUILDER_PUSH_REPLACE', 'Replace')}</Button>
            <Button type='button' color='secundary' borderRadius='8px' disabled={removing} onClick={() => setRemoveOpen(true)}>
              {removing ? t('BUILDER_PUSH_REMOVING', 'Removing…') : t('BUILDER_PUSH_REMOVE', 'Remove')}
            </Button>
          </div>
        )}
        {source === 'none' && !editing && (
          <Button type='button' color='primary' borderRadius='8px' onClick={() => setEditing(true)}>{t('BUILDER_PUSH_ADD', 'Add account')}</Button>
        )}
      </header>

      {firebase?.project_id && (
        <DetailsList style={{ padding: 0 }}>
          <div>
            <dt>{t('BUILDER_PUSH_FIREBASE_PROJECT', 'Firebase project')}</dt>
            <dd>{firebase.project_id}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_PUSH_SERVICE_ACCOUNT', 'Service account')}</dt>
            <dd>{firebase.client_email}</dd>
          </div>
        </DetailsList>
      )}

      {formOpen && (
        <FirebaseAccountForm
          key={source}
          saving={saving}
          saveFirebase={saveFirebase}
          onSaved={handleSaved}
          onCancel={editing ? () => setEditing(false) : null}
        />
      )}

      <Confirm
        open={removeOpen}
        width='min(480px, calc(100vw - 72px))'
        title={t('BUILDER_PUSH_REMOVE_TITLE', 'Remove its own Firebase account?')}
        acceptText={t('BUILDER_PUSH_REMOVE_ACCOUNT', 'Remove account')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={handleRemove}
        onCancel={() => setRemoveOpen(false)}
        onClose={() => setRemoveOpen(false)}
      >
        <p>
          {t('BUILDER_PUSH_REMOVE_HELP', 'Push notifications to _name_ go back to your project’s account right away, if it has one. If the app uses another Firebase project, they stop arriving.').replace('_name_', name)}
        </p>
      </Confirm>
    </PushCard>
  )
}

/** The Push notifications tab of the product detail. */
export const BuilderProductPushSettings = (props) => (
  <BuilderProductPushController {...props} UIComponent={BuilderProductPushUI} />
)
