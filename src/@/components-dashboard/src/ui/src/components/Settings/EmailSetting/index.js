import React, { useState, useEffect } from 'react'
import { useLanguage, SettingsList as SettingsListController } from '../../../../../index'

import { emailSettingsOptionsValues } from './utils'
import { getOrderStatusPrefix as getOrderStatus } from '../../../utils'
import { Button, DefaultSelect } from '../../../styles'

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
  GeneralTitle
} from '../SettingsList/styles'

const EmailSettingUI = (props) => {
  const {
    configs,
    handleCheckBoxChange,
    settingsState,
    handleClickUpdate,
    isRemoveGeneralTitle
  } = props

  const [{ dictionary }, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [selectedType, setSelectedType] = useState('superadmin')
  const [superAdmin, setSuperAdmin] = useState(null)
  const [business, setBusiness] = useState(null)
  const [customer, setCustomer] = useState(null)

  const emailSettingsValues = emailSettingsOptionsValues(t)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  useEffect(() => {
    if (!configs || configs?.length === 0) return
    const _superAdmin = configs.find(config => config.key === 'email_superadmin_states')
    const _business = configs.find(config => config.key === 'email_business_states')
    const _customer = configs.find(config => config.key === 'email_customer_states')
    setSuperAdmin({ ..._superAdmin })
    setBusiness({ ..._business })
    setCustomer({ ..._customer })
  }, [configs])

  useEffect(() => {
    if (settingsState?.result?.error) {
      setAlertState({
        open: true,
        content: settingsState?.result?.result
      })
    }
  }, [settingsState?.result])

  return (
    <>
      <EmailSettingsContainer>
        {!isRemoveGeneralTitle && (
          <GeneralTitle>
            <p>{t('SETTINGS', 'All Settings')}</p>
          </GeneralTitle>
        )}
        <SelectWrapper>
          <DefaultSelect
            placeholder={t('SELECT_ONE', 'Select One')}
            defaultValue={selectedType}
            options={emailSettingsValues}
            onChange={val => setSelectedType(val)}
          />
        </SelectWrapper>
        {selectedType === 'superadmin' && (
          <CheckBoxWrapper>
            {superAdmin?.description && <p>{superAdmin?.description}</p>}
            {superAdmin?.options?.length > 0 && superAdmin?.options?.map((item, j) => (
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
            ))}
            {!superAdmin?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>}
          </CheckBoxWrapper>
        )}
        {selectedType === 'business' && (
          <CheckBoxWrapper>
            {business?.description && <p>{business?.description}</p>}
            {business?.options?.length > 0 && business?.options?.map((item, j) => (
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
            ))}
            {!business?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>}
          </CheckBoxWrapper>
        )}
        {selectedType === 'customer' && (
          <CheckBoxWrapper>
            {customer?.description && <p>{customer?.description}</p>}
            {customer?.options?.length > 0 && customer?.options?.map((item, j) => (
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
            ))}
            {!customer?.options && <OptionsError>{t('NO_OPTIONS_VALUE', 'There is no options value')}</OptionsError>}
          </CheckBoxWrapper>
        )}
        {settingsState?.changes?.length > 0 && (
            <SubmitBtnWrapper>
              <Button color='primary' onClick={handleClickUpdate}>{t('SAVE', 'Save')}</Button>
            </SubmitBtnWrapper>
        )}
      </EmailSettingsContainer>
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

export const EmailSetting = (props) => {
  const emailSettingProps = {
    ...props,
    UIComponent: EmailSettingUI
  }
  return <SettingsListController {...emailSettingProps} />
}
