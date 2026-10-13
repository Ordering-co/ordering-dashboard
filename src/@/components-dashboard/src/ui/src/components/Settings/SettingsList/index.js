import React, { useEffect, useState } from 'react'
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
import {
  applySettingsConfigCopy,
  findConfigByKey,
  getLeftoverSettingsConfigs,
  getRecaptchaSubmitErrorCodes,
  getSettingsBlockFocusId,
  getSettingsFieldDependency,
  getSettingsFocusId,
  getSettingsInputPresentation,
  getPreorderTypeRows,
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

const invertedValuesConfigs = ['business_signup_enabled_default', 'driver_signup_enabled_default']
const configsTypecColors = ['dashboard_buttons_colors']
const RECAPTCHA_SUBMIT_ERROR_COPY = {
  SETTINGS_RECAPTCHA_SCORE_RANGE: 'Enter a score between 0 and 1.',
  SETTINGS_RECAPTCHA_ENABLE_INVALID: 'Fill the required keys for the selected version before enabling reCAPTCHA.'
}

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
    focus
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })

  const customKeyConfigs = ['filter_order_options', 'allowed_order_types_guest_checkout', 'default_order_type', 'order_types_allowed', 'unaddressed_order_types_allowed']

  const orderTypesByNumbers = ['order_types_allowed', 'unaddressed_order_types_allowed']
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

  const formatArray = (values) => {
    values = values.replace('[', '')
    values = values.replace(']', '')
    return values
  }

  const handleSubmit = () => {
    const invalidMessageList = []
    for (const item of formState.changes) {
      switch (item?.key) {
        case 'driver_tip_options':
          !/^((\d)+,)*(\d)+$/.test(item.value) && invalidMessageList.push(t('DRIVER_TIP_OPTIONS_ERROR'))
          break
        case 'max_days_preorder':
          item.value < 1 && invalidMessageList.push(t('MAX_PREORDER_DAYS_MUST_BIGGER_ZERO', 'Max preorder days must be bigger than zero'))
          break
        case 'platform_fee_fixed':
        case 'platform_fee_percentage':
          if (isNaN(Number(item?.value))) {
            invalidMessageList.push(t('VALIDATION_ERROR_NUMERIC', `The ${item?.name} must be a number.`).replace('_attribute_', item?.name))
          }
          if (item?.key === 'platform_fee_percentage' && Number(item?.value) > 100) {
            invalidMessageList.push(t('VALIDATION_MUST_SMALLER_HUNDRED', `${item?.name} must be not bigger than 100`).replace('_attribute_', item?.name))
          }
          break
        default:
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
        invalidMessageList.push(t(code, RECAPTCHA_SUBMIT_ERROR_COPY[code] || code))
      })
    }
    if (invalidMessageList.length > 0) {
      setAlertState({ open: true, content: invalidMessageList })
      return
    }
    handleClickUpdate && handleClickUpdate()
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
    if (settingsState?.result?.error) {
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
    const scrollToFocus = () => {
      if (cancelled) return false
      const node = document.getElementById(getSettingsFocusId(effectiveFocus)) ||
        document.getElementById(getSettingsBlockFocusId(effectiveFocus))
      if (node && typeof node.scrollIntoView === 'function') {
        node.scrollIntoView({ block: 'center' })
        return true
      }
      return false
    }

    if (scrollToFocus()) return

    const frameId = requestAnimationFrame(() => {
      scrollToFocus()
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [effectiveFocus, settingsState.loading])

  const renderLeftoverRows = (rows) => rows.map((config, i) => {
    // Only dependents get the placeholder treatment; other text
    // configs may legitimately store copy that looks like a hint.
    const inputPresentation = getSettingsFieldDependency(config.key)
      ? getSettingsInputPresentation(config)
      : { value: config?.value ?? '', placeholder: config?.name }
    const type6Unit = getSettingsType6Unit(config.key)
    return (
                    <ConfigRow
                      key={config.key || config.id || `settings-row-${i}`}
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
                              <ColorPicker
                                defaultColor={config?.value}
                                onChangeColor={(color) => handleInputChange(color, config?.id)}
                              />
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

  return (
    <>
      <SettingsListContainer>
        {!isRemoveGeneralTitle && (
          <GeneralTitle>
            <p>{t('SETTINGS', 'All Settings')}</p>
          </GeneralTitle>
        )}
        {
          !settingsState.error && settingsState.loading && (
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
          !settingsState.error && !settingsState.loading && configs && !settingsState.API && (
            <GeneralContainer>
              <FormContainer>
                {renderLeftoverRows(leadingLeftoverConfigs)}
                <SettingsCustomBlocks
                  configs={configs}
                  handleInputChange={handleInputChange}
                  focus={effectiveFocus}
                />
                {renderLeftoverRows(trailingLeftoverConfigs)}
              </FormContainer>
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
      {
        hasVisibleChanges && !settingsState.loading && !settingsState.API && (
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
      <Alert
        title={t('SETTINGS', 'Settings')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
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
