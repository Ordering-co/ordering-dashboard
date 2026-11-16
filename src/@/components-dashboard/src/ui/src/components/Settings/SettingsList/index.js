import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, SettingsList as SettingsListController } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Alert, ColorPicker, NotFoundSource } from '../../Shared'
import { Button } from '../../../styles'
import { SettingsSelectUI } from '../SettingsSelectUI'
import { SettingsCountryFilter } from '../SettingsCountryFilter'
import { SettingsImage } from '../SettingsImage'
import { GuestCheckoutFieldsSetting } from '../GuestCheckoutFieldsSetting'
import { DriversGroupsLogisticsService } from '../../Connect'
import {
  getSettingsGuestOrderTypeValues,
  getSettingsOrderTypeValues,
  shouldHideUpsellingConfig
} from '../../../utils'
import { parseJsonArray } from '../../../../../utils/safeJsonParse'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import {
  SETTINGS_INVERTED_VALUE_KEYS,
  SETTINGS_ORDER_TYPES_BY_NUMBER_KEYS,
  SETTINGS_ORDER_TYPE_SELECT_KEYS
} from '../../../../../utils/settingsSelectOptions'
import { useIsPhone } from '../../Shared/Product/useIsPhone' // redesign settings B
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext'
import { useHubFormReport, useSavedNotice } from '../SettingsHubForm/useHubFormReport'
import { SettingsSaveBar } from '../SettingsHubForm/SettingsSaveBar'
import { ProductSettingsRow, isNotACountryCode, isNotANumericText } from './ProductSettingsRow'
import { AccentContrastNote } from './AccentContrastNote'
import {
  SETTINGS_CUSTOM_BLOCKS,
  applySettingsConfigCopy,
  findConfigByKey,
  getLeftoverSettingsConfigs,
  getRecaptchaSubmitErrorCodes,
  getSettingsBlockFocusId,
  getSettingsFieldDependency,
  getSettingsFocusId,
  getSettingsInputPresentation,
  getPreorderTypeRows,
  getReservationSettingIssues,
  getSettingsType6TypeLabel,
  getSettingsType6Unit,
  getVisibleSettingsConfigs,
  isSettingsConfigVisible,
  isSettingsCustomBlockMaster,
  resolveSettingsFocusKey,
  updateType6Value
} from '../../../../../utils/settingsCustomSections'
import { SettingsCustomBlocks } from '../SettingsCustomBlocks'
import { CompactTable, Table } from '../SettingsCustomBlocks/styles'

import {
  SettingsListContainer,
  GeneralContainer,
  GeneralTitle,
  FormContainer,
  FormGroupText,
  FormGroupCheck,
  FormGroupWrapper,
  SkeletonWrapper,
  CheckBoxWrapper,
  ConfigRow,
  OptionsError,
  SubmitBtnWrapper,
  Description
} from './styles'

const invertedValuesConfigs = SETTINGS_INVERTED_VALUE_KEYS
const configsTypecColors = ['dashboard_buttons_colors']
const RECAPTCHA_SUBMIT_ERROR_COPY = {
  SETTINGS_RECAPTCHA_SCORE_RANGE: 'Enter a score between 0 and 1.',
  SETTINGS_RECAPTCHA_ENABLE_INVALID: 'Fill the required keys for the selected version before enabling reCAPTCHA.'
}

// redesign settings B: the hidden companions of the date block (it writes three configs for one visible field).
const DATE_BLOCK_COMPANION_KEYS = SETTINGS_CUSTOM_BLOCKS.date_time.keys.filter(key => key !== 'dates_general_format')

// The first thing in a row a keyboard user can act on.
const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'button:not([disabled])',
  '[role="button"]:not([aria-disabled="true"])',
  '[tabindex]:not([tabindex="-1"])'
].join(',')

const NON_TEXT_INPUT_TYPES = ['checkbox', 'radio', 'button', 'submit', 'file', 'color', 'range']

