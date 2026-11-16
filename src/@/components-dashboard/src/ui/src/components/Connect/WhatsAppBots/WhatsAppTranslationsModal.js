import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ExclamationTriangle, XLg } from 'react-bootstrap-icons'
import { buildMessageUnits, previewReplyButtons, previewTextParts } from '../../../../../components/WhatsAppBotsList/botTranslationPreview'
import {
  getTranslationCatalogGroups,
  translationPlaceholderToken
} from '../../../../../components/WhatsAppBotsList/botTranslations'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Bone, SrOnly } from '../../Shared/AppBootLoader/styles'
import { Modal } from '../../Shared'
import { Globe } from '../../Shared/Icon'
import { BranchSelect, SavedNote } from './styles'
import {
  BrandBadge,
  ChatAction,
  ChatBody,
  ChatBubble,
  ChatSkeleton,
  CharacterCounter,
  CloseButton,
  EditorField,
  EditorFieldHeader,
  EditorInput,
  EditorTextarea,
  ErrorNotice,
  ErrorNoticeButton,
  FieldDetails,
  FieldMetaActions,
  FieldsGrid,
  FieldsScroll,
  MessageUnitCard,
  MessageUnitList,
  FieldsSkeleton,
  FormFooter,
  FormPane,
  HeaderDivider,
  LanguageControl,
  ModalContent,
  ModalHeader,
  ModalHeaderActions,
  ModalShell,
  ModalTitleRow,
  PhaseTab,
  PhaseTabDot,
  PhaseTabs,
  PhoneAvatar,
  PhoneFrame,
  PhoneHeader,
  PhoneIdentity,
  PlaceholderChip,
  PreviewAlert,
  PreviewMessage,
  PlaceholderRow,
  PreviewEmpty,
  PreviewPane,
  PreviewStepper,
  CustomerBubble,
  SystemPill,
  ResetButton,
  SaveHit,
  SaveSlot,
  SkeletonField,
  SkeletonPair,
  StatusBadge
} from './WhatsAppBotTranslations.styles'

const GROUP_LABELS = {
  greeting: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_GREETING', 'Greeting'],
  address: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_ADDRESS', 'Address'],
  order: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_ORDER', 'Order'],
  payment: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_PAYMENT', 'Payment'],
  confirmation: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_CONFIRMATION', 'Confirmation'],
  closing: ['WHATSAPP_BOT_TRANSLATIONS_GROUP_CLOSING', 'Closing']
}

export const LOCALE_LABELS = {
  en: ['WHATSAPP_BOT_LANGUAGE_EN', 'English'],
  es: ['WHATSAPP_BOT_LANGUAGE_ES', 'Spanish'],
  fr: ['WHATSAPP_BOT_LANGUAGE_FR', 'French'],
  ar: ['WHATSAPP_BOT_LANGUAGE_AR', 'Arabic']
}

const effectiveValue = (entry, value) => value || entry.default
const isActionField = (entry) => Number.isFinite(entry.maxLength) && entry.maxLength <= 20
const countCharacters = (value) => Array.from(value || '').length
const limitCharacters = (value, maxLength) => (
  Number.isFinite(maxLength)
    ? Array.from(value).slice(0, maxLength).join('')
    : value
)
const characterCounterState = (value, maxLength) => {
  const count = countCharacters(value)
  const remaining = Math.max(maxLength - count, 0)
  const warningThreshold = Math.min(100, Math.max(5, Math.ceil(maxLength * 0.25)))
  const dangerThreshold = Math.min(20, Math.max(2, Math.ceil(maxLength * 0.1)))
  return {
    remaining,
    progress: Math.min(count / maxLength, 1) * 360,
    status: remaining <= dangerThreshold
      ? 'danger'
      : remaining <= warningThreshold
        ? 'warning'
        : 'default'
  }
}
const humanizeGroup = (group) => group
  .trim()
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, character => character.toUpperCase())

const isCustomValue = (entry, value) => (
  value !== '' && (entry.isCustom || value !== entry.default)
)

const PreviewCopy = ({ value, replacements }) => (
  <>
    {previewTextParts(value, replacements).map((part, index) => (
      part.bold
        ? <strong key={`${index}-${part.text}`}>{part.text}</strong>
        : <React.Fragment key={`${index}-${part.text}`}>{part.text}</React.Fragment>
    ))}
  </>
)

