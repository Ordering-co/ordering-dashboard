import React, { useState, useEffect, useContext, useRef } from 'react'
import { Accordion, AccordionContext, useAccordionToggle, OverlayTrigger, Tooltip } from 'react-bootstrap'
import { useLanguage, SettingsList as SettingsListController } from '../../../../../index'
import { SettingsSelectUI } from '../SettingsSelectUI'
import { SecretField } from '../../Shared/Product/SecretField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { useLabelFocusesTrigger } from '../SettingsHubForm/useLabelFocusesTrigger'
import { getSettingsSelectOptions } from '../../../../../utils/settingsSelectOptions'
import { Button, IconButton } from '../../../styles'
import { getOrderStatusPrefix as getOrderStatus } from '../../../utils'
import {
  applySettingsConfigCopy,
  getSettingsBlockFocusId,
  getSettingsChangeName,
  getSettingsFocusId,
  isCustomBlockConfig,
  isSettingsConfigVisible
} from '../../../../../utils/settingsCustomSections'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { SettingsCustomBlocks } from '../SettingsCustomBlocks'
import { isSecretConfig } from '../SettingsList/secretConfigKeys'
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext' // redesign settings D
import { useHubFormReport, useSavedNotice } from '../SettingsHubForm/useHubFormReport'
import { SettingsSaveBar } from '../SettingsHubForm/SettingsSaveBar'
import { Alert } from '../../Shared'
import { InfoCircle } from 'react-bootstrap-icons'
import {
  NotificationSettingContainer,
  AccordionTitle,
  GeneralWrapper,
  ToggleItemWrapper,
  TitleWrapper
} from './styles'
import {
  FormGroupText,
  CheckBoxWrapper,
  FormGroupWrapper,
  FormGroupCheck,
  OptionsError,
  SubmitBtnWrapper,
  GeneralTitle,
  Description
} from '../SettingsList/styles'

// inside the hub a type 2 dropdown takes the Product anatomy of the hub rows (the C18 trigger names itself «label + value»,
// as ProductSettingsRow's FramedSelect does) instead of the legacy trigger, whose only name was its value («Yes»).
const FIT_TRIGGER = { fitTrigger: true }

