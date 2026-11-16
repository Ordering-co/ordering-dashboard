import React, { useState, useEffect, useRef } from 'react'
import { useLanguage, SettingsList as SettingsListController } from '../../../../../index'

import { emailSettingsOptionsValues } from './utils'
import { getOrderStatusPrefix as getOrderStatus } from '../../../utils'
import { Button, DefaultSelect } from '../../../styles'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { applySettingsConfigCopy, getSettingsFocusId, isSettingsConfigVisible } from '../../../../../utils/settingsCustomSections'
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext' // redesign settings D
import { useHubFormReport, useSavedNotice } from '../SettingsHubForm/useHubFormReport'
import { SettingsSaveBar } from '../SettingsHubForm/SettingsSaveBar'

import { Alert } from '../../Shared'
import {
  EmailSettingsContainer,
  SelectWrapper
} from './styles'

import {
  CheckBoxWrapper,
  FormGroupWrapper,
  FormGroupCheck,
  OptionsError,
  SubmitBtnWrapper,
  GeneralTitle,
  ConfigRow
} from '../SettingsList/styles'

// redesign settings D: the text of an error of the API, whatever shape it comes in (a list of messages, a message, an Error).
const getApiErrorMessage = (result, t) => {
  if (Array.isArray(result)) return result.map(item => translateApiMessage(t, item, '')).filter(Boolean).join(' ')
  if (typeof result === 'string') return translateApiMessage(t, result, '')
  if (result && typeof result.message === 'string') return translateApiMessage(t, result.message, '')
  return ''
}

// `?focus=` names one of the three configs; each one is a level of the select.
const EMAIL_LEVEL_CONFIG_KEYS = {
  superadmin: 'email_superadmin_states',
  business: 'email_business_states',
  customer: 'email_customer_states'
}
const getFocusedEmailLevel = (focus) => (
  Object.keys(EMAIL_LEVEL_CONFIG_KEYS).find(level => EMAIL_LEVEL_CONFIG_KEYS[level] === focus) || null
)