export const WhatsAppTranslationsModal = (props) => {
  const {
    open,
    onClose,
    brandName,
    brandLogo,
    translationsState,
    setTranslationLocale,
    updateTranslationDraft,
    saveBotTranslations
  } = props
  const {
    locale = 'en',
    loading = false,
    saving = false,
    error = null,
    savedNotice = false,
    catalog = {},
    draft = {},
    validation = {},
    patch = {}
  } = translationsState || {}
  const [, t] = useLanguage()
  const availableGroups = useMemo(() => getTranslationCatalogGroups(catalog), [catalog])
  const [activeGroup, setActiveGroup] = useState(availableGroups[0] || '')
  const [focusedKey, setFocusedKey] = useState(null)
  const fieldRefs = useRef({})
  const pendingFocus = useRef(null)
  const resolvedBrandName = brandName || t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW_BRAND', 'Your business')
  const activeEntries = useMemo(() => (
    Object.entries(catalog).filter(([, entry]) => entry.group === activeGroup)
  ), [activeGroup, catalog])
  const messageUnits = useMemo(() => buildMessageUnits(activeEntries), [activeEntries])
  const [activeUnitId, setActiveUnitId] = useState('')
  const unitRefs = useRef({})
  const pendingUnitKey = useRef(null)
  const invalidKeys = useMemo(
    () => Object.keys(catalog).filter(key => validation[key]),
    [catalog, validation]
  )
  const hasValidationErrors = invalidKeys.length > 0
  const canSave = !loading && !saving && !hasValidationErrors && Object.keys(patch).length > 0
  const canRevealError = !loading && !saving && hasValidationErrors
  const firstInvalidLabel = catalog[invalidKeys[0]]?.label || ''
  const errorTemplate = invalidKeys.length === 1
    ? t('WHATSAPP_BOT_TRANSLATIONS_ERROR_ONE', '_count_ field needs attention: _field_')
    : t('WHATSAPP_BOT_TRANSLATIONS_ERROR_MANY', '_count_ fields need attention: _field_')
  const errorSummary = hasValidationErrors
    ? errorTemplate.replace('_count_', String(invalidKeys.length)).replace('_field_', firstInvalidLabel)
    : ''
  const replacements = {
    businessName: resolvedBrandName,
    address: t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW_ADDRESS', 'Main Avenue 123')
  }

  useEffect(() => {
    if (!availableGroups.includes(activeGroup)) {
      setActiveGroup(availableGroups[0] || '')
    }
  }, [activeGroup, availableGroups])

  useEffect(() => {
    const pendingKey = pendingUnitKey.current
    const pendingUnit = pendingKey
      ? messageUnits.find(unit => unit.bodyKey === pendingKey || unit.actions.some(([key]) => key === pendingKey))
      : null
    if (pendingUnit) {
      pendingUnitKey.current = null
      setActiveUnitId(pendingUnit.id)
      return
    }
    if (!messageUnits.some(unit => unit.id === activeUnitId)) {
      setActiveUnitId(messageUnits[0]?.id || '')
    }
  }, [messageUnits, activeUnitId])

  const revealNode = (node) => {
    if (!node) return
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    node.focus()
  }

  useEffect(() => {
    const key = pendingFocus.current
    const node = key ? fieldRefs.current[key] : null
    if (!node) return
    pendingFocus.current = null
    revealNode(node)
  }, [activeGroup])

  const unitIdForKey = (key) => messageUnits.find(unit => (
    unit.bodyKey === key || unit.actions.some(([actionKey]) => actionKey === key)
  ))?.id

  const showUnit = (id, scroll) => {
    setActiveUnitId(id)
    if (!scroll) return
    unitRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const focusField = (key, group) => {
    setFocusedKey(key)
    if (group !== activeGroup) {
      pendingFocus.current = key
      pendingUnitKey.current = key
      setActiveGroup(group)
      return
    }
    const unitId = unitIdForKey(key)
    if (unitId) setActiveUnitId(unitId)
    revealNode(fieldRefs.current[key])
  }

  const focusFirstInvalidField = () => {
    const key = invalidKeys[0]
    const group = catalog[key]?.group
    if (key && group) focusField(key, group)
  }

  const insertPlaceholder = (key, placeholder) => {
    const control = fieldRefs.current[key]
    const value = typeof draft[key] === 'string' ? draft[key] : ''
    const token = translationPlaceholderToken(placeholder)
    const hasActiveSelection = control && document.activeElement === control
    const start = hasActiveSelection ? (control.selectionStart ?? value.length) : value.length
    const end = hasActiveSelection ? (control.selectionEnd ?? start) : start
    updateTranslationDraft?.(key, `${value.slice(0, start)}${token}${value.slice(end)}`)
    window.requestAnimationFrame(() => {
      control?.focus()
      control?.setSelectionRange?.(start + token.length, start + token.length)
    })
  }

  const renderMessageField = (key, entry) => {
    const value = typeof draft[key] === 'string' ? draft[key] : ''
    const shownValue = effectiveValue(entry, value)
    const fieldValidation = validation[key]
    const action = isActionField(entry)
    const custom = isCustomValue(entry, value)
    const counter = Number.isFinite(entry.maxLength) && entry.maxLength > 0
      ? characterCounterState(shownValue, entry.maxLength)
      : null
    const Control = action ? EditorInput : EditorTextarea
    return (
      <EditorField key={key} data-long={!action}>
        <EditorFieldHeader>
          <label htmlFor={`translation-${key}`}>{entry.label}</label>
          <FieldMetaActions>
            <StatusBadge $custom={custom}>
              {custom
                ? t('WHATSAPP_BOT_TRANSLATIONS_STATUS_CUSTOM', 'Custom')
                : t('WHATSAPP_BOT_TRANSLATIONS_STATUS_AUTOMATIC', 'Automatic')}
            </StatusBadge>
            {custom && (
              <ResetButton
                type='button'
                aria-label={`${t('WHATSAPP_BOT_TRANSLATIONS_RESET', 'Reset')} ${entry.label}`}
                onClick={() => updateTranslationDraft?.(key, '')}
              >
                {t('WHATSAPP_BOT_TRANSLATIONS_RESET', 'Reset')}
              </ResetButton>
            )}
          </FieldMetaActions>
        </EditorFieldHeader>
        <Control
          id={`translation-${key}`}
          ref={node => { fieldRefs.current[key] = node }}
          type={action ? 'text' : undefined}
          rows={action ? undefined : 3}
          aria-label={entry.label}
          value={value}
          placeholder={entry.default}
          maxLength={entry.maxLength}
          disabled={saving}
          $invalid={Boolean(fieldValidation)}
          onFocus={() => {
            setFocusedKey(key)
            const unitId = unitIdForKey(key)
            if (unitId) setActiveUnitId(unitId)
          }}
          onChange={(event) => updateTranslationDraft?.(
            key,
            limitCharacters(event.target.value, entry.maxLength)
          )}
        />
        {entry.placeholders.length > 0 && (
          <PlaceholderRow>
            {entry.placeholders.map(placeholder => {
              const token = translationPlaceholderToken(placeholder)
              const present = shownValue.includes(token)
              return (
                <PlaceholderChip
                  key={placeholder}
                  type='button'
                  $present={present}
                  aria-label={`${t('WHATSAPP_BOT_TRANSLATIONS_INSERT', 'Insert')} ${token}`}
                  onClick={() => insertPlaceholder(key, placeholder)}
                >
                  {token}
                </PlaceholderChip>
              )
            })}
          </PlaceholderRow>
        )}
        <FieldDetails $error={Boolean(fieldValidation)}>
          <span>
            {fieldValidation?.missingPlaceholders?.length > 0
              ? `${t('WHATSAPP_BOT_TRANSLATIONS_MISSING_PLACEHOLDER', 'Missing required placeholder:')} ${fieldValidation.missingPlaceholders.map(translationPlaceholderToken).join(', ')}`
              : fieldValidation?.overLimit
                ? t('WHATSAPP_BOT_TRANSLATIONS_MAX_LENGTH_ERROR', 'Maximum length exceeded.')
                : ''}
          </span>
          {counter && (
            <CharacterCounter
              aria-label={t(
                'WHATSAPP_BOT_TRANSLATIONS_CHARACTERS_REMAINING',
                'Characters remaining: _count_'
              ).replace('_count_', counter.remaining)}
              data-status={counter.status}
              $progress={counter.progress}
              $status={counter.status}
            >
              <span aria-hidden='true'>{counter.remaining}</span>
            </CharacterCounter>
          )}
        </FieldDetails>
      </EditorField>
    )
  }

  const activeUnit = messageUnits.find(unit => unit.id === activeUnitId) || null
  const activeUnitIndex = activeUnit ? messageUnits.findIndex(unit => unit.id === activeUnit.id) : -1
  const activeGroupLabel = GROUP_LABELS[activeGroup]
    ? t(...GROUP_LABELS[activeGroup])
    : humanizeGroup(activeGroup || '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      width='calc(100vw - 32px)'
      maxWidth='1024px'
      height='min(660px, 85dvh)'
      padding='0'
      overflow='hidden'
      hideCloseDefault
      aria-labelledby='whatsapp-translations-modal-title'
    >
      <ModalShell>
        <ModalHeader>
          <ModalTitleRow>
            <h2 id='whatsapp-translations-modal-title'>
              {t('WHATSAPP_BOT_TRANSLATIONS_MODAL_TITLE', 'WhatsApp Bot Translations')}
            </h2>
            <BrandBadge>{resolvedBrandName}</BrandBadge>
          </ModalTitleRow>
          <ModalHeaderActions>
            <LanguageControl>
              <Globe aria-hidden='true' />
              <BranchSelect
                aria-label={t('WHATSAPP_BOT_LANGUAGE', 'Language')}
                value={locale}
                disabled={saving}
                onChange={(event) => setTranslationLocale?.(event.target.value)}
              >
                {Object.entries(LOCALE_LABELS).map(([code, [key, fallback]]) => (
                  <option key={code} value={code}>{t(key, fallback)}</option>
                ))}
              </BranchSelect>
            </LanguageControl>
            <HeaderDivider aria-hidden='true' />
            <CloseButton
              type='button'
              aria-label={t('CLOSE', 'Close')}
              onClick={onClose}
            >
              <XLg aria-hidden='true' />
            </CloseButton>
          </ModalHeaderActions>
        </ModalHeader>

        <ModalContent>
          <FormPane>
            {loading && availableGroups.length === 0 && (
              <PhaseTabs aria-hidden='true'>
                {['72px', '64px', '52px', '68px', '108px'].map(width => (
                  <Bone key={width} data-skeleton='translation' $width={width} $height='14px' $radius='7px' />
                ))}
              </PhaseTabs>
            )}
            {availableGroups.length > 0 && (
            <PhaseTabs role='tablist' aria-label={t('WHATSAPP_BOT_TRANSLATIONS_PHASES', 'Order phases')}>
              {availableGroups.map(group => {
                const label = GROUP_LABELS[group]
                  ? t(...GROUP_LABELS[group])
                  : humanizeGroup(group)
                const customCount = Object.entries(catalog).filter(([key, entry]) => (
                  entry.group === group &&
                  isCustomValue(entry, typeof draft[key] === 'string' ? draft[key] : '')
                )).length
                const errorCount = Object.entries(catalog).filter(([key, entry]) => (
                  entry.group === group && validation[key]
                )).length
                return (
                  <PhaseTab
                    key={group}
                    type='button'
                    role='tab'
                    aria-selected={activeGroup === group}
                    data-error={errorCount > 0 ? 'true' : undefined}
                    $active={activeGroup === group}
                    onClick={() => setActiveGroup(group)}
                  >
                    {label}
                    {errorCount > 0
                      ? <PhaseTabDot $error data-tone='error' aria-hidden='true' />
                      : customCount > 0 && <PhaseTabDot data-tone='custom' aria-hidden='true' />}
                  </PhaseTab>
                )
              })}
            </PhaseTabs>
            )}

            <FieldsScroll>
              {loading && (
                <>
                  <SrOnly role='status'>{t('WHATSAPP_BOT_TRANSLATIONS_LOADING', 'Loading translations...')}</SrOnly>
                  <FieldsSkeleton aria-hidden='true'>
                    <SkeletonField>
                      <Bone data-skeleton='translation' $width='168px' $height='14px' />
                      <Bone data-skeleton='translation' $width='100%' $height='94px' $radius='8px' />
                    </SkeletonField>
                    <SkeletonPair>
                      <SkeletonField>
                        <Bone data-skeleton='translation' $width='120px' $height='14px' />
                        <Bone data-skeleton='translation' $width='100%' $height='40px' $radius='8px' />
                      </SkeletonField>
                      <SkeletonField>
                        <Bone data-skeleton='translation' $width='136px' $height='14px' />
                        <Bone data-skeleton='translation' $width='100%' $height='40px' $radius='8px' />
                      </SkeletonField>
                    </SkeletonPair>
                  </FieldsSkeleton>
                </>
              )}
              {error && <p role='alert'>{error.map(code => t(code, code)).join(', ')}</p>}
              {!loading && (
                <MessageUnitList>
                  {messageUnits.map(unit => (
                    <MessageUnitCard
                      key={unit.id}
                      ref={node => { unitRefs.current[unit.id] = node }}
                      $active={unit.id === activeUnitId}
                      data-active={unit.id === activeUnitId ? 'true' : 'false'}
                      onClick={() => setActiveUnitId(unit.id)}
                    >
                      {unit.body && renderMessageField(unit.body[0], unit.body[1])}
                      {unit.actions.length > 0 && (
                        <FieldsGrid>
                          {unit.actions.map(([key, entry]) => renderMessageField(key, entry))}
                        </FieldsGrid>
                      )}
                    </MessageUnitCard>
                  ))}
                </MessageUnitList>
              )}
            </FieldsScroll>

            <FormFooter>
              {hasValidationErrors && (
                <ErrorNotice role='status'>
                  <span>{errorSummary}</span>
                  <ErrorNoticeButton type='button' onClick={focusFirstInvalidField}>
                    {t('WHATSAPP_BOT_TRANSLATIONS_FIX_ERROR', 'Fix error')}
                  </ErrorNoticeButton>
                </ErrorNotice>
              )}
              {loading
                ? <Bone aria-hidden='true' data-skeleton='translation' $width='66%' $height='36px' $radius='8px' />
                : (
              <SaveSlot>
                <Button
                  type='button'
                  color='primary'
                  borderRadius='8px'
                  disabled={!canSave}
                  onClick={saveBotTranslations}
                >
                  {saving
                    ? t('WHATSAPP_BOT_TRANSLATIONS_SAVING', 'Saving translations')
                    : t('WHATSAPP_BOT_TRANSLATIONS_SAVE', 'Save translations')}
                </Button>
                {canRevealError && (
                  <SaveHit
                    type='button'
                    tabIndex={-1}
                    aria-hidden='true'
                    onClick={focusFirstInvalidField}
                  />
                )}
              </SaveSlot>
                  )}
              {savedNotice && !saving && !error && (
                <SavedNote>{t('WHATSAPP_BOT_TRANSLATIONS_SAVED', 'Translations saved')}</SavedNote>
              )}
            </FormFooter>
          </FormPane>

          <PreviewPane>
            <PhoneFrame>
              <PhoneHeader>
                <PhoneAvatar>
                  {brandLogo
                    ? <img src={brandLogo} alt='' />
                    : resolvedBrandName.slice(0, 2).toUpperCase()}
                </PhoneAvatar>
                <PhoneIdentity>
                  <strong>{resolvedBrandName}</strong>
                  <span>{t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW_ONLINE', 'Online')}</span>
                </PhoneIdentity>
              </PhoneHeader>
              <ChatBody>
                {loading && (
                  <ChatSkeleton aria-hidden='true'>
                    <Bone data-skeleton='translation' $width='86%' $height='54px' $radius='4px 10px 10px 10px' />
                    <Bone data-skeleton='translation' $width='68%' $height='36px' $radius='4px 10px 10px 10px' />
                    <Bone data-skeleton='translation' $width='100%' $height='32px' $radius='7px' />
                    <Bone data-skeleton='translation' $width='100%' $height='32px' $radius='7px' />
                  </ChatSkeleton>
                )}
                {!loading && !activeUnit && (
                  <PreviewEmpty>{t('WHATSAPP_BOT_TRANSLATIONS_EMPTY', 'No customer messages are available.')}</PreviewEmpty>
                )}
                {!loading && activeUnit && (
                  <>
                    <SystemPill>{activeUnit.label}</SystemPill>
                    {activeUnit.bodyKey === 'chatbot_confirm_address_body' && replacements.address && (
                      <CustomerBubble>📍 {replacements.address}</CustomerBubble>
                    )}
                    {activeUnit.body && (() => {
                      const [key, entry] = activeUnit.body
                      const value = effectiveValue(entry, draft[key])
                      const invalid = Boolean(validation[key])
                      const replies = previewReplyButtons(key, locale, catalog, draft)
                      return (
                        <PreviewMessage>
                          <ChatBubble
                            type='button'
                            $active={focusedKey === key}
                            $invalid={invalid}
                            data-invalid={invalid ? 'true' : undefined}
                            aria-label={`${t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW', 'Preview')} ${entry.label}`}
                            onClick={() => focusField(key, entry.group)}
                          >
                            <PreviewCopy value={value} replacements={replacements} />
                            <time>12:35 PM</time>
                            {invalid && (
                              <PreviewAlert aria-hidden='true'>
                                <ExclamationTriangle size={9} />
                              </PreviewAlert>
                            )}
                          </ChatBubble>
                          {replies.map(reply => {
                            const replyInvalid = Boolean(validation[reply.key])
                            return (
                              <ChatAction
                                key={reply.key}
                                as={reply.editable ? 'button' : 'div'}
                                type={reply.editable ? 'button' : undefined}
                                $active={focusedKey === reply.key}
                                $invalid={replyInvalid}
                                data-invalid={replyInvalid ? 'true' : undefined}
                                $plain={!reply.editable}
                                aria-label={reply.editable
                                  ? `${t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW', 'Preview')} ${reply.label}`
                                  : undefined}
                                onClick={reply.editable ? () => focusField(reply.key, entry.group) : undefined}
                              >
                                {reply.label}
                                {replyInvalid && (
                                  <PreviewAlert aria-hidden='true'>
                                    <ExclamationTriangle size={9} />
                                  </PreviewAlert>
                                )}
                              </ChatAction>
                            )
                          })}
                        </PreviewMessage>
                      )
                    })()}
                    {!activeUnit.body && activeUnit.actions.map(([key, entry]) => {
                      const value = effectiveValue(entry, draft[key])
                      const invalid = Boolean(validation[key])
                      return (
                        <ChatAction
                          key={key}
                          type='button'
                          $active={focusedKey === key}
                          $invalid={invalid}
                          data-invalid={invalid ? 'true' : undefined}
                          aria-label={`${t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW', 'Preview')} ${entry.label}`}
                          onClick={() => focusField(key, entry.group)}
                        >
                          <PreviewCopy value={value} replacements={replacements} />
                        </ChatAction>
                      )
                    })}
                  </>
                )}
              </ChatBody>
              {!loading && messageUnits.length > 1 && (
                <PreviewStepper>
                  <button
                    type='button'
                    aria-label={t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW_PREVIOUS', 'Previous message')}
                    disabled={activeUnitIndex <= 0}
                    onClick={() => showUnit(messageUnits[activeUnitIndex - 1].id, true)}
                  >
                    ‹
                  </button>
                  <span>
                    {t(
                      'WHATSAPP_BOT_TRANSLATIONS_PREVIEW_STEP',
                      'Previewing step _step_ of _total_ in _group_'
                    )
                      .replace('_step_', String(activeUnitIndex + 1))
                      .replace('_total_', String(messageUnits.length))
                      .replace('_group_', activeGroupLabel)}
                  </span>
                  <button
                    type='button'
                    aria-label={t('WHATSAPP_BOT_TRANSLATIONS_PREVIEW_NEXT', 'Next message')}
                    disabled={activeUnitIndex >= messageUnits.length - 1}
                    onClick={() => showUnit(messageUnits[activeUnitIndex + 1].id, true)}
                  >
                    ›
                  </button>
                </PreviewStepper>
              )}
            </PhoneFrame>
          </PreviewPane>
        </ModalContent>
      </ModalShell>
    </Modal>
  )
}
