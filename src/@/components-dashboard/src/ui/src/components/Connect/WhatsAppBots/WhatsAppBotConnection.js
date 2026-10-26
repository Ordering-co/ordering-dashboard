import React, { useEffect, useId, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import { Check, ExclamationTriangle } from 'react-bootstrap-icons'
import {
  AUTH_BUSINESS_LOGIN,
  AUTH_MANUAL,
  chatbotMessagePayload,
  connectionStatus,
  digitsOnly,
  errorActionFor,
  formatWhatsAppPhone,
  isOrderingWebviewUrl,
  manualCredentialsPayload,
  missingManualFields
} from '../../../../../components/WhatsAppBotsList/botConnection'
import { ToastType, useLanguage, useToast } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Confirm } from '../../Shared'
import { FieldHelp } from './FieldHelp'
import { PinMissingConfirm } from './PinMissingConfirm'
import {
  AuthOption,
  AuthOptions,
  ConnectionActions,
  ConnectionBadge,
  ConnectionCard,
  BranchSelect,
  ConnectionSection,
  DangerButton,
  DiagnoseRow,
  ErrorBox,
  Field,
  FieldGrid,
  FieldHeading,
  Hint,
  InlineRow,
  Notice,
  PhoneLine,
  PinBar,
  ReasonText,
  RecommendedTag,
  SectionHeader,
  StatusRow,
  TextDanger,
  Warning
} from './styles'

const PIN_MASK = '••••••'
const TOKEN_MASK = '•'.repeat(40)

const reasonMessages = (t) => ({
  pending_oauth: t('WHATSAPP_ERROR_PENDING_OAUTH', 'Waiting for the WhatsApp connection.'),
  missing_access_token: t('WHATSAPP_ERROR_MISSING_ACCESS_TOKEN', 'The connection was lost. Connect the WhatsApp account again.'),
  invalid_access_token: t('WHATSAPP_ERROR_INVALID_ACCESS_TOKEN', 'The access token expired or is not valid. Connect again.'),
  revoked_by_user: t('WHATSAPP_ERROR_REVOKED_BY_USER', 'WhatsApp access was revoked from Meta. Connect again.'),
  auth_type_changed: t('WHATSAPP_ERROR_AUTH_TYPE_CHANGED', 'The connection method changed. Connect again.'),
  logged_out: t('WHATSAPP_ERROR_LOGGED_OUT', 'WhatsApp is disconnected.'),
  missing_phone_number_id: t('WHATSAPP_ERROR_MISSING_PHONE_NUMBER_ID', 'There is no phone number in the WhatsApp Business Account. Add one in Meta Business Manager and try again.'),
  missing_pin: t('WHATSAPP_ERROR_MISSING_PIN', 'A two-step verification PIN is needed to finish the registration.'),
  invalid_pin: t('WHATSAPP_ERROR_INVALID_PIN', 'The two-step verification PIN is not correct. Change the PIN and save it.'),
  pin_rate_limited: t('WHATSAPP_ERROR_PIN_RATE_LIMITED', 'Too many PIN attempts. Wait a few minutes and try again.'),
  phone_reverification_needed: t('WHATSAPP_ERROR_PHONE_REVERIFICATION_NEEDED', 'The phone number needs to be verified in Meta Business Manager.'),
  phone_not_registered: t('WHATSAPP_ERROR_PHONE_NOT_REGISTERED', 'The phone number is not registered on the WhatsApp Business Platform.'),
  certificate_error: t('WHATSAPP_ERROR_CERTIFICATE_ERROR', 'The phone could not be registered. Try again.'),
  account_blocked: t('WHATSAPP_ERROR_ACCOUNT_BLOCKED', 'Meta blocked the WhatsApp Business Account for policy violations.'),
  registration_failed: t('WHATSAPP_ERROR_REGISTRATION_FAILED', 'The phone could not be registered. Try again.'),
  pending_registration: t('WHATSAPP_ERROR_PENDING_REGISTRATION', 'The phone number is being registered. This can take a few minutes.'),
  registration_rate_limited: t('WHATSAPP_ERROR_REGISTRATION_RATE_LIMITED', 'Too many registration attempts for this number. Wait before trying again.')
})