// A phone keyboard opens on a text control: landing there must not focus one (audit finding 7).
const isTextEntryControl = (node) => (
  node.tagName === 'TEXTAREA' ||
  (node.tagName === 'INPUT' && !NON_TEXT_INPUT_TYPES.includes(node.type))
)

// The text of an error of the API, whatever shape it comes in (a list of messages, a message, an Error).
const getApiErrorMessage = (result, t) => {
  if (Array.isArray(result)) return result.map(item => translateApiMessage(t, item, '')).filter(Boolean).join(' ')
  if (typeof result === 'string') return translateApiMessage(t, result, '')
  if (result && typeof result.message === 'string') return translateApiMessage(t, result.message, '')
  return ''
}

// when the focused row is checked again, after content above it may have loaded
const FOCUS_RECENTRE_DELAYS_MS = [800, 2000]

export const SettingsListUI = (props) => {
  const {
    category,
    settingsState,
    configs,
    formState,
    onCloseSettingsList,
    handleCheckBoxChange,
    handleInputChange,
    handleClickUpdate,
    saveConfig,
    isRemoveGeneralTitle,
    setAvailableModifyData,
    configOptionsToHide,
    focus,
    // redesign settings B: given by the controller, used only inside the hub
    handleDiscardChanges,
    revision,
    saving: isSaving,
    savedCount,
    failedKey,
    // redesign D-81 (R-3): opt-in, given by a page that guards its unsaved work (see below)
    leaveGuard
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign settings B: inside the Settings hub the form is drawn with Product fields and a save bar.
  const hubForm = useSettingsHubForm()
  const product = !!hubForm
  const isPhone = useIsPhone()
  const isPhoneRef = useRef(isPhone)
  isPhoneRef.current = isPhone
  const formRef = useRef(null)
  const focusedForRef = useRef(null)
  const scrolledForRef = useRef(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [acknowledgedResult, setAcknowledgedResult] = useState(null)

  const customKeyConfigs = SETTINGS_ORDER_TYPE_SELECT_KEYS

  const orderTypesByNumbers = SETTINGS_ORDER_TYPES_BY_NUMBER_KEYS
  const orderTypeValues = getSettingsOrderTypeValues()
  const guestOrderTypeValues = getSettingsGuestOrderTypeValues()

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // Dependent fields: unmount configs whose master does not match,
  // and land a focus on a hidden field on its master instead.
  const visibleConfigs = getVisibleSettingsConfigs(configs)
  const effectiveFocus = resolveSettingsFocusKey(focus, configs)
  const leftoverConfigs = getLeftoverSettingsConfigs(visibleConfigs).map(config => applySettingsConfigCopy(config, t))
  const leadingLeftoverConfigs = leftoverConfigs.filter(config => isSettingsCustomBlockMaster(config.key))
  const trailingLeftoverConfigs = leftoverConfigs.filter(config => !isSettingsCustomBlockMaster(config.key))
  const includeCateringTypes = true
  // Edits on dependents hidden by their master are never sent (see the
  // controller), so they do not count as pending changes either.
  const hasVisibleChanges = (settingsState?.changes || []).some(item => isSettingsConfigVisible(item, configs))

  // redesign settings B: inside the hub the changes are counted by visible field. A hidden dependent is not sent and
  // does not count (as above); the hidden companions of the date block are written by the block's own field and do not count.
  const visibleChanges = product
    ? (settingsState?.changes || []).filter(item => isSettingsConfigVisible(item, configs) && !DATE_BLOCK_COMPANION_KEYS.includes(item?.key))
    : []
  const isDirty = visibleChanges.length > 0
  const saving = !!isSaving
  const getFieldName = (item) => {
    const source = (configs || []).find(config => config?.id === item?.id) || item
    return applySettingsConfigCopy(source, t)?.name || item?.key
  }
  const changeNames = visibleChanges.map(getFieldName)
  const apiResult = settingsState?.result
  const saved = useSavedNotice({
    saving,
    succeeded: product && !apiResult?.error && !(settingsState?.changes?.length > 0)
  })
  useHubFormReport(category?.key, { dirty: isDirty, saving })

  // redesign D-81 (R-3, owner, 2026-10-19): a page that asks before a way out with unsaved work (/my-products/dashboard,
  // whose «Dashboard settings» block is this form) passes `leaveGuard = { register, onCountChange }`: `register` is its leave host's
  // (P/LeaveGuard `useLeaveGuardHost().context.register`), `onCountChange(n)` lets the page know how many changes are pending (it
  // needs it to arm its route guard). Dirty = the changes of the visible fields against the saved values (the controller drops a
  // change typed back to the saved value); Save runs exactly the Save button (`handleSubmit`) and answers when the chain of PUTs
  // ends, `{ ok: false }` when a rule stopped it or the API refused; Discard is the controller's `handleDiscardChanges`.
  // Without `leaveGuard` nothing here changes.
  const leaveChanges = leaveGuard ? (settingsState?.changes || []).filter(item => isSettingsConfigVisible(item, configs)) : []
  const leaveCount = leaveChanges.length
  const leaveEntry = useRef(null)
  const leaveWaiter = useRef(null)
  leaveEntry.current = {
    isDirty: () => leaveCount > 0,
    count: () => leaveCount,
    save: () => {
      // a second Save while one is running waits for the same answer
      if (leaveWaiter.current) return leaveWaiter.current.promise
      const waiter = { started: saving }
      waiter.promise = new Promise(resolve => { waiter.resolve = resolve })
      leaveWaiter.current = waiter
      // a rule that stops the Save (the Alert says which) is a failed Save: the person stays
      if (!saving && handleSubmit() === false) {
        leaveWaiter.current = null
        waiter.resolve({ ok: false })
      }
      return waiter.promise
    },
    discard: () => handleDiscardChanges && handleDiscardChanges()
  }
  const leaveRegister = leaveGuard?.register
  useEffect(() => (leaveRegister ? leaveRegister(leaveEntry) : undefined), [leaveRegister])
  const onLeaveCountChange = leaveGuard?.onCountChange
  useEffect(() => {
    onLeaveCountChange?.(leaveCount)
  }, [onLeaveCountChange, leaveCount])
  useEffect(() => () => {
    onLeaveCountChange?.(0)
    leaveWaiter.current?.resolve({ ok: false })
    leaveWaiter.current = null
  }, [onLeaveCountChange])
  // The answer of the Save above: once the chain of PUTs has run (it started and `saving` is over) it worked when the API did not
  // refuse any and nothing is left pending. If it never started (everything pending was hidden by its master, so nothing is sent)
  // there is nothing left to save either.
  useEffect(() => {
    const waiter = leaveWaiter.current
    if (!waiter) return
    if (saving) {
      waiter.started = true
      return
    }
    if (!waiter.started && leaveCount > 0) return
    leaveWaiter.current = null
    waiter.resolve(settingsState?.result?.error || leaveCount > 0 ? { ok: false } : { ok: true })
  })

  const formatArray = (values) => {
    values = values.replace('[', '')
    values = values.replace(']', '')
    return values
  }

  // The rules of the form, as a list of `{ key, message }` in the order they are found (the legacy Alert showed the messages).
  // Messages name the field as the screen does (`getFieldName`), not as the API does.
  const collectValidationIssues = (changes) => {
    const issues = []
    const notANumber = (item) => issues.push({ key: item.key, message: t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.').replace('_attribute_', getFieldName(item)) })
    for (const item of changes) {
      switch (item?.key) {
        case 'driver_tip_options':
          !/^((\d)+,)*(\d)+$/.test(item.value) && issues.push({ key: item.key, message: t('DRIVER_TIP_OPTIONS_ERROR', 'Use numbers separated by commas.') })
          break
        case 'max_days_preorder': {
          // the help says «When 0 or -1, scheduling is off», so 0 and -1 are valid; any other whole number is days.
          const days = String(item.value ?? '').trim()
          if (days === '' || !Number.isInteger(Number(days)) || Number(days) < -1) {
            issues.push({ key: item.key, message: t('SETTINGS_PREORDER_DAYS_INVALID', '_attribute_ must be a whole number, -1 or greater.').replace('_attribute_', getFieldName(item)) })
          }
          break
        }
        case 'platform_fee_fixed':
        case 'platform_fee_percentage':
          if (isNaN(Number(item?.value))) notANumber(item)
          if (item?.key === 'platform_fee_percentage' && Number(item?.value) > 100) {
            // a new key; the live catalog keeps «must be not bigger than 100» under VALIDATION_MUST_SMALLER_HUNDRED.
            issues.push({ key: item.key, message: t('VALIDATION_MUST_NOT_EXCEED_HUNDRED', '_attribute_ must not be greater than 100').replace('_attribute_', getFieldName(item)) })
          }
          break
        case 'reservation_setting':
          // no negative values and no minimum above its maximum in the reservation table
          getReservationSettingIssues(item.value, t).forEach(message => issues.push({ key: item.key, message }))
          break
        case 'default_country_code':
          if (isNotACountryCode(item)) {
            issues.push({ key: item.key, message: t('SETTINGS_DEFAULT_COUNTRY_CODE_INVALID', 'Use a two-letter country code in capital letters, like US, CA or MX. A dialing prefix like +1 does not work.') })
          }
          break
        default:
          // a text config that holds a number of time (expiry) refuses text.
          if (isNotANumericText(item)) notANumber(item)
          break
      }
    }
    const recaptchaType = findConfigByKey(configs, 'security_recaptcha_type')
    if (recaptchaType) {
      const recaptchaErrors = getRecaptchaSubmitErrorCodes({
        type: recaptchaType.value,
        configs
      })
      recaptchaErrors.forEach(code => {
        issues.push({ key: 'security_recaptcha_type', message: t(code, RECAPTCHA_SUBMIT_ERROR_COPY[code] || code) })
      })
    }
    return issues
  }

  const handleSubmit = () => {
    if (product) {
      // The same rules, but only over what will be sent (a hidden dependent is not), with each message under its own field.
      const issues = collectValidationIssues(visibleChanges)
      if (issues.length > 0) {
        const byField = {}
        issues.forEach(({ key, message }) => { if (!(key in byField)) byField[key] = message })
        setFieldErrors(byField)
        return false
      }
      setFieldErrors({})
      handleClickUpdate && handleClickUpdate()
      return true
    }
    const invalidMessageList = collectValidationIssues(formState.changes).map(issue => issue.message)
    if (invalidMessageList.length > 0) {
      setAlertState({ open: true, content: invalidMessageList })
      return false
    }
    handleClickUpdate && handleClickUpdate()
    return true
  }

  // Editing a field takes its message away; a failed image save (no changes pending) is acknowledged by the next edit.
  const handleProductInputChange = (value, id) => {
    const edited = (configs || []).find(config => config?.id === id)
    if (edited?.key && fieldErrors[edited.key] !== undefined) {
      setFieldErrors(({ [edited.key]: removed, ...rest }) => rest)
    }
    if (apiResult?.error && !isDirty) setAcknowledgedResult(apiResult)
    handleInputChange(value, id)
  }

  const handleDiscard = () => {
    setFieldErrors({})
    handleDiscardChanges && handleDiscardChanges()
    // the buttons that had the focus are gone with the bar: keep the keyboard user inside the form
    formRef.current?.focus({ preventScroll: true })
  }

  const handleKeyPress = (e, key) => {
    const allowedKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Enter', 'Home', 'End']
    switch (key) {
      case 'platform_fee_fixed':
      case 'platform_fee_percentage':
        if (!allowedKeys.includes(e.key) && !/^[0-9.]$/.test(e.key)) {
          e.preventDefault()
        }
        break
      default:
        break
    }
  }
  useEffect(() => {
    // inside the hub a failed save is shown in the save bar, not in the modal Alert
    if (!product && settingsState?.result?.error) {
      setAlertState({
        open: true,
        content: settingsState?.result?.result
      })
    }
  }, [settingsState?.result])

  useEffect(() => {
    if (setAvailableModifyData && !settingsState.loading && configs?.length > 0) {
      // Hidden dependents (master off) are ignored by the validator.
      setAvailableModifyData(visibleConfigs.every(config => config?.value !== ''))
    }
  }, [setAvailableModifyData, settingsState.loading, configs])

  useEffect(() => {
    if (!effectiveFocus || settingsState.loading) return

    let cancelled = false
    // redesign settings B (decision 7): inside the hub the focus also lands on the first control of the row, once
    // for each value of `focus` (this effect runs again after every save: the focus must not be taken back), and never on a
    // text control on a phone, where it would open the keyboard.
    const landFocus = (node) => {
      if (focusedForRef.current === focus) return
      focusedForRef.current = focus
      const target = node.querySelector(FOCUSABLE_SELECTOR)
      if (!target || (isPhoneRef.current && isTextEntryControl(target))) return
      target.focus({ preventScroll: true })
    }
    const scrollToFocus = () => {
      if (cancelled) return false
      const node = document.getElementById(getSettingsFocusId(effectiveFocus)) ||
        document.getElementById(getSettingsBlockFocusId(effectiveFocus))
      if (node && product) landFocus(node)
      if (node && typeof node.scrollIntoView === 'function') {
        // the form stays mounted through a save in the hub: centre the row once per target, not again after each save
        if (!product || scrolledForRef.current !== effectiveFocus) {
          node.scrollIntoView({ block: 'center' })
          scrolledForRef.current = effectiveFocus
        }
        return true
      }
      return false
    }

    // a section can load more content above the row after it was centred (the loyalty levels, the wallet card):
    // while the focus is still on the row, centre it again if it went out of view
    const timers = []
    const recentreLater = () => {
      FOCUS_RECENTRE_DELAYS_MS.forEach(delay => timers.push(setTimeout(() => {
        if (cancelled) return
        const node = document.getElementById(getSettingsFocusId(effectiveFocus)) ||
          document.getElementById(getSettingsBlockFocusId(effectiveFocus))
        if (!node || !node.contains(document.activeElement) || typeof node.scrollIntoView !== 'function') return
        const { top, bottom } = node.getBoundingClientRect()
        if (top < 0 || bottom > window.innerHeight) node.scrollIntoView({ block: 'center' })
      }, delay)))
    }
    const cleanup = (frameId) => () => {
      cancelled = true
      if (frameId != null) cancelAnimationFrame(frameId)
      timers.forEach(clearTimeout)
    }

    if (scrollToFocus()) {
      recentreLater()
      return cleanup(null)
    }

    const frameId = requestAnimationFrame(() => {
      if (scrollToFocus()) recentreLater()
    })
    return cleanup(frameId)
    // redesign settings R-01: inside the app the section mounts before its configs arrive; run again when the
    // rows exist, or the anchor is never found (direct URL loads only worked because the catalog was already there).
  }, [effectiveFocus, settingsState.loading, configs?.length > 0])

  const renderLeftoverRows = (rows) => rows.map((config, i) => {
    if (product) {
      // Product row: label and hint tied to the control. A new key per revision remounts the uncontrolled leaves after a discard.
      return (
        <ProductSettingsRow
          key={`${config.key || config.id || `settings-row-${i}`}:${revision || 0}`}
          config={config}
          focused={effectiveFocus === config.key}
          error={fieldErrors[config.key] || null}
          handleInputChange={handleProductInputChange}
          saveConfig={saveConfig}
          configOptionsToHide={configOptionsToHide}
          orderTypeValues={orderTypeValues}
          guestOrderTypeValues={guestOrderTypeValues}
          includeCateringTypes={includeCateringTypes}
          handleKeyPress={handleKeyPress}
        />
      )
    }
    // Only dependents get the placeholder treatment; other text
    // configs may legitimately store copy that looks like a hint.
    const inputPresentation = getSettingsFieldDependency(config.key)
      ? getSettingsInputPresentation(config)
      : { value: config?.value ?? '', placeholder: config?.name }
    const type6Unit = getSettingsType6Unit(config.key)
    return (
                    <ConfigRow
                      key={`${config.key || config.id || `settings-row-${i}`}:${revision || 0}`}
                      id={getSettingsFocusId(config.key)}
                      $focused={effectiveFocus === config.key}
                    >
                      {
                        config.type === 1 && (
                          <FormGroupText className='form-group'>
                            <label>{config?.name}</label>
                            {config?.description && <Description>{config?.description}</Description>}
                            {configsTypecColors.includes(config?.key)
                              ? (
                              <>
                                <ColorPicker
                                  defaultColor={config?.value}
                                  onChangeColor={(color) => handleInputChange(color, config?.id)}
                                />
                                {/* J5 row 45 (my-products-dashboard P-DB5): a notice that does not block */}
                                <AccentContrastNote value={config?.value} />
                              </>
                                )
                              : (
                            <input
                              type='text'
                              value={inputPresentation.value}
                              onChange={(e) => handleInputChange(e.target.value, config?.id)}
                              onKeyDown={(e) => handleKeyPress(e, config?.key)}
                              className='form-control'
                                placeholder={inputPresentation.placeholder}
                              />
                                )}
                          </FormGroupText>
                        )
                      }
                      {
                        config.type === 2 && (
                          config.key === 'country_autocomplete'
                            ? (
                              <SettingsCountryFilter
                                defaultValue={config?.value}
                                handleSelectChange={(value) => handleInputChange(value, config?.id)}
                                label={config?.name}
                                description={config?.description}
                              />
                              )
                            : (
                              <SettingsSelectUI
                                selectStyle={{
                                  maxHeight: '50vh',
                                  overflow: 'auto'
                                }}
                                config={{
                                  ...config,
                                  options: config?.options?.filter(option => !configOptionsToHide.find(optionToHide => optionToHide.key === config.key && optionToHide.value === option.value))
                                }}
                                invertValues={invertedValuesConfigs.includes(config?.key)}
                                defaultValue={config?.value}
                                handleSelectChange={(value) => handleInputChange(value, config?.id)}
                              />
                              )
                        )
                      }
                      {
                        config.type === 3 && (
                          <CheckBoxWrapper>
                            {config?.name && (
                              <label>{config?.name}</label>
                            )}
                            {config?.description && (
                              <p>{config?.description}</p>
                            )}
                            {
                              !customKeyConfigs.includes(config?.key) && config?.options?.length > 0 && config?.options?.map((item, j) => (
                                <FormGroupWrapper key={j}>
                                  <FormGroupCheck className='checkbox'>
                                    <label>
                                      <input
                                        type='checkbox'
                                        name={item?.value}
                                        data-id={config?.id}
                                        defaultChecked={config?.value.split('|').includes(item?.value)}
                                        onChange={(e) => handleCheckBoxChange(e, true, config?.value)}
                                      />
                                      {t(item.text.toUpperCase(), item.text.replace(/_/g, ' ').toLowerCase())}
                                    </label>
                                  </FormGroupCheck>
                                </FormGroupWrapper>
                              ))
                            }
                            {
                              customKeyConfigs.includes(config?.key) && config?.options?.length > 0 && config?.options?.filter(option => ((option.value === 'external_id') || (option.value === 'driver') || (option.value === 'driver_group_general') || (orderTypesByNumbers.includes(config?.key) ? guestOrderTypeValues : orderTypeValues).includes(option.value))).map((item, j) => (
                                <FormGroupWrapper key={j}>
                                  <FormGroupCheck className='checkbox'>
                                    <label>
                                      <input
                                        type='checkbox'
                                        name={item?.value}
                                        data-id={config?.id}
                                        defaultChecked={config?.value.split('|').includes(item?.value)}
                                        onChange={(e) => handleCheckBoxChange(e, true, config?.value)}
                                      />
                                      {t(item.text.toUpperCase(), item.text.replace(/_/g, ' ').toLowerCase())}
                                    </label>
                                  </FormGroupCheck>
                                </FormGroupWrapper>
                              ))
                            }
                            {
                              !config?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
                            }
                          </CheckBoxWrapper>
                        )
                      }
                      {
                        config.type === 4 && (
                          config.key === 'driver_tip_options'
                            ? (
                              <FormGroupText className='form-group'>
                                <label>{config?.name}</label>
                                {config?.description && <Description>{config?.description}</Description>}
                                <input
                                  type='text'
                                  defaultValue={formatArray(config?.value)}
                                  onChange={(e) => handleInputChange(e.target.value, config?.id)}
                                  className='form-control'
                                  placeholder='placeholder'
                                />
                              </FormGroupText>
                              )
                            : (
                              <CheckBoxWrapper>
                                {config?.name && (
                                  <label>{config?.name}</label>
                                )}
                                {config?.description && (
                                  <p>{config?.description}</p>
                                )}
                                {
                                  config?.options?.length > 0 && config?.options?.map((item, j) => (
                                    <FormGroupWrapper key={j}>
                                      <FormGroupCheck className='checkbox'>
                                        <label>
                                          <input
                                            type='checkbox'
                                            name={item?.value}
                                            data-id={config?.id}
                                            defaultChecked={parseJsonArray(config?.value).includes(parseInt(item?.value))}
                                            onChange={(e) => handleCheckBoxChange(e, false, config?.value)}
                                          />
                                          {item.text}
                                        </label>
                                      </FormGroupCheck>
                                    </FormGroupWrapper>
                                  ))
                                }
                                {!config?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>}
                              </CheckBoxWrapper>
                              )
                        )
                      }
                      {
                        config.type === 5 && (
                          <SettingsImage
                            config={config}
                            saveConfig={saveConfig}
                          />
                        )
                      }
                      {config.type === 6 && (
                        <FormGroupText className='form-group'>
                          <label>{config?.name}</label>
                          {config?.description && <Description>{config?.description}</Description>}
                          <CompactTable>
                            <Table>
                              <thead>
                                <tr>
                                  <th>{t('SETTINGS_PREORDER_TYPE', 'Order type')}</th>
                                  <th>{t(type6Unit.labelKey, type6Unit.label)}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {getPreorderTypeRows(config?.value, {
                                  includeCatering: includeCateringTypes
                                }).map((row) => {
                                  const copy = getSettingsType6TypeLabel(row.type)
                                  return (
                                    <tr key={row.type}>
                                      <td>{t(copy.labelKey, copy.label)}</td>
                                      <td>
                                        <input
                                          type='number'
                                          min='0'
                                          value={row.value}
                                          onChange={(event) => handleInputChange(
                                            updateType6Value(config?.value, row.type, event.target.value),
                                            config.id
                                          )}
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </Table>
                          </CompactTable>
                        </FormGroupText>
                      )}
                      {config.type === 7 && (
                        <FormGroupText className='form-group'>
                          <label>{config?.name}</label>
                          {config?.description && <Description>{config?.description}</Description>}
                          <input
                            type='password'
                            value={inputPresentation.value ?? ''}
                            onChange={(e) => handleInputChange(e.target.value, config?.id)}
                            className='form-control'
                            placeholder={inputPresentation.placeholder}
                          />
                        </FormGroupText>
                      )}
                    </ConfigRow>
    )
  })

  const renderForm = () => (
    <FormContainer>
      {renderLeftoverRows(leadingLeftoverConfigs)}
      <SettingsCustomBlocks
        key={product ? `blocks:${revision || 0}` : undefined}
        configs={configs}
        handleInputChange={product ? handleProductInputChange : handleInputChange}
        focus={effectiveFocus}
        fieldErrors={product ? fieldErrors : undefined}
      />
      {renderLeftoverRows(trailingLeftoverConfigs)}
    </FormContainer>
  )

  // What the save bar says went wrong: fields to fix (validation), or the API failing (all of it, or after some were stored).
  let barError = null
  const invalidCount = Object.keys(fieldErrors).length
  if (product && invalidCount > 0) {
    barError = { kind: 'validation', invalidCount }
  } else if (product && apiResult?.error && acknowledgedResult !== apiResult) {
    const message = getApiErrorMessage(apiResult.result, t)
    const failedConfig = failedKey ? (configs || []).find(config => config?.key === failedKey) : null
    barError = savedCount > 0 && failedKey
      ? { kind: 'partial', savedCount, failedName: failedConfig ? getFieldName(failedConfig) : failedKey, message }
      : { kind: 'api', message }
  }

  return (
    <>
      <SettingsListContainer>
        {!isRemoveGeneralTitle && (
          <GeneralTitle>
            <p>{t('SETTINGS', 'All Settings')}</p>
          </GeneralTitle>
        )}
        {
          // inside the hub the form stays mounted while it saves (inert, aria-busy), so there is no skeleton
          !product && !settingsState.error && settingsState.loading && (
            <SkeletonWrapper>
              {[...Array(6)].map((_, index) => (
                <div key={`settings-skeleton-${index}`}>
                  <Skeleton height={20} width={200} />
                  <Skeleton height={44} />
                </div>
              ))}
              <Skeleton width={70} height={44} />
            </SkeletonWrapper>
          )
        }
        {
          !settingsState.error && configs && (product || (!settingsState.loading && !settingsState.API)) && (
            <GeneralContainer>
              {product
                ? (
                  <div
                    ref={formRef}
                    className='odc-hub-form'
                    tabIndex={-1}
                    inert={saving ? '' : undefined}
                    aria-busy={saving ? 'true' : undefined}
                  >
                    {renderForm()}
                  </div>
                  )
                : renderForm()}
              {category?.key === 'pro_guest_checkout' && (
                <GuestCheckoutFieldsSetting disableUserColumns />
              )}
            </GeneralContainer>
          )
        }
        {
          !settingsState.loading && settingsState.error && (
            <NotFoundSource
              content={t('NOT_FOUND_CONFIG', 'Sorry, we couldn\'t find the config.')}
              btnTitle={t('PROFILE_CATEGORY_REDIRECT', 'Go to Category Description')}
              onClickButton={onCloseSettingsList}
            />
          )
        }
      </SettingsListContainer>
      {props.deliveryGroups?.groups && props.deliveryGroups?.groups.length > 0 && (
        <DriversGroupsLogisticsService
          {...props}
          curDriversGroup={props.deliveryGroups.groups[0]}
          driversGroupState={{
            ...props.deliveryGroups,
            driversGroup: props.deliveryGroups.groups[0]
          }}
          changesState={props.changesState}
          handleChangesState={props.handleChangesState}
          handleUpdateDriversGroup={props.handleUpdateDeliveryGroup}
        />
      )}
      {product && (
        <SettingsSaveBar
          count={visibleChanges.length}
          names={changeNames}
          saving={saving}
          error={barError}
          saved={saved}
          onDiscard={handleDiscard}
          onSave={handleSubmit}
        />
      )}
      {
        !product && hasVisibleChanges && !settingsState.loading && !settingsState.API && (
          <SubmitBtnWrapper>
            <Button
              color='primary'
              onClick={handleSubmit}
            >
              {t('SAVE', 'Save')}
            </Button>
          </SubmitBtnWrapper>
        )
      }
      {!product && (
        <Alert
          title={t('SETTINGS', 'Settings')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => closeAlert()}
          onAccept={() => closeAlert()}
          closeOnBackdrop={false}
        />
      )}
    </>
  )
}

export const SettingsList = (props) => {
  const configOptionsToHide = []
  if (shouldHideUpsellingConfig()) {
    configOptionsToHide.push({
      key: 'upselling_enabled',
      value: '1'
    })
  }

  const settingsListProps = {
    ...props,
    UIComponent: SettingsListUI,
    configOptionsToHide
  }
  return <SettingsListController {...settingsListProps} />
}
