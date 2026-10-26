import React, { useEffect, useId, useState } from 'react'
import { ExclamationTriangle, Whatsapp } from 'react-bootstrap-icons'
import { chosenBranchMode, chosenLanguageCode, createBotPayload } from '../../../../../components/WhatsAppBotsList/botCreate'
import { digitsOnly } from '../../../../../components/WhatsAppBotsList/botConnection'
import { ToastType, useLanguage, useToast } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { ToggleSwitchContainer, Slider } from '../../../styles/Switch/styles'
import { SideBar } from '../../Shared'
import { BrandSelect } from './BrandSelect'
import { FieldHelp } from './FieldHelp'
import { PinMissingConfirm } from './PinMissingConfirm'
import { ColorField, SettingsSkeleton } from './WhatsAppBotPanel'
import {
  PanelBody,
  PanelTitle,
  Field,
  Hint,
  BranchSelect,
  PanelActions,
  ErrorBox,
  ConnectionCard,
  ConnectionSection,
  SectionHeader,
  SectionDescription,
  SectionLabel,
  ColorPair,
  AuthOptions,
  AuthOption,
  RecommendedTag,
  FieldGrid,
  FieldHeading,
  ConnectionBadge,
  ConnectBlock,
  EnableRow,
  Warning
} from './styles'

const DEFAULT_PRIMARY = '#c4271b'
const DEFAULT_SECONDARY = '#ffc72c'
const AUTH_MANUAL = 'manual'
const AUTH_BUSINESS_LOGIN = 'business_login'

const LabeledField = ({ label, help, className = 'half', children }) => (
  <Field as='div' className={className}>
    <FieldHeading>
      <span>{label}</span>
      {help ? <FieldHelp label={label} text={help} /> : null}
    </FieldHeading>
    {children}
  </Field>
)

const emptyDraft = () => ({
  franchiseId: '',
  languageCode: '',
  enabled: false,
  branchSelectionMode: 'auto',
  primaryColor: '',
  secondaryColor: '',
  authType: '',
  phoneNumberId: '',
  countryCode: '',
  phoneNumber: '',
  accessToken: '',
  wabaId: '',
  welcomeMessage: '',
  fallbackSupportMessage: '',
  webviewBaseUrl: '',
  pin: ''
})