const NotificationSelect = ({ config, name, labelId, onSelect }) => {
  const [, t] = useLanguage()
  const rootRef = useRef(null)
  useLabelFocusesTrigger(rootRef, labelId)
  const list = getSettingsSelectOptions({ config, t })
  if (!list) return <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
  const items = list.map(item => (
    item.custom
      ? {
          value: item.value,
          content: item.label,
          showOnSelected: (
            <input
              className='odc-hub-custom-input'
              aria-label={`${name} · ${item.label}`}
              placeholder={item.label}
              defaultValue={config?.value}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onSelect(event.target.value)}
            />
          )
        }
      : { value: item.value, content: item.label }
  ))
  return (
    <span ref={rootRef} className='odc-hub-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={labelId}
          ariaLabel={name}
          options={items}
          defaultValue={config?.value}
          onChange={onSelect}
          placeholder={t('SELECT_A_OPTION', 'Select a option')}
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

// redesign settings D: the text of an error of the API, whatever shape it comes in (a list of messages, a message, an Error).
const getApiErrorMessage = (result, t) => {
  if (Array.isArray(result)) return result.map(item => translateApiMessage(t, item, '')).filter(Boolean).join(' ')
  if (typeof result === 'string') return translateApiMessage(t, result, '')
  if (result && typeof result.message === 'string') return translateApiMessage(t, result.message, '')
  return ''
}

const NOTIFICATION_STATES_KEYS = ['notification_superadmin_states', 'notification_business_states', 'notification_customer_states', 'notification_driver_states']

// redesign (n.º 9, review L2 #1): the accordion that holds a config key: each states key has its own (Administrator,
// Business, Customer, Driver: eventKeys 1–4), everything else (the fields and the custom blocks, order alerts included) is General
const accordionOf = (key) => {
  const index = NOTIFICATION_STATES_KEYS.indexOf(key)
  return index === -1 ? '0' : String(index + 1)
}
const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
const isTextEntry = (node) => node.tagName === 'TEXTAREA' || (node.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(node.type))

// , a credential (type 7, or a type 1 key of secretConfigKeys.js) is the hub's P/SecretField: hidden by
// default, with «Show» and the last four characters. What is saved does not change.
const NotificationSecret = ({ config, onChange }) => {
  const [, t] = useLanguage()
  const [endsBefore, endsAfter] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
  return (
    <SecretField
      label={config?.name}
      hint={config?.description || undefined}
      defaultValue={config?.value ?? ''}
      showLabel={t('SHOW', 'Show')}
      hideLabel={t('HIDE', 'Hide')}
      endingLabel={ending => <>{endsBefore}{ending}{endsAfter}</>}
      onChange={onChange}
    />
  )
}

const NotificationSettingUI = (props) => {
  const {
    category,
    configs,
    handleInputChange,
    handleCheckBoxChange,
    settingsState,
    handleClickUpdate,
    isRemoveGeneralTitle,
    // redesign settings D: given by the controller, used only inside the hub
    handleDiscardChanges,
    revision,
    saving: isSaving,
    savedCount,
    failedKey,
    focus
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // redesign settings D: inside the hub the screen is drawn with the shared save bar and reports to the hub.
  const hubForm = useSettingsHubForm()
  const product = !!hubForm
  const formRef = useRef(null)

  const tooltips = {
    notification_times_repeat: t('MAX_TIMES_TO_REPEAT_15', 'Max times to repeat = 15'),
    notification_each_time_repeat: t('EACH_TIME_SETTING_SET_IN_SECONDS', 'Each time setting set in seconds'),
    notification_superadmin_repeat: t('NOTIFICATION_REPEAT_WORKS_WITH_PENDING_READY', 'Notification repeat works only with Pending (0) and Order Ready (4) status'),
    notification_business_repeat: t('PENDING_STATUS_WORKS_FOR_ADMIN_DRIVER_BUSINESS_USER', 'Pending status works for admin, driver, business user'),
    notification_driver_repeat: t('ORDER_READY_WORKS_WITH_DRIVER_USER', 'Order Ready works only with driver user')
  }

  // each Information button names its field, so six of them are not six «Information»
  const infoLabel = (fieldName) => t('INFORMATION_ABOUT_FIELD', 'Information about _field_').replace('_field_', fieldName ?? '')

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  // redesign settings D: read from `configs` on every render (they were state set in an effect), so the controls
  // that remount after a Discard start from the restored values and not from the previous render's.
  const hasConfigs = !!configs && configs.length > 0
  const general = hasConfigs ? configs.filter(config => !NOTIFICATION_STATES_KEYS.includes(config.key) && !isCustomBlockConfig(config.key)) : null
  const superAdmin = hasConfigs ? { ...configs.find(config => config.key === 'notification_superadmin_states') } : null
  const business = hasConfigs ? { ...configs.find(config => config.key === 'notification_business_states') } : null
  const customer = hasConfigs ? { ...configs.find(config => config.key === 'notification_customer_states') } : null
  const driver = hasConfigs ? { ...configs.find(config => config.key === 'notification_driver_states') } : null

  // The changes count by visible field, as in SettingsList: a dependent hidden by its master is not sent and does not count.
  const visibleChanges = product
    ? (settingsState?.changes || []).filter(item => isSettingsConfigVisible(item, configs))
    : []
  const isDirty = visibleChanges.length > 0
  const saving = !!isSaving
  const apiResult = settingsState?.result
  const getFieldName = (item) => {
    const source = (configs || []).find(config => config?.id === item?.id) || item
    return getSettingsChangeName(source, t) || item?.key
  }
  const saved = useSavedNotice({
    saving,
    succeeded: product && !apiResult?.error && !(settingsState?.changes?.length > 0)
  })
  useHubFormReport(category?.key, { dirty: isDirty, saving })

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

  // redesign (n.º 9, review L2 #1): with `?focus=` the hub opens the accordion that holds the key and lands on its first
  // control, once per key, centred (as SettingsList does); never on a text control on a phone, where it would open the keyboard.
  // Without `?focus=` every accordion starts closed, as before.
  const [openAccordion, setOpenAccordion] = useState(() => (product && focus ? accordionOf(focus) : null))
  const focusedForRef = useRef(null)
  const isPhone = useIsPhone()
  useEffect(() => {
    if (product && focus) setOpenAccordion(accordionOf(focus))
  }, [product, focus])
  useEffect(() => {
    if (!product || !focus || !hasConfigs || focusedForRef.current === focus) return
    const node = document.getElementById(getSettingsFocusId(focus)) || document.getElementById(getSettingsBlockFocusId(focus))
    if (!node) return
    focusedForRef.current = focus
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ block: 'center' })
    const target = node.querySelector(FOCUSABLE)
    if (target && !(isPhone && isTextEntry(target))) target.focus({ preventScroll: true })
  }, [product, focus, hasConfigs, openAccordion])

  // Inside the hub the visible label of a text or password input is bound to it.
  const getInputId = (config) => product ? `notification-setting-${config?.id ?? config?.key}` : undefined

  return (
    <>
      {/* inside the hub the screen stays mounted while it saves (inert, aria-busy), so there is no skeleton */}
      <NotificationSettingContainer
        ref={product ? formRef : undefined}
        className={product ? 'odc-hub-form' : undefined}
        tabIndex={product ? -1 : undefined}
        inert={product && saving ? '' : undefined}
        aria-busy={product && saving ? 'true' : undefined}
      >
        {!isRemoveGeneralTitle && (
          <GeneralTitle>
            <p>{t('SETTINGS', 'All Settings')}</p>
          </GeneralTitle>
        )}
        <Accordion activeKey={openAccordion} onSelect={setOpenAccordion}>
          <ContextAwareToggle eventKey='0'>
            <AccordionTitle>{t('GENERAL', 'General')}</AccordionTitle>
          </ContextAwareToggle>
          <Accordion.Collapse eventKey='0'>
            <GeneralWrapper>
              <SettingsCustomBlocks
                key={product ? `blocks:${revision || 0}` : undefined}
                configs={configs}
                handleInputChange={handleInputChange}
              />
              {
                general?.length > 0 && general.map((config, i) => {
                  const displayConfig = applySettingsConfigCopy(config, t)
                  // a type 1 credential (secretConfigKeys.js) takes the password input of type 7
                  const secret = isSecretConfig(config)
                  return (
                  <div key={product ? `${config?.key || i}:${revision || 0}` : i}>
                    {
                      config.type === 1 && !secret && (
                        <FormGroupText className='form-group'>
                          <TitleWrapper>
                            <label htmlFor={getInputId(config)}>{displayConfig?.name}</label>
                            {tooltips?.[config?.key] && (
                              <OverlayTrigger
                                placement='bottom'
                                overlay={
                                  <Tooltip>
                                    {tooltips?.[config?.key]}
                                  </Tooltip>
                                }
                              >
                                <IconButton
                                  color='primary'
                                  className='tour_btn'
                                  aria-label={infoLabel(displayConfig?.name)}
                                >
                                  <InfoCircle />
                                </IconButton>
                              </OverlayTrigger>
                            )}
                          </TitleWrapper>
                          {displayConfig?.description && <Description>{displayConfig.description}</Description>}
                          <input
                            id={getInputId(config)}
                            type='text'
                            defaultValue={config?.value}
                            onChange={(e) => handleInputChange(e.target.value, config?.id)}
                            className='form-control'
                            placeholder={displayConfig?.name}
                          />
                        </FormGroupText>
                      )
                    }
                    {
                      config.type === 2 && (
                        <>
                          <TitleWrapper>
                            <label id={product ? `${getInputId(config)}-label` : undefined}>{displayConfig?.name}</label>
                            {tooltips?.[config?.key] && (
                              <OverlayTrigger
                                placement='bottom'
                                overlay={
                                  <Tooltip>
                                    {tooltips?.[config?.key]}
                                  </Tooltip>
                                }
                              >
                                <IconButton
                                  color='primary'
                                  className='tour_btn'
                                  aria-label={infoLabel(displayConfig?.name)}
                                >
                                  <InfoCircle />
                                </IconButton>
                              </OverlayTrigger>
                            )}
                          </TitleWrapper>
                          {displayConfig?.description && <Description>{displayConfig.description}</Description>}
                          {product
                            ? (
                              <NotificationSelect
                                config={displayConfig}
                                name={displayConfig?.name}
                                labelId={`${getInputId(config)}-label`}
                                onSelect={(value) => handleInputChange(value, config?.id)}
                              />
                              )
                            : (
                              <SettingsSelectUI
                                noHeader
                                config={displayConfig}
                                defaultValue={config?.value}
                                handleSelectChange={(value) => handleInputChange(value, config?.id)}
                              />
                              )}
                        </>
                      )
                    }
                    {
                      secret && (
                        <NotificationSecret
                          config={displayConfig}
                          onChange={(value) => handleInputChange(value, config?.id)}
                        />
                      )
                    }
                  </div>
                  )
                })
              }
            </GeneralWrapper>
          </Accordion.Collapse>
          <ContextAwareToggle eventKey='1'>
            <AccordionTitle>{t('ADMINISTRATOR', 'Administrator')}</AccordionTitle>
          </ContextAwareToggle>
          <Accordion.Collapse eventKey='1'>
            <CheckBoxWrapper key={product ? `superadmin:${revision || 0}` : undefined}>
              {superAdmin?.description && <p>{superAdmin?.description}</p>}
              {
                superAdmin?.options?.length > 0 && superAdmin?.options?.map((item, j) => (
                  <FormGroupWrapper key={j}>
                    <FormGroupCheck className='checkbox'>
                      <label>
                        <input
                          type='checkbox'
                          name={item?.value}
                          data-id={superAdmin?.id}
                          defaultChecked={superAdmin?.value.split('|').includes(item?.value)}
                          onChange={(e) => handleCheckBoxChange(e, true, superAdmin?.value)}
                        />
                        {getOrderStatus(item.value, dictionary)}
                      </label>
                    </FormGroupCheck>
                  </FormGroupWrapper>
                ))
              }
              {
                !superAdmin?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
              }
            </CheckBoxWrapper>
          </Accordion.Collapse>
          <ContextAwareToggle eventKey='2'>
            <AccordionTitle>{t('BUSINESS', 'Business')}</AccordionTitle>
          </ContextAwareToggle>
          <Accordion.Collapse eventKey='2'>
            <CheckBoxWrapper key={product ? `business:${revision || 0}` : undefined}>
              {business?.description && <p>{business?.description}</p>}
              {
                business?.options?.length > 0 && business?.options?.map((item, j) => (
                  <FormGroupWrapper key={j}>
                    <FormGroupCheck className='checkbox'>
                      <label>
                        <input
                          type='checkbox'
                          name={item?.value}
                          data-id={business?.id}
                          defaultChecked={business?.value.split('|').includes(item?.value)}
                          onChange={(e) => handleCheckBoxChange(e, true, business?.value)}
                        />
                        {getOrderStatus(item.value, dictionary)}
                      </label>
                    </FormGroupCheck>
                  </FormGroupWrapper>
                ))
              }
              {
                !business?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
              }
            </CheckBoxWrapper>
          </Accordion.Collapse>
          <ContextAwareToggle eventKey='3'>
            <AccordionTitle>{t('CUSTOMER', 'Customer')}</AccordionTitle>
          </ContextAwareToggle>
          <Accordion.Collapse eventKey='3'>
            <CheckBoxWrapper key={product ? `customer:${revision || 0}` : undefined}>
              {customer?.description && <p>{customer?.description}</p>}
              {
                customer?.options?.length > 0 && customer?.options?.map((item, j) => (
                  <FormGroupWrapper key={j}>
                    <FormGroupCheck className='checkbox'>
                      <label>
                        <input
                          type='checkbox'
                          name={item?.value}
                          data-id={customer?.id}
                          defaultChecked={customer?.value.split('|').includes(item?.value)}
                          onChange={(e) => handleCheckBoxChange(e, true, customer?.value)}
                        />
                        {getOrderStatus(item.value, dictionary)}
                      </label>
                    </FormGroupCheck>
                  </FormGroupWrapper>
                ))
              }
              {
                !customer?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
              }
            </CheckBoxWrapper>
          </Accordion.Collapse>
          <ContextAwareToggle eventKey='4'>
            <AccordionTitle>{t('DRIVER', 'Driver')}</AccordionTitle>
          </ContextAwareToggle>
          <Accordion.Collapse eventKey='4'>
            <CheckBoxWrapper key={product ? `driver:${revision || 0}` : undefined}>
              {driver?.description && <p>{driver?.description}</p>}
              {
                driver?.options?.length > 0 && driver?.options?.map((item, j) => (
                  <FormGroupWrapper key={j}>
                    <FormGroupCheck className='checkbox'>
                      <label>
                        <input
                          type='checkbox'
                          name={item?.value}
                          data-id={driver?.id}
                          defaultChecked={driver?.value.split('|').includes(item?.value)}
                          onChange={(e) => handleCheckBoxChange(e, true, driver?.value)}
                        />
                        {getOrderStatus(item.value, dictionary)}
                      </label>
                    </FormGroupCheck>
                  </FormGroupWrapper>
                ))
              }
              {
                !driver?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>
              }
            </CheckBoxWrapper>
          </Accordion.Collapse>
        </Accordion>
        {
          !product && settingsState?.changes?.length > 0 && (
            <SubmitBtnWrapper>
              <Button color='primary' onClick={handleClickUpdate}>{t('SAVE', 'Save')}</Button>
            </SubmitBtnWrapper>
          )
        }
      </NotificationSettingContainer>
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
          title={t('NOTIFICATION_SETTINGS', 'Notifications settings')}
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

export const NotificationSetting = (props) => {
  const notificationSettingProps = {
    ...props,
    UIComponent: NotificationSettingUI
  }
  return <SettingsListController {...notificationSettingProps} />
}

const ContextAwareToggle = ({ children, eventKey, callback }) => {
  const currentEventKey = useContext(AccordionContext)
  const decoratedOnClick = useAccordionToggle(
    eventKey,
    () => callback && callback(eventKey)
  )
  const isCurrentEventKey = currentEventKey === eventKey

  const handleButtonClick = () => {
    decoratedOnClick()
  }
  return (
    <ToggleItemWrapper
      active={isCurrentEventKey}
      aria-expanded={isCurrentEventKey}
      onClick={handleButtonClick}
    >
      {children}
    </ToggleItemWrapper>
  )
}