const noticeMessages = (t) => ({
  success: {
    connect: t('WHATSAPP_CONNECT_SUCCESS', 'WhatsApp Business is connected.'),
    saveManual: t('WHATSAPP_CREDENTIALS_SAVED', 'The credentials were saved.'),
    savePin: t('WHATSAPP_PIN_SAVED', 'The PIN was saved.'),
    downloadPin: t('WHATSAPP_PIN_DOWNLOADED', 'The PIN was downloaded.'),
    verify: t('WHATSAPP_REGISTRATION_CHECKED', 'The registration was checked.'),
    doctor: t('WHATSAPP_DOCTOR_SUCCESS', 'The connection check finished.'),
    disconnect: t('WHATSAPP_DISCONNECT_SUCCESS', 'WhatsApp is disconnected.')
  },
  error: {
    connect: t('WHATSAPP_CONNECT_ERROR', 'The WhatsApp number could not be connected.'),
    saveManual: t('WHATSAPP_CREDENTIALS_ERROR', 'The credentials could not be saved.'),
    savePin: t('WHATSAPP_PIN_SAVE_ERROR', 'The PIN could not be saved.'),
    downloadPin: t('WHATSAPP_PIN_DOWNLOAD_ERROR', 'The PIN could not be downloaded.'),
    verify: t('WHATSAPP_REGISTRATION_ERROR', 'The registration could not be checked.'),
    doctor: t('WHATSAPP_DOCTOR_ERROR', 'The connection could not be repaired.'),
    disconnect: t('WHATSAPP_DISCONNECT_ERROR', 'The number could not be disconnected.'),
    pinFormat: t('WHATSAPP_PIN_FORMAT_ERROR', 'The PIN must be six digits.')
  }
})

const errorActionLabels = (t) => ({
  connect: t('WHATSAPP_CONNECT_BUTTON', 'Connect with WhatsApp Business'),
  reconnect: t('WHATSAPP_RECONNECT', 'Reconnect'),
  completeSetup: t('WHATSAPP_COMPLETE_SETUP', 'Complete setup'),
  diagnose: t('WHATSAPP_DIAGNOSE', 'Diagnose'),
  retry: t('RETRY', 'Retry'),
  connectAnother: t('WHATSAPP_CONNECT_ANOTHER', 'Connect another account'),
  checkStatus: t('WHATSAPP_CHECK_STATUS', 'Check status')
})

const LanguageField = ({ value, disabled, onChange, t }) => (
  <Field as='div' className='half'>
    {t('WHATSAPP_AGENT_LANGUAGE', 'Agent Default Language')}
    <BranchSelect
      aria-label={t('WHATSAPP_AGENT_LANGUAGE', 'Agent Default Language')}
      value={value}
      disabled={disabled}
      onChange={onChange}
    >
      <option value='en'>{t('WHATSAPP_BOT_LANGUAGE_EN', 'English')} (en)</option>
      <option value='es'>{t('WHATSAPP_BOT_LANGUAGE_ES', 'Spanish')} (es)</option>
      <option value='fr'>{t('WHATSAPP_BOT_LANGUAGE_FR', 'French')} (fr)</option>
      <option value='ar'>{t('WHATSAPP_BOT_LANGUAGE_AR', 'Arabic')} (ar)</option>
    </BranchSelect>
  </Field>
)

const draftFrom = (connection) => ({
  phoneNumberId: connection?.phoneNumberId || '',
  languageCode: connection?.languageCode || 'en',
  countryCode: connection?.countryCode || '',
  phoneNumber: connection?.phoneNumber || '',
  wabaId: connection?.wabaId || '',
  accessToken: '',
  welcomeMessage: connection?.welcomeMessage || '',
  fallbackSupportMessage: connection?.fallbackSupportMessage || '',
  webviewBaseUrl: connection?.webviewBaseUrl || ''
})

