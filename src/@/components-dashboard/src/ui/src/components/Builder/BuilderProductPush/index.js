import React, { useRef, useState } from 'react'

import { BuilderProductPush as BuilderProductPushController, ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, FileText } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, InlineNotice, Skeleton, StatusBadge, TextArea } from '../../Shared/Product'
import { getPushErrorMessage, parseServiceAccount } from '../utils'
import './builder-push.css'

// redesign B2: the push tab on Product pieces (StatusBadge, Button, InlineNotice, TextArea, ConfirmDialog,
// EmptyState, Skeleton) and builder-push.css. Same controller, states, texts, toasts and requests as main.

/** The look and words of each `source`. */
const SOURCES = {
  site: {
    family: 'done',
    label: (t) => t('BUILDER_PUSH_OWN_ACCOUNT', 'Own account'),
    text: (t) => t('BUILDER_PUSH_OWN_ACCOUNT_HELP', 'Push notifications to this app’s devices use its own Firebase account.')
  },
  project: {
    family: 'progress',
    label: (t) => t('BUILDER_PUSH_PROJECT_ACCOUNT', 'Project account'),
    text: (t) => t('BUILDER_PUSH_PROJECT_ACCOUNT_HELP', 'Push notifications to this app’s devices use your project’s Firebase account.')
  },
  none: {
    family: 'pending',
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
  const detected = account && (
    <span className='odc-bp-muted'>
      {t('BUILDER_PUSH_DETECTED', 'Firebase project _project_ · _email_')
        .replace('_project_', account.projectId)
        .replace('_email_', account.clientEmail)}
    </span>
  )

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
    <div className='odc-bp-editor'>
      <div className='odc-bp-intro'>
        <h3 id='builder-push-editor-title' className='odc-bp-subtitle'>{t('BUILDER_PUSH_USE_OWN', 'Use its own account')}</h3>
        <p className='odc-bp-muted'>{t('BUILDER_PUSH_USE_OWN_HELP', 'For an app with its own Firebase project. The private key is never shown again after you save it.')}</p>
      </div>

      {error && (
        <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{error}</InlineNotice>
      )}

      {!pasting && (
        <div className='odc-bp-file' data-invalid={error ? '' : undefined}>
          <div className='odc-bp-file-text'>
            {fileName
              ? (
                <>
                  <strong className='odc-bp-file-name'>
                    {/* redesign B2: Shared/Icon has no FileCheck; FileText stands for the chosen file */}
                    <FileText className='odc-icon' aria-hidden='true' />
                    {fileName}
                  </strong>
                  {detected}
                </>
                )
              : <span className='odc-bp-muted'>{t('BUILDER_PUSH_CHOOSE_HELP', 'The .json file Firebase downloads for a service account.')}</span>}
          </div>
          <Button onClick={() => fileRef.current?.click()}>
            {fileName ? t('BUILDER_PUSH_CHOOSE_ANOTHER', 'Choose another file') : t('BUILDER_PUSH_CHOOSE_FILE', 'Choose .json file')}
          </Button>
          <input
            ref={fileRef}
            type='file'
            hidden
            accept='.json,application/json'
            aria-label={t('BUILDER_PUSH_FILE', 'Service account file (.json)')}
            onChange={readFile}
          />
        </div>
      )}

      {pasting && (
        <div className='odc-bp-paste'>
          <TextArea
            label={t('BUILDER_PUSH_PASTE_LABEL', 'Content of the .json file')}
            className='odc-bp-paste-input'
            rows={8}
            value={text}
            spellCheck={false}
            invalid={!!error}
            onChange={(value) => { setText(value); setErrorCodes([]) }}
            onBlur={() => {
              const check = text ? parseServiceAccount(text) : null
              if (check?.errorCode) setErrorCodes([check.errorCode])
            }}
          />
          {detected}
        </div>
      )}

      <Button variant='link' size='sm' className='odc-bp-switch' onClick={switchMode}>
        {pasting ? t('BUILDER_PUSH_UPLOAD_INSTEAD', 'Upload the file instead') : t('BUILDER_PUSH_PASTE_INSTEAD', 'Paste the content instead')}
      </Button>

      <details className='odc-bp-help'>
        <summary>{t('BUILDER_PUSH_WHERE_FILE', 'Where do I get this file?')}</summary>
        <ol>
          <li>{t('BUILDER_PUSH_STEP_CONSOLE', 'Open the Firebase console and choose the app’s project.')}</li>
          <li>{t('BUILDER_PUSH_STEP_SETTINGS', 'Go to Project settings → Service accounts.')}</li>
          <li>{t('BUILDER_PUSH_STEP_GENERATE', 'Click Generate new private key and confirm. Firebase downloads a .json file.')}</li>
          <li>{t('BUILDER_PUSH_STEP_UPLOAD', 'Upload that file here. Keep it private: it lets anyone send pushes to your app.')}</li>
        </ol>
      </details>

      <div className='odc-bp-actions' data-align='end'>
        {onCancel && (
          <Button disabled={saving} onClick={onCancel}>{t('CANCEL', 'Cancel')}</Button>
        )}
        <Button variant='primary' disabled={saving || !account} onClick={save}>
          {saving ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_PUSH_SAVE', 'Save account')}
        </Button>
      </div>
    </div>
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
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        className='odc-bp-card'
        title={t('BUILDER_PUSH_LOAD_ERROR', 'We couldn’t load the push settings')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadPush}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }

  if (loading && !firebase) {
    return (
      <div className='odc-bp-card' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <Skeleton size='30%' block='var(--od-x-type-section-size)' />
        <Skeleton size='70%' />
        <Skeleton size='50%' />
        <Skeleton size='60%' />
      </div>
    )
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
    <section className='odc-root odc-bp-card' aria-labelledby='builder-push-firebase'>
      <header className='odc-bp-header'>
        <div className='odc-bp-intro'>
          <h2 id='builder-push-firebase' className='odc-bp-title'>
            Firebase{' '}
            <StatusBadge family={copy.family} label={copy.label(t)} />
          </h2>
          <p className='odc-bp-muted'>{copy.text(t)}</p>
        </div>
        {source === 'site' && !editing && (
          <div className='odc-bp-actions'>
            <Button onClick={() => setEditing(true)}>{t('BUILDER_PUSH_REPLACE', 'Replace')}</Button>
            <Button disabled={removing} onClick={() => setRemoveOpen(true)}>
              {removing ? t('BUILDER_PUSH_REMOVING', 'Removing…') : t('BUILDER_PUSH_REMOVE', 'Remove')}
            </Button>
          </div>
        )}
        {source === 'none' && !editing && (
          <Button variant='primary' onClick={() => setEditing(true)}>{t('BUILDER_PUSH_ADD', 'Add account')}</Button>
        )}
      </header>

      {firebase?.project_id && (
        <dl className='odc-bp-details'>
          <div>
            <dt>{t('BUILDER_PUSH_FIREBASE_PROJECT', 'Firebase project')}</dt>
            <dd>{firebase.project_id}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_PUSH_SERVICE_ACCOUNT', 'Service account')}</dt>
            <dd>{firebase.client_email}</dd>
          </div>
        </dl>
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

      <ConfirmDialog
        open={removeOpen}
        title={t('BUILDER_PUSH_REMOVE_TITLE', 'Remove its own Firebase account?')}
        confirmLabel={t('BUILDER_PUSH_REMOVE_ACCOUNT', 'Remove account')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={handleRemove}
        onCancel={() => setRemoveOpen(false)}
      >
        {t('BUILDER_PUSH_REMOVE_HELP', 'Push notifications to _name_ go back to your project’s account right away, if it has one. If the app uses another Firebase project, they stop arriving.').replace('_name_', name)}
      </ConfirmDialog>
    </section>
  )
}

/** The Push notifications tab of the product detail. */
export const BuilderProductPushSettings = (props) => (
  <BuilderProductPushController {...props} UIComponent={BuilderProductPushUI} />
)