const EmailSettingUI = (props) => {
  const {
    category,
    configs,
    handleCheckBoxChange,
    settingsState,
    handleClickUpdate,
    isRemoveGeneralTitle,
    focus,
    // redesign settings D: given by the controller, used only inside the hub
    handleDiscardChanges,
    revision,
    saving: isSaving,
    savedCount,
    failedKey
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const focusedLevel = getFocusedEmailLevel(focus)
  const [selectedType, setSelectedType] = useState(focusedLevel || 'superadmin')
  const focusedForRef = useRef(null)
  // redesign settings D: inside the hub the screen is drawn with the shared save bar and reports to the hub.
  const hubForm = useSettingsHubForm()
  const product = !!hubForm
  const formRef = useRef(null)

  const emailSettingsValues = emailSettingsOptionsValues(t)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // redesign settings D: read from `configs` on every render (they were state set in an effect), so the checkboxes
  // that remount after a Discard start from the restored values and not from the previous render's.
  const hasConfigs = !!configs && configs.length > 0
  const superAdmin = hasConfigs ? { ...configs.find(config => config.key === 'email_superadmin_states') } : null
  const business = hasConfigs ? { ...configs.find(config => config.key === 'email_business_states') } : null
  const customer = hasConfigs ? { ...configs.find(config => config.key === 'email_customer_states') } : null

  // The changes count by visible field, as in SettingsList: a dependent hidden by its master is not sent and does not count.
  const visibleChanges = product
    ? (settingsState?.changes || []).filter(item => isSettingsConfigVisible(item, configs))
    : []
  const isDirty = visibleChanges.length > 0
  const saving = !!isSaving
  const apiResult = settingsState?.result
  const getFieldName = (item) => {
    const source = (configs || []).find(config => config?.id === item?.id) || item
    return applySettingsConfigCopy(source, t)?.name || item?.key
  }
  const saved = useSavedNotice({
    saving,
    succeeded: product && !apiResult?.error && !(settingsState?.changes?.length > 0)
  })
  useHubFormReport(category?.key, { dirty: isDirty, saving })

  // a new `?focus=` opens the level that holds the key
  useEffect(() => {
    if (focusedLevel) setSelectedType(focusedLevel)
  }, [focusedLevel])

  // Once for each value of `focus`, as SettingsList does: bring the row into view and, inside the hub, give its first control the
  // focus (never again after a save or a re-render, which would take it back from the user).
  useEffect(() => {
    if (!focusedLevel || !hasConfigs || selectedType !== focusedLevel || focusedForRef.current === focus) return
    const node = document.getElementById(getSettingsFocusId(focus))
    if (!node) return
    focusedForRef.current = focus
    // a level taller than the screen (its status list is ~1600px) is shown from its start, where its label, its selector
    // and the control that takes the focus are; centring it would leave all three above the screen (review of batch S)
    const tall = node.getBoundingClientRect().height > window.innerHeight
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: tall ? 'start' : 'center' })
    if (product) node.querySelector('input:not([type="hidden"]):not([disabled])')?.focus({ preventScroll: true })
  }, [focus, focusedLevel, hasConfigs, selectedType, product])

  useEffect(() => {
    // inside the hub a failed save is shown in the save bar, not in the modal Alert
    if (!product && settingsState?.result?.error) {
      setAlertState({
        open: true,
        content: settingsState?.result?.result
      })
    }
  }, [settingsState?.result])

  // What the save bar says went wrong: the API failing, all of it or after some were stored. It goes with the pending changes.
  let barError = null
  if (product && apiResult?.error && isDirty) {
    const message = getApiErrorMessage(apiResult.result, t)
    const failedConfig = failedKey ? (configs || []).find(config => config?.key === failedKey) : null
    barError = savedCount > 0 && failedKey
      ? { kind: 'partial', savedCount, failedName: failedConfig ? getFieldName(failedConfig) : failedKey, message }
      : { kind: 'api', message }
  }

  const handleDiscard = () => {
    handleDiscardChanges && handleDiscardChanges()
    // the buttons that had the focus are gone with the bar: keep the keyboard user inside the form
    formRef.current?.focus({ preventScroll: true })
  }

  const renderLevel = (config, levelKey) => (
    <ConfigRow
      key={product ? `${levelKey}:${revision || 0}` : undefined}
      id={getSettingsFocusId(EMAIL_LEVEL_CONFIG_KEYS[levelKey])}
      $focused={focus === EMAIL_LEVEL_CONFIG_KEYS[levelKey]}
    >
      <CheckBoxWrapper>
        {config?.description && <p>{config?.description}</p>}
        {config?.options?.length > 0 && config?.options?.map((item, j) => (
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
                {getOrderStatus(item.value, dictionary)}
              </label>
            </FormGroupCheck>
          </FormGroupWrapper>
        ))}
        {!config?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>}
      </CheckBoxWrapper>
    </ConfigRow>
  )

  const renderForm = () => (
    <>
      <SelectWrapper>
        <DefaultSelect
          placeholder={t('SELECT_ONE', 'Select One')}
          defaultValue={selectedType}
          options={emailSettingsValues}
          onChange={val => setSelectedType(val)}
        />
      </SelectWrapper>
      {selectedType === 'superadmin' && renderLevel(superAdmin, 'superadmin')}
      {selectedType === 'business' && renderLevel(business, 'business')}
      {selectedType === 'customer' && renderLevel(customer, 'customer')}
    </>
  )

  return (
    <>
      <EmailSettingsContainer>
        {!isRemoveGeneralTitle && (
          <GeneralTitle>
            <p>{t('SETTINGS', 'All Settings')}</p>
          </GeneralTitle>
        )}
        {product
          ? (
            // inside the hub the screen stays mounted while it saves (inert, aria-busy), so there is no skeleton
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
        {!product && settingsState?.changes?.length > 0 && (
            <SubmitBtnWrapper>
              <Button color='primary' onClick={handleClickUpdate}>{t('SAVE', 'Save')}</Button>
            </SubmitBtnWrapper>
        )}
      </EmailSettingsContainer>
      {product && (
        <SettingsSaveBar
          count={visibleChanges.length}
          names={visibleChanges.map(getFieldName)}
          saving={saving}
          error={barError}
          saved={saved}
          onDiscard={handleDiscard}
          onSave={handleClickUpdate}
        />
      )}
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

export const EmailSetting = (props) => {
  const emailSettingProps = {
    ...props,
    UIComponent: EmailSettingUI
  }
  return <SettingsListController {...emailSettingProps} />
}