const formatDate = (value) => {
  if (!value) return null
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const ConnectionSkeleton = () => (
  <div aria-hidden='true'>
    <Skeleton height={60} borderRadius={8} count={2} style={{ marginBottom: 8 }} />
    <Skeleton height={32} width={200} borderRadius={8} />
  </div>
)

/**
 * WhatsApp number of the bot: status, credentials and PIN.
 * The test chat opens from the list. Behavior follows the AI dashboard's
 * WhatsAppAuthSection.
 */
export const WhatsAppBotConnection = (props) => {
  const {
    connectionState,
    connectWithMeta,
    reconnectAnother,
    saveManualCredentials,
    savePin,
    downloadPin,
    verifyRegistration,
    runDoctor,
    disconnect,
    reloadConnection
  } = props
  const { loading, error, connection, pending, notice } = connectionState || {}
  const [, t] = useLanguage()
  const toastApi = useToast()
  const showToast = toastApi?.[1]?.showToast
  const translateRef = useRef(t)
  const showToastRef = useRef(showToast)
  translateRef.current = t
  showToastRef.current = showToast
  const uid = useId()
  const [mode, setMode] = useState(connection?.authType || AUTH_BUSINESS_LOGIN)
  const [draft, setDraft] = useState(draftFrom(connection))
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState(null)
  const savedAuthRef = useRef(connection?.authType)

  useEffect(() => {
    const savedAuth = connection?.authType
    const authChanged = savedAuthRef.current !== savedAuth
    savedAuthRef.current = savedAuth
    setDraft(draftFrom(connection))
    setPin('')
    if (authChanged) setMode(savedAuth || AUTH_BUSINESS_LOGIN)
  }, [connection])

  useEffect(() => {
    if (!notice || notice.key !== 'doctor') return
    const notify = showToastRef.current
    if (typeof notify !== 'function') return
    const title = noticeMessages(translateRef.current)[notice.type]?.doctor
    const details = (notice.messages || []).map(item => String(item).trim()).filter(Boolean)
    const message = [title, ...details].filter(Boolean).join(' ')
    if (!message) return
    notify(notice.type === 'error' ? ToastType.Error : ToastType.Success, message, 5000)
  }, [notice])

  const status = connectionStatus(connection)
  const busy = Boolean(pending)
  const isBusinessLogin = mode === AUTH_BUSINESS_LOGIN
  const savedAsBusinessLogin = connection?.authType === AUTH_BUSINESS_LOGIN
  const phone = formatWhatsAppPhone(connection?.countryCode, connection?.phoneNumber)
  const errorAction = status === 'error' && savedAsBusinessLogin && isBusinessLogin
    ? errorActionFor(connection.misconfiguredReason)
    : null
  const canEditPin = isBusinessLogin && !connection?.configured && connection?.registrationStatus !== 'CONNECTED'
  const showSavedPin = isBusinessLogin && savedAsBusinessLogin && connection?.hasPin && connection?.registrationStatus
  const showVerify = isBusinessLogin && savedAsBusinessLogin && connection?.registrationStatus && connection.registrationStatus !== 'CONNECTED'
  const showDisconnect = status === 'connected' || (isBusinessLogin && savedAsBusinessLogin && Boolean(errorAction?.showDisconnect))

  const manualPayload = connection ? manualCredentialsPayload(connection, draft) : null
  const manualMissing = connection ? missingManualFields(connection, draft) : []
  const savedTokenVisible = connection?.authType === AUTH_MANUAL && connection?.hasAccessToken && !draft.accessToken
  const webviewUrlValid = isOrderingWebviewUrl(draft.webviewBaseUrl)
  const canSaveManual = !busy && Boolean(manualPayload) && manualMissing.length === 0 && webviewUrlValid
  const copyPayload = savedAsBusinessLogin ? chatbotMessagePayload(connection, draft) : null
  const canSaveCopy = !busy && Boolean(copyPayload) && webviewUrlValid
  const showOAuthIdentity = isBusinessLogin && status === 'connected'
  const businessValues = savedAsBusinessLogin
    ? draft
    : {
        phoneNumberId: '',
        countryCode: '',
        phoneNumber: '',
        wabaId: '',
        welcomeMessage: '',
        fallbackSupportMessage: '',
        webviewBaseUrl: ''
      }

  const reasonMessage = (reason) => reasonMessages(t)[reason] || t('WHATSAPP_STATUS_ERROR', 'Configuration error')
  const updateDraft = (key, value) => setDraft(prev => ({ ...prev, [key]: value }))

  const startConnect = () => {
    if (!pin) {
      setConfirm('noPin')
      return
    }
    connectWithMeta({ pin })
  }

  const runErrorAction = () => {
    if (!errorAction) return
    if (errorAction.action === 'connect') startConnect()
    if (errorAction.action === 'doctor') runDoctor()
    if (errorAction.action === 'verify') verifyRegistration()
    if (errorAction.action === 'reconnectAnother') reconnectAnother()
  }

  const chooseMode = (next) => {
    if (busy || next === mode) return
    if (next === AUTH_MANUAL && savedAsBusinessLogin && connection?.configured) {
      setConfirm('toManual')
      return
    }
    setMode(next)
  }

  const closeConfirm = () => setConfirm(null)

  const statusLabel = {
    connected: t('WHATSAPP_STATUS_CONNECTED', 'Connected'),
    error: t('WHATSAPP_STATUS_ERROR', 'Configuration error'),
    notConnected: t('WHATSAPP_STATUS_NOT_CONNECTED', 'Not connected')
  }[status]

  const noticeText = notice && notice.key !== 'doctor' && noticeMessages(t)[notice.type]?.[notice.key]
  const connectedDisconnect = isBusinessLogin && showDisconnect && status === 'connected'
    ? (
      <TextDanger type='button' disabled={busy} onClick={() => setConfirm('disconnect')}>
        {pending === 'disconnect' ? t('WHATSAPP_DISCONNECTING', 'Disconnecting') : t('WHATSAPP_DISCONNECT', 'Disconnect')}
      </TextDanger>
      )
    : null

  return (
    <ConnectionSection aria-labelledby={`${uid}-title`}>
      <SectionHeader>
        <h3 id={`${uid}-title`}>{t('WHATSAPP_CHANNEL_SETTINGS', 'WhatsApp Bot channel settings')}</h3>
      </SectionHeader>

      {loading && <ConnectionSkeleton />}

      {error && !connection && (
        <ErrorBox role='alert' style={{ marginTop: 0 }}>
          <p>{t('WHATSAPP_CONNECTION_LOAD_ERROR', 'The WhatsApp connection could not be loaded.')}</p>
          <Button color='primary' borderRadius='8px' onClick={reloadConnection}>
            {t('RETRY', 'Retry')}
          </Button>
        </ErrorBox>
      )}

      {noticeText && (
        <Notice type={notice.type} role={notice.type === 'error' ? 'alert' : 'status'}>
          {noticeText}
          {notice.messages?.length > 0 && (
            <ul>{notice.messages.map((message, index) => <li key={index}>{message}</li>)}</ul>
          )}
        </Notice>
      )}

      {connection && !loading && (
        <>
          <AuthOptions disabled={busy}>
            <legend>{t('WHATSAPP_AUTH_METHOD', 'Connection method')}</legend>
            <AuthOption checked={isBusinessLogin} disabled={busy}>
              <input
                type='radio'
                name={`${uid}-auth`}
                checked={isBusinessLogin}
                onChange={() => chooseMode(AUTH_BUSINESS_LOGIN)}
              />
              <span>
                <span className='option-title'>
                  {t('WHATSAPP_AUTH_BUSINESS_LOGIN', 'WhatsApp Business Login')}
                  <RecommendedTag>{t('WHATSAPP_AUTH_RECOMMENDED', 'recommended')}</RecommendedTag>
                </span>
                <span className='option-description'>{t('WHATSAPP_AUTH_BUSINESS_LOGIN_DESCRIPTION', 'Connect via Meta OAuth')}</span>
              </span>
            </AuthOption>
            <AuthOption checked={!isBusinessLogin} disabled={busy}>
              <input
                type='radio'
                name={`${uid}-auth`}
                checked={!isBusinessLogin}
                onChange={() => chooseMode(AUTH_MANUAL)}
              />
              <span>
                <span className='option-title'>{t('WHATSAPP_AUTH_MANUAL', 'Manual credentials')}</span>
                <span className='option-description'>{t('WHATSAPP_AUTH_MANUAL_DESCRIPTION', 'Enter your WhatsApp Business API credentials.')}</span>
              </span>
            </AuthOption>
          </AuthOptions>

          <ConnectionCard>
            <StatusRow>
              <ConnectionBadge status={status}>
                {status === 'connected' && <Check aria-hidden size={12} />}
                {statusLabel}
              </ConnectionBadge>
              {connectedDisconnect}
            </StatusRow>
            {status === 'error' && <ReasonText>{reasonMessage(connection.misconfiguredReason)}</ReasonText>}

          {isBusinessLogin && (
            <>
              {status === 'connected' && (phone || formatDate(connection.connectedAt)) && (
                <PhoneLine>
                  {phone && <><span>{t('WHATSAPP_PHONE', 'Phone number')}: </span><strong>{phone}</strong></>}
                  {phone && formatDate(connection.connectedAt) && ' · '}
                  {formatDate(connection.connectedAt) && <><span>{t('WHATSAPP_CONNECTED_ON', 'Connected on')}: </span><strong>{formatDate(connection.connectedAt)}</strong></>}
                </PhoneLine>
              )}

              {status === 'connected' && (
                <DiagnoseRow>
                  <span>{t('WHATSAPP_DIAGNOSE_MESSAGE', 'Having issues with your WhatsApp connection?')}</span>
                  <Button type='button' outline color='primary' borderRadius='8px' disabled={busy} onClick={runDoctor}>
                    {pending === 'doctor' ? t('WHATSAPP_PROCESSING', 'Processing') : t('WHATSAPP_DIAGNOSE', 'Diagnose')}
                  </Button>
                </DiagnoseRow>
              )}

              {showSavedPin && (
                <PinBar>
                  <span className='pin-value'>
                    <span>{t('WHATSAPP_PIN', 'Two-step verification PIN')}</span>
                    <span aria-label={t('WHATSAPP_PIN', 'Two-step verification PIN')}>{PIN_MASK}</span>
                    {!connection.pinDownloaded && (
                      <ExclamationTriangle
                        role='img'
                        aria-label={t('WHATSAPP_PIN_NOT_DOWNLOADED', 'The PIN has not been downloaded yet')}
                        color='#B88A00'
                      />
                    )}
                  </span>
                  <Button type='button' outline color='primary' borderRadius='8px' disabled={busy} onClick={downloadPin}>
                    {pending === 'downloadPin' ? t('WHATSAPP_DOWNLOADING', 'Downloading') : t('WHATSAPP_DOWNLOAD_PIN', 'Download PIN')}
                  </Button>
                </PinBar>
              )}

              {canEditPin && !showSavedPin && (
                <div>
                  <FieldHeading>
                    <Field htmlFor={`${uid}-pin`}>{t('WHATSAPP_PIN', 'Two-step verification PIN')}</Field>
                    <FieldHelp
                      label={t('WHATSAPP_PIN', 'Two-step verification PIN')}
                      text={t('WHATSAPP_PIN_HINT', 'Six digits. If you leave it empty, Meta registration uses a generated PIN that you can download later.')}
                    />
                  </FieldHeading>
                  <InlineRow style={{ marginTop: 6 }}>
                    <Input
                      id={`${uid}-pin`}
                      type='password'
                      inputMode='numeric'
                      autoComplete='new-password'
                      maxLength={6}
                      value={pin}
                      disabled={busy}
                      placeholder={connection.hasPin ? PIN_MASK : ''}
                      style={{ flex: 1, minWidth: 0 }}
                      onChange={(event) => setPin(digitsOnly(event.target.value).slice(0, 6))}
                    />
                    {savedAsBusinessLogin && connection.hasAccessToken && (
                      <Button
                        type='button'
                        color='primary'
                        borderRadius='8px'
                        disabled={busy || pin.length !== 6}
                        onClick={() => savePin(pin)}
                      >
                        {pending === 'savePin' ? t('WHATSAPP_BOT_SAVING', 'Saving') : t('WHATSAPP_SAVE_PIN', 'Save PIN')}
                      </Button>
                    )}
                  </InlineRow>
                </div>
              )}

              <ConnectionActions>
                {status === 'notConnected' && (
                  <Button type='button' color='primary' borderRadius='8px' disabled={busy} onClick={startConnect}>
                    {pending === 'connect' ? t('WHATSAPP_CONNECTING', 'Connecting') : t('WHATSAPP_CONNECT_BUTTON', 'Connect with WhatsApp Business')}
                  </Button>
                )}
                {errorAction && (
                  <Button type='button' color='primary' borderRadius='8px' disabled={busy} onClick={runErrorAction}>
                    {busy ? t('WHATSAPP_PROCESSING', 'Processing') : errorActionLabels(t)[errorAction.label]}
                  </Button>
                )}
                {showDisconnect && status !== 'connected' && (
                  <DangerButton type='button' disabled={busy} onClick={() => setConfirm('disconnect')}>
                    {pending === 'disconnect' ? t('WHATSAPP_DISCONNECTING', 'Disconnecting') : t('WHATSAPP_DISCONNECT', 'Disconnect')}
                  </DangerButton>
                )}
                {showVerify && (
                  <Button type='button' outline color='primary' borderRadius='8px' disabled={busy} onClick={verifyRegistration}>
                    {pending === 'verify'
                      ? t('WHATSAPP_VERIFYING', 'Verifying')
                      : ['FLAGGED', 'RESTRICTED'].includes(connection.registrationStatus)
                          ? t('WHATSAPP_REFRESH_STATUS', 'Refresh status')
                          : t('WHATSAPP_VERIFY_REGISTRATION', 'Verify registration')}
                  </Button>
                )}
              </ConnectionActions>
            </>
          )}

          {!isBusinessLogin && (
            <>
              <FieldGrid>
                <Field className='half'>
                  {t('WHATSAPP_PHONE_NUMBER_ID', 'Phone number ID')}
                  <Input
                    inputMode='numeric'
                    value={draft.phoneNumberId}
                    disabled={busy}
                    onChange={(event) => updateDraft('phoneNumberId', digitsOnly(event.target.value))}
                  />
                </Field>
                <LanguageField
                  value={draft.languageCode}
                  disabled={busy}
                  onChange={(event) => updateDraft('languageCode', event.target.value)}
                  t={t}
                />
                <Field className='half'>
                  {t('WHATSAPP_COUNTRY_CODE', 'Country code')}
                  <Input
                    inputMode='numeric'
                    maxLength={3}
                    value={draft.countryCode}
                    disabled={busy}
                    onChange={(event) => updateDraft('countryCode', digitsOnly(event.target.value))}
                  />
                </Field>
                <Field className='half'>
                  {t('WHATSAPP_PHONE', 'Phone number')}
                  <Input
                    inputMode='numeric'
                    maxLength={12}
                    value={draft.phoneNumber}
                    disabled={busy}
                    onChange={(event) => updateDraft('phoneNumber', digitsOnly(event.target.value))}
                  />
                </Field>
                <Field className='half'>
                  {t('WHATSAPP_ACCESS_TOKEN', 'Access token')}
                  <Input
                    type='password'
                    autoComplete='new-password'
                    spellCheck={false}
                    maxLength={512}
                    value={savedTokenVisible ? TOKEN_MASK : draft.accessToken}
                    disabled={busy}
                    onFocus={(event) => {
                      if (savedTokenVisible) event.target.select()
                    }}
                    onChange={(event) => {
                      const raw = event.target.value
                      const next = raw === TOKEN_MASK ? '' : raw.replaceAll(TOKEN_MASK, '')
                      updateDraft('accessToken', next)
                    }}
                  />
                </Field>
                <Field className='half'>
                  {t('WHATSAPP_WABA_ID', 'WhatsApp Business Account ID')}
                  <Input
                    value={draft.wabaId}
                    disabled={busy}
                    onChange={(event) => updateDraft('wabaId', event.target.value)}
                  />
                </Field>
                <Field className='half'>
                  {t('WHATSAPP_WELCOME_MESSAGE', 'Welcome message')}
                  <Input
                    maxLength={2000}
                    value={draft.welcomeMessage}
                    disabled={busy}
                    onChange={(event) => updateDraft('welcomeMessage', event.target.value)}
                  />
                </Field>
                <Field className='half'>
                  {t('WHATSAPP_FALLBACK_MESSAGE', 'Fallback support message')}
                  <Input
                    maxLength={2000}
                    value={draft.fallbackSupportMessage}
                    disabled={busy}
                    onChange={(event) => updateDraft('fallbackSupportMessage', event.target.value)}
                  />
                </Field>
                <Field>
                  {t('WHATSAPP_WEBVIEW_URL', 'Ordering webview URL')}
                  <Input
                    type='url'
                    inputMode='url'
                    maxLength={500}
                    spellCheck={false}
                    value={draft.webviewBaseUrl}
                    disabled={busy}
                    onChange={(event) => updateDraft('webviewBaseUrl', event.target.value)}
                  />
                  {!webviewUrlValid && (
                    <Hint>{t('WHATSAPP_WEBVIEW_URL_INVALID', 'Use a full address, like https://example.com.')}</Hint>
                  )}
                </Field>
              </FieldGrid>
              {!(connection.authType === AUTH_MANUAL && connection.hasAccessToken) && (
                <Hint>{t('WHATSAPP_MANUAL_HINT', 'All fields are required. The API checks them with Meta before saving.')}</Hint>
              )}
              <ConnectionActions>
                <Button
                  type='button'
                  color='primary'
                  borderRadius='8px'
                  disabled={!canSaveManual}
                  onClick={() => saveManualCredentials(manualPayload)}
                >
                  {pending === 'saveManual' ? t('WHATSAPP_BOT_SAVING', 'Saving') : t('WHATSAPP_SAVE_CREDENTIALS', 'Save credentials')}
                </Button>
              </ConnectionActions>
            </>
          )}
          </ConnectionCard>

          {mode !== connection.authType && (
            <Warning>
              <ExclamationTriangle aria-hidden size={18} />
              <span>
                {t('WHATSAPP_AUTH_CHANGE_WARNING', 'Changing the authentication method may cause the agent to stop working with the current configuration. If you start a new configuration, make sure to complete it.')}
              </span>
            </Warning>
          )}

          {isBusinessLogin && (
            <FieldGrid>
              <LanguageField
                value={draft.languageCode}
                disabled={busy}
                onChange={(event) => updateDraft('languageCode', event.target.value)}
                t={t}
              />
              {showOAuthIdentity && (
                <>
                  <Field className='half'>
                    {t('WHATSAPP_PHONE_NUMBER_ID', 'Phone number ID')}
                    <Input readOnly value={businessValues.phoneNumberId} />
                  </Field>
                  <Field className='half'>
                    {t('WHATSAPP_COUNTRY_CODE', 'Country code')}
                    <Input readOnly value={businessValues.countryCode} />
                  </Field>
                  <Field className='half'>
                    {t('WHATSAPP_PHONE', 'Phone number')}
                    <Input readOnly value={businessValues.phoneNumber} />
                  </Field>
                </>
              )}
              <Field className='half'>
                {t('WHATSAPP_WELCOME_MESSAGE', 'Welcome message')}
                <Input
                  maxLength={2000}
                  value={businessValues.welcomeMessage}
                  disabled={busy || !savedAsBusinessLogin}
                  onChange={(event) => updateDraft('welcomeMessage', event.target.value)}
                />
              </Field>
              <Field className='half'>
                {t('WHATSAPP_FALLBACK_MESSAGE', 'Fallback support message')}
                <Input
                  maxLength={2000}
                  value={businessValues.fallbackSupportMessage}
                  disabled={busy || !savedAsBusinessLogin}
                  onChange={(event) => updateDraft('fallbackSupportMessage', event.target.value)}
                />
              </Field>
              <Field className='half'>
                {t('WHATSAPP_WEBVIEW_URL', 'Ordering webview URL')}
                <Input
                  type='url'
                  inputMode='url'
                  maxLength={500}
                  spellCheck={false}
                  value={businessValues.webviewBaseUrl}
                  disabled={busy || !savedAsBusinessLogin}
                  onChange={(event) => updateDraft('webviewBaseUrl', event.target.value)}
                />
                {savedAsBusinessLogin && !webviewUrlValid && (
                  <Hint>{t('WHATSAPP_WEBVIEW_URL_INVALID', 'Use a full address, like https://example.com.')}</Hint>
                )}
              </Field>
              {savedAsBusinessLogin && (
                <ConnectionActions>
                  <Button
                    type='button'
                    color='primary'
                    borderRadius='8px'
                    disabled={!canSaveCopy}
                    onClick={() => saveManualCredentials(copyPayload)}
                  >
                    {pending === 'saveManual' ? t('WHATSAPP_BOT_SAVING', 'Saving') : t('WHATSAPP_BOT_SAVE', 'Save')}
                  </Button>
                </ConnectionActions>
              )}
            </FieldGrid>
          )}
        </>
      )}

      <PinMissingConfirm
        open={confirm === 'noPin'}
        onContinue={() => {
          closeConfirm()
          connectWithMeta({ pin: '' })
        }}
        onChangePin={closeConfirm}
        onClose={closeConfirm}
      />
      <Confirm
        open={confirm === 'toManual'}
        title={t('WHATSAPP_TO_MANUAL_TITLE', 'Change to manual credentials?')}
        content={t('WHATSAPP_TO_MANUAL_MESSAGE', 'Saving manual credentials replaces the Meta connection. Download the PIN first if you have not.')}
        acceptText={t('WHATSAPP_TO_MANUAL_CONFIRM', 'Change to manual')}
        cancelText={t('WHATSAPP_KEEP_BUSINESS_LOGIN', 'Keep Business Login')}
        onAccept={() => {
          closeConfirm()
          setMode(AUTH_MANUAL)
        }}
        onCancel={closeConfirm}
        onClose={closeConfirm}
        closeOnBackdrop={false}
      />
      <Confirm
        open={confirm === 'disconnect'}
        title={t('WHATSAPP_DISCONNECT_TITLE', 'Disconnect this WhatsApp number?')}
        content={t('WHATSAPP_DISCONNECT_MESSAGE', 'The credentials and the PIN are removed, and the bot stops answering until you connect it again.')}
        acceptText={t('WHATSAPP_DISCONNECT', 'Disconnect')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={() => {
          closeConfirm()
          disconnect()
        }}
        onCancel={closeConfirm}
        onClose={closeConfirm}
        closeOnBackdrop={false}
      />
    </ConnectionSection>
  )
}
