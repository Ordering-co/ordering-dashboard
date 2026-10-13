import React, { useState, useMemo } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Switch } from '../../../styles'
import { useSession } from '../../../../../index'
import { Input } from '../../../styles/Inputs'
import { Select } from '../../../styles/Select/FirstSelect'

import {
  DetailsContainer,
  DetailsHeader,
  FormSection,
  FieldsColumn,
  FieldsRow,
  Field,
  FormActions,
  RecurrentSwitchWrapper
} from './styles'

export const BusinessFeeForm = (props) => {
  const {
    isEdit,
    actionLoading,
    formState,
    setFormState,
    handleSubmit,
    deliveryTypeOptions,
    recurringPeriodOptions,
    sitesOptions,
    paymethodsOptions
  } = props

  const [, t] = useLanguage()
  const [{ user }] = useSession()

  const [deliveryTypeSearch, setDeliveryTypeSearch] = useState('')
  const [siteSearch, setSiteSearch] = useState('')
  const [paymethodSearch, setPaymethodSearch] = useState('')

  const isRecurrent = !!formState.recurring_period

  const handleChange = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
  }

  const handleRecurrentChange = (val) => {
    if (val) {
      setFormState((prev) => ({
        ...prev,
        recurring_period: 'weekly',
        recurring_day: '0',
        percentage: '',
        delivery_type: 'all',
        site_id: 'all',
        paymethod_id: 'all'
      }))
    } else {
      setFormState((prev) => ({
        ...prev,
        recurring_period: '',
        recurring_day: ''
      }))
    }
  }

  const handleRecurringPeriodChange = (val) => {
    setFormState((prev) => ({
      ...prev,
      recurring_period: val,
      recurring_day: val === 'weekly' ? '0' : '1'
    }))
  }

  const weekDayOptions = useMemo(() => [
    { value: 0, content: t('SUNDAY', 'Sunday') },
    { value: 1, content: t('MONDAY', 'Monday') },
    { value: 2, content: t('TUESDAY', 'Tuesday') },
    { value: 3, content: t('WEDNESDAY', 'Wednesday') },
    { value: 4, content: t('THURSDAY', 'Thursday') },
    { value: 5, content: t('FRIDAY', 'Friday') },
    { value: 6, content: t('SATURDAY', 'Saturday') }
  ], [t])

  const monthDayOptions = useMemo(() =>
    Array.from({ length: 31 }, (_, i) => ({
      value: i + 1,
      content: String(i + 1)
    }))
  , [])

  const filteredDeliveryTypeOptions = useMemo(() => {
    if (!deliveryTypeSearch) return deliveryTypeOptions
    return deliveryTypeOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(deliveryTypeSearch.toLowerCase())
    )
  }, [deliveryTypeOptions, deliveryTypeSearch])

  const filteredSitesOptions = useMemo(() => {
    if (!siteSearch) return sitesOptions
    return sitesOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(siteSearch.toLowerCase())
    )
  }, [sitesOptions, siteSearch])

  const filteredPaymethodsOptions = useMemo(() => {
    if (!paymethodSearch) return paymethodsOptions
    return paymethodsOptions.filter((opt) =>
      opt.content?.toLowerCase().includes(paymethodSearch.toLowerCase())
    )
  }, [paymethodsOptions, paymethodSearch])

  const filteredRecurringPeriodOptions = useMemo(() => {
    return recurringPeriodOptions.filter((opt) => opt.value !== '')
  }, [recurringPeriodOptions])

  const normalizeDecimalInput = (value) => {
    const cleaned = String(value).replace(/[^0-9.]/g, '')
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('')
    }
    return cleaned
  }

  const normalizePercentageInput = (value) => {
    const cleaned = normalizeDecimalInput(value)
    const num = parseFloat(cleaned)
    if (!Number.isNaN(num) && num > 100) {
      return '100'
    }
    return cleaned
  }

  return (
    <DetailsContainer>
      <DetailsHeader>
        <div>
          <h1>
            {formState.name?.trim()
              ? formState.name
              : (isEdit ? t('EDIT_FEE', 'Edit Fee') : t('ADD_FEE', 'Add Fee'))}
          </h1>
          {isEdit && (
            <Switch
              defaultChecked={!!formState.enabled}
              onChange={(val) => handleChange('enabled', val)}
            />
          )}
        </div>
      </DetailsHeader>

      <FormSection>
        <FieldsColumn>
          <Field>
            <label>{t('NAME', 'Name')}</label>
            <Input
              value={formState.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('ENTER_FEE_NAME', 'Enter fee name')}
              maxLength={100}
            />
          </Field>

          <Field>
            <label>{t('DESCRIPTION', 'Description')}</label>
            <Input
              value={formState.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('ENTER_FEE_DESCRIPTION', 'Enter fee description')}
              maxLength={500}
            />
          </Field>

          <RecurrentSwitchWrapper>
            <Switch
              defaultChecked={isRecurrent}
              onChange={handleRecurrentChange}
            />
            <span>{t('RECURRENT_BUSINESS_FEE', 'Recurrent Business Fee')}</span>
          </RecurrentSwitchWrapper>

          {user?.level === 0 && (
            <Field>
              <label>{t('TAXABLE', 'Taxable')}</label>
              <Switch
                defaultChecked={
                  typeof formState.taxable !== 'undefined'
                    ? formState.taxable
                    : true
                }
                onChange={(val) => handleChange('taxable', val)}
              />
            </Field>
          )}

          {!isRecurrent && (
            <>
              <FieldsRow>
                <Field>
                  <label>{t('DELIVERY_TYPE', 'Delivery Type')}</label>
                  <Select
                    options={filteredDeliveryTypeOptions}
                    defaultValue={formState.delivery_type || 'all'}
                    onChange={(val) => handleChange('delivery_type', val)}
                    placeholder={t('SELECT_DELIVERY_TYPE', 'Select delivery type')}
                    optionInnerMaxHeight='175px'
                    isShowSearchBar
                    searchValue={deliveryTypeSearch}
                    handleChangeSearch={setDeliveryTypeSearch}
                    searchBarIsCustomLayout
                    searchBarIsNotLazyLoad
                  />
                </Field>
                <Field>
                  <label>{t('SITE', 'Site')}</label>
                  <Select
                    options={filteredSitesOptions}
                    defaultValue={formState.site_id || 'all'}
                    onChange={(val) => handleChange('site_id', val)}
                    placeholder={t('SELECT_SITE', 'Select site')}
                    optionInnerMaxHeight='175px'
                    isShowSearchBar
                    searchValue={siteSearch}
                    handleChangeSearch={setSiteSearch}
                    searchBarIsCustomLayout
                    searchBarIsNotLazyLoad
                  />
                </Field>
              </FieldsRow>

              <FieldsRow>
                <Field>
                  <label>{t('PAYMENT_METHOD', 'Payment Method')}</label>
                  <Select
                    options={filteredPaymethodsOptions}
                    defaultValue={formState.paymethod_id || 'all'}
                    onChange={(val) => handleChange('paymethod_id', val)}
                    placeholder={t('SELECT_PAYMENT_METHOD', 'Select payment method')}
                    optionInnerMaxHeight='175px'
                    isShowSearchBar
                    searchValue={paymethodSearch}
                    handleChangeSearch={setPaymethodSearch}
                    searchBarIsCustomLayout
                    searchBarIsNotLazyLoad
                  />
                </Field>
                <Field />
              </FieldsRow>

              <FieldsRow>
                <Field>
                  <label>{t('FIXED_AMOUNT', 'Fixed Amount')}</label>
                  <Input
                    value={formState.fixed}
                    onChange={(e) => handleChange('fixed', normalizeDecimalInput(e.target.value))}
                    placeholder='0.00'
                  />
                </Field>
                <Field>
                  <label>{t('PERCENTAGE', 'Percentage')} (%)</label>
                  <Input
                    value={formState.percentage}
                    onChange={(e) => handleChange('percentage', normalizePercentageInput(e.target.value))}
                    placeholder='0'
                  />
                </Field>
              </FieldsRow>
            </>
          )}

          {isRecurrent && (
            <>
              <Field>
                <label>{t('RECURRING_PERIOD', 'Recurring Period')}</label>
                <Select
                  options={filteredRecurringPeriodOptions}
                  defaultValue={formState.recurring_period || 'weekly'}
                  onChange={handleRecurringPeriodChange}
                  placeholder={t('SELECT_PERIOD', 'Select period')}
                  optionInnerMaxHeight='175px'
                />
              </Field>

              {formState.recurring_period === 'weekly' && (
                <Field>
                  <label>{t('DAY_OF_WEEK', 'Day of Week')}</label>
                  <Select
                    options={weekDayOptions}
                    defaultValue={formState.recurring_day !== '' ? Number(formState.recurring_day) : 0}
                    onChange={(val) => handleChange('recurring_day', String(val))}
                    placeholder={t('SELECT_DAY', 'Select day')}
                    optionInnerMaxHeight='175px'
                  />
                </Field>
              )}

              {formState.recurring_period === 'monthly' && (
                <Field>
                  <label>{t('DAY_OF_MONTH', 'Day of Month')}</label>
                  <Select
                    options={monthDayOptions}
                    defaultValue={formState.recurring_day !== '' ? Number(formState.recurring_day) : 1}
                    onChange={(val) => handleChange('recurring_day', String(val))}
                    placeholder={t('SELECT_DAY', 'Select day')}
                    optionInnerMaxHeight='175px'
                  />
                </Field>
              )}

              <Field>
                <label>{t('FIXED_AMOUNT', 'Fixed Amount')}</label>
                <Input
                  value={formState.fixed}
                  onChange={(e) => handleChange('fixed', normalizeDecimalInput(e.target.value))}
                  placeholder='0.00'
                />
              </Field>
            </>
          )}
        </FieldsColumn>
      </FormSection>

      <FormActions>
        <Button
          color='primary'
          borderRadius='8px'
          onClick={handleSubmit}
          disabled={actionLoading}
        >
          {isEdit ? t('SAVE_CHANGES', 'Save changes') : t('CREATE', 'Create')}
        </Button>
      </FormActions>
    </DetailsContainer>
  )
}