export const WhatsAppBotCreate = (props) => {
  const { open, brandsState, createState, loadBrands, loadMoreBrands, createBot, onCreated, onClose } = props
  const { loading, loaded, error, brands, loadingMore = false, hasNextPage = false } = brandsState
  const [, t] = useLanguage()
  const toastApi = useToast()
  const showToast = toastApi?.[1]?.showToast
  const uid = useId()
  const [draft, setDraft] = useState(emptyDraft)
  const [pinPrompt, setPinPrompt] = useState(false)

  useEffect(() => {
    if (!open) return
    setDraft(emptyDraft())
    setPinPrompt(false)
    loadBrands()
  }, [open])

  if (!open) return null

  const update = (key, value) => setDraft(prev => ({ ...prev, [key]: value }))
  const ready = Boolean(createBotPayload(draft))
  const saving = Boolean(createState.saving)
  const isManual = draft.authType === AUTH_MANUAL
  const isBusinessLogin = draft.authType === AUTH_BUSINESS_LOGIN
  const basicsReady = Boolean(draft.franchiseId) && Boolean(chosenLanguageCode(draft.languageCode)) && Boolean(chosenBranchMode(draft.branchSelectionMode))

  const notify = (message) => showToast?.(ToastType.Info, message, 5000)

  const createAndClose = async () => {
    const created = await createBot(draft)
    if (!created) return
    onCreated?.(draft, created)
    onClose()
  }

  const connect = async () => {
    if (saving) return
    if (!ready) {
      notify(t('WHATSAPP_WEBVIEW_URL_INVALID', 'Use a full address, like https://example.com.'))
      return
    }
    if (!draft.pin) {
      setPinPrompt(true)
      return
    }
    await createAndClose()
  }

  const submit = async (event) => {
    event.preventDefault()
    if (saving) return
    if (isBusinessLogin) {
      notify(t('WHATSAPP_BOT_USE_CONNECT', 'Use Connect with WhatsApp Business to create this bot.'))
      return
    }
    if (!ready) return
    await createAndClose()
  }

  return (
    <SideBar open={open} onClose={onClose} defaultSideBarWidth={640} sidebarId='whatsapp_bot_create'>
      <PanelBody as='form' onSubmit={submit}>
        <PanelTitle>{t('ADD_WHATSAPP_BOT', 'Add WhatsApp bot')}</PanelTitle>
        {(loading || !loaded) && !error && <SettingsSkeleton />}
        {error && (
          <ErrorBox role='alert'>
            <p>{t('WHATSAPP_BOT_BRANDS_ERROR', 'The brands could not be loaded.')} {error.map(code => t(code, code)).join(', ')}</p>
            <Button type='button' color='primary' borderRadius='8px' onClick={loadBrands}>
              {t('RETRY', 'Retry')}
            </Button>
          </ErrorBox>
        )}
        {loaded && !loading && !error && brands.length === 0 && (
          <Hint>{t('WHATSAPP_BOT_NO_BRANDS', 'There are no brands yet.')}</Hint>
        )}
        {loaded && !loading && !error && brands.length > 0 && (
          <>
            <Field as='div'>
              {t('WHATSAPP_BOT_BRAND', 'Brand')}
              <BrandSelect
                aria-label={t('WHATSAPP_BOT_BRAND', 'Brand')}
                value={draft.franchiseId}
                brands={brands}
                loading={loading}
                loadingMore={loadingMore}
                hasNextPage={hasNextPage}
                onLoadMore={loadMoreBrands}
                placeholder={t('WHATSAPP_BOT_SELECT_BRAND', 'Select a brand')}
                loadingLabel={t('WHATSAPP_BOT_BRANDS_LOADING', 'Loading brands...')}
                loadingMoreLabel={t('WHATSAPP_BOT_BRANDS_LOADING_MORE', 'Loading more brands...')}
                disabledLabel={t('WHATSAPP_BOT_BRAND_DISABLED_LABEL', 'Disabled')}
                onChange={(franchiseId) => update('franchiseId', franchiseId)}
              />
            </Field>
            <EnableRow>
              <span>{t('WHATSAPP_ENABLE_AGENT', 'Enable Agent')}</span>
              <ToggleSwitchContainer>
                <input
                  type='checkbox'
                  aria-label={t('WHATSAPP_ENABLE_AGENT', 'Enable Agent')}
                  checked={draft.enabled}
                  onChange={(event) => update('enabled', event.target.checked)}
                />
                <Slider />
              </ToggleSwitchContainer>
            </EnableRow>
            <Field as='div'>
              {t('WHATSAPP_BOT_BRANCH_LABEL', 'Branch selection')}
              <BranchSelect
                aria-label={t('WHATSAPP_BOT_BRANCH_LABEL', 'Branch selection')}
                value={draft.branchSelectionMode}
                onChange={(event) => update('branchSelectionMode', event.target.value)}
              >
                <option value='auto'>{t('WHATSAPP_BOT_BRANCH_AUTO', 'Pick the closest open store')}</option>
                <option value='marketplace'>{t('WHATSAPP_BOT_BRANCH_MARKETPLACE', 'Let the customer choose the store')}</option>
              </BranchSelect>
              {draft.branchSelectionMode === 'marketplace' && (
                <Hint>{t('WHATSAPP_BOT_BRANCH_MARKETPLACE_HINT', 'The agent lists the branches that serve the address so the customer chooses.')}</Hint>
              )}
              {draft.branchSelectionMode === 'auto' && (
                <Hint>{t('WHATSAPP_BOT_BRANCH_AUTO_HINT', 'The agent picks the closest open branch that serves the address.')}</Hint>
              )}
            </Field>
            <Field as='div'>
              <FieldHeading>
                <span>{t('WHATSAPP_AGENT_LANGUAGE', 'Agent Default Language')}</span>
                <FieldHelp
                  label={t('WHATSAPP_AGENT_LANGUAGE', 'Agent Default Language')}
                  text={t('WHATSAPP_LANGUAGE_HINT', 'Language code for the agent')}
                />
              </FieldHeading>
              <BranchSelect
                aria-label={t('WHATSAPP_AGENT_LANGUAGE', 'Agent Default Language')}
                value={draft.languageCode}
                onChange={(event) => update('languageCode', event.target.value)}
              >
                <option value=''>{t('WHATSAPP_BOT_SELECT_LANGUAGE', 'Select a language')}</option>
                <option value='en'>{t('WHATSAPP_BOT_LANGUAGE_EN', 'English')} (en)</option>
                <option value='es'>{t('WHATSAPP_BOT_LANGUAGE_ES', 'Spanish')} (es)</option>
                <option value='fr'>{t('WHATSAPP_BOT_LANGUAGE_FR', 'French')} (fr)</option>
                <option value='ar'>{t('WHATSAPP_BOT_LANGUAGE_AR', 'Arabic')} (ar)</option>
              </BranchSelect>
            </Field>
            <ConnectionCard>
              <SectionLabel>{t('WHATSAPP_WEBVIEW_COLORS', 'WhatsApp webview colors')}</SectionLabel>
              <ColorPair>
                <ColorField
                  label={t('WHATSAPP_BOT_PRIMARY_COLOR', 'Primary color')}
                  value={draft.primaryColor}
                  fallback={DEFAULT_PRIMARY}
                  onChange={(value) => update('primaryColor', value)}
                />
                <ColorField
                  label={t('WHATSAPP_BOT_SECONDARY_COLOR', 'Secondary color')}
                  value={draft.secondaryColor}
                  fallback={DEFAULT_SECONDARY}
                  onChange={(value) => update('secondaryColor', value)}
                />
              </ColorPair>
              <Hint>{t('WHATSAPP_BOT_COLOR_HINT', 'Six characters, like #c4271b. Clear the field to use the default.')}</Hint>
            </ConnectionCard>
            {basicsReady && <ConnectionSection aria-labelledby={`${uid}-channel`}>
              <SectionHeader>
                <h3 id={`${uid}-channel`}>{t('WHATSAPP_CHANNEL_SETTINGS', 'WhatsApp Bot channel settings')}</h3>
                <SectionDescription>
                  {t('WHATSAPP_CHANNEL_DESCRIPTION', 'Guided WhatsApp ordering with buttons and a webview, without AI.')}
                </SectionDescription>
              </SectionHeader>
              <AuthOptions>
                <legend>{t('WHATSAPP_AUTHENTICATION_METHOD', 'Authentication Method')}</legend>
                <AuthOption checked={isBusinessLogin}>
                  <input
                    type='radio'
                    name={`${uid}-auth`}
                    checked={isBusinessLogin}
                    onChange={() => update('authType', AUTH_BUSINESS_LOGIN)}
                  />
                  <span>
                    <span className='option-title'>
                      {t('WHATSAPP_AUTH_BUSINESS_LOGIN', 'WhatsApp Business Login')}
                      <RecommendedTag>{t('WHATSAPP_AUTH_RECOMMENDED', 'recommended')}</RecommendedTag>
                    </span>
                    <span className='option-description'>{t('WHATSAPP_AUTH_BUSINESS_LOGIN_DESCRIPTION', 'Connect via Meta OAuth')}</span>
                  </span>
                </AuthOption>
                <AuthOption checked={isManual}>
                  <input
                    type='radio'
                    name={`${uid}-auth`}
                    checked={isManual}
                    onChange={() => update('authType', AUTH_MANUAL)}
                  />
                  <span>
                    <span className='option-title'>{t('WHATSAPP_AUTH_MANUAL', 'Manual credentials')}</span>
                    <span className='option-description'>{t('WHATSAPP_AUTH_MANUAL_DESCRIPTION', 'Enter your WhatsApp Business API credentials.')}</span>
                  </span>
                </AuthOption>
              </AuthOptions>
              {isManual && (
                <Warning>
                  <ExclamationTriangle aria-hidden size={18} color='#B88A00' />
                  <span>
                    {t('WHATSAPP_AUTH_CHANGE_WARNING', 'Changing the authentication method may cause the agent to stop working with the current configuration. If you start a new configuration, make sure to complete it.')}
                  </span>
                </Warning>
              )}
              {isBusinessLogin && (
                <ConnectBlock>
                  <ConnectionBadge>{t('WHATSAPP_STATUS_NOT_CONNECTED', 'Not connected')}</ConnectionBadge>
                  <Button type='button' color='primary' borderRadius='8px' disabled={saving} onClick={connect}>
                    <Whatsapp aria-hidden='true' style={{ marginRight: 8 }} />
                    {saving
                      ? t('WHATSAPP_CONNECTING', 'Connecting')
                      : t('WHATSAPP_CONNECT_BUTTON', 'Connect with WhatsApp Business')}
                  </Button>
                </ConnectBlock>
              )}
              {draft.authType && (
                <FieldGrid>
                  {isManual && (
                    <>
                      <LabeledField label={t('WHATSAPP_PHONE_NUMBER_ID', 'Phone number ID')} help={t('WHATSAPP_PHONE_ID_HINT', 'Meta phone number ID for this WhatsApp line')}>
                        <Input
                          inputMode='numeric'
                          aria-label={t('WHATSAPP_PHONE_NUMBER_ID', 'Phone number ID')}
                          value={draft.phoneNumberId}
                          onChange={(event) => update('phoneNumberId', digitsOnly(event.target.value))}
                        />
                      </LabeledField>
                      <LabeledField label={t('WHATSAPP_COUNTRY_CODE', 'Country code')} help={t('WHATSAPP_COUNTRY_HINT', 'Phone number country code, such as 1 for the US or 44 for the UK')}>
                        <Input
                          inputMode='numeric'
                          maxLength={3}
                          aria-label={t('WHATSAPP_COUNTRY_CODE', 'Country code')}
                          value={draft.countryCode}
                          onChange={(event) => update('countryCode', digitsOnly(event.target.value))}
                        />
                      </LabeledField>
                      <LabeledField label={t('WHATSAPP_PHONE', 'Phone number')} help={t('WHATSAPP_PHONE_HINT', 'WhatsApp Business phone number without the country code')}>
                        <Input
                          inputMode='numeric'
                          maxLength={12}
                          aria-label={t('WHATSAPP_PHONE', 'Phone number')}
                          value={draft.phoneNumber}
                          onChange={(event) => update('phoneNumber', digitsOnly(event.target.value))}
                        />
                      </LabeledField>
                      <LabeledField label={t('WHATSAPP_ACCESS_TOKEN', 'Access token')} help={t('WHATSAPP_TOKEN_HINT', 'WhatsApp Business API access token')}>
                        <Input
                          type='password'
                          autoComplete='new-password'
                          spellCheck={false}
                          maxLength={512}
                          aria-label={t('WHATSAPP_ACCESS_TOKEN', 'Access token')}
                          value={draft.accessToken}
                          onChange={(event) => update('accessToken', event.target.value)}
                        />
                      </LabeledField>
                      <LabeledField label={t('WHATSAPP_WABA_ID', 'WhatsApp Business Account ID')} help={t('WHATSAPP_WABA_HINT', 'WhatsApp Business Account ID')}>
                        <Input
                          aria-label={t('WHATSAPP_WABA_ID', 'WhatsApp Business Account ID')}
                          value={draft.wabaId}
                          onChange={(event) => update('wabaId', event.target.value)}
                        />
                      </LabeledField>
                    </>
                  )}
                  {isBusinessLogin && (
                    <LabeledField label={t('WHATSAPP_PIN', 'Two-step verification PIN')} help={t('WHATSAPP_PIN_HINT', 'Six digits. If you leave it empty, Meta registration uses a generated PIN that you can download later.')}>
                      <Input
                        type='password'
                        inputMode='numeric'
                        autoComplete='new-password'
                        maxLength={6}
                        aria-label={t('WHATSAPP_PIN', 'Two-step verification PIN')}
                        value={draft.pin}
                        onChange={(event) => update('pin', digitsOnly(event.target.value).slice(0, 6))}
                      />
                    </LabeledField>
                  )}
                  <LabeledField label={t('WHATSAPP_WELCOME_MESSAGE', 'Welcome message')} help={t('WHATSAPP_WELCOME_HINT', 'First message sent when a customer starts a conversation')}>
                    <Input
                      maxLength={2000}
                      aria-label={t('WHATSAPP_WELCOME_MESSAGE', 'Welcome message')}
                      value={draft.welcomeMessage}
                      onChange={(event) => update('welcomeMessage', event.target.value)}
                    />
                  </LabeledField>
                  <LabeledField label={t('WHATSAPP_FALLBACK_MESSAGE', 'Fallback support message')} help={t('WHATSAPP_FALLBACK_HINT', 'Message sent when no location is available or the customer asks for support')}>
                    <Input
                      maxLength={2000}
                      aria-label={t('WHATSAPP_FALLBACK_MESSAGE', 'Fallback support message')}
                      value={draft.fallbackSupportMessage}
                      onChange={(event) => update('fallbackSupportMessage', event.target.value)}
                    />
                  </LabeledField>
                  <LabeledField label={t('WHATSAPP_WEBVIEW_URL', 'Ordering webview URL')} help={t('WHATSAPP_WEBVIEW_HINT', 'Public URL of the WhatsApp ordering webview. Menu, cart, checkout and tracking links point here.')}>
                    <Input
                      type='url'
                      inputMode='url'
                      maxLength={500}
                      spellCheck={false}
                      aria-label={t('WHATSAPP_WEBVIEW_URL', 'Ordering webview URL')}
                      value={draft.webviewBaseUrl}
                      onChange={(event) => update('webviewBaseUrl', event.target.value)}
                    />
                  </LabeledField>
                </FieldGrid>
              )}
            </ConnectionSection>}
            {createState.error && (
              <ErrorBox role='alert'>
                <p>{createState.error.map(code => t(code, code)).join(', ')}</p>
              </ErrorBox>
            )}
            <PanelActions>
              <Button type='button' color='primary' borderRadius='8px' outline onClick={onClose}>
                {t('CANCEL', 'Cancel')}
              </Button>
              <Button type='submit' color='primary' borderRadius='8px' disabled={saving || (!isBusinessLogin && !ready)}>
                {saving ? t('WHATSAPP_BOT_CREATING', 'Creating') : t('CREATE', 'Create')}
              </Button>
            </PanelActions>
          </>
        )}
      </PanelBody>
        <PinMissingConfirm
          open={pinPrompt}
          onContinue={() => {
            setPinPrompt(false)
            createAndClose()
          }}
          onChangePin={() => setPinPrompt(false)}
          onClose={() => setPinPrompt(false)}
        />
      </SideBar>
  )
}
