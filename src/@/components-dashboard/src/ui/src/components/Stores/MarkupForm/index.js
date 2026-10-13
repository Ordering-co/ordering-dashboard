import React from 'react'

import { Button, Switch, Checkbox } from '../../../styles'
import { Input } from '../../../styles/Inputs'
import { Select } from '../../../styles/Select/FirstSelect'
import { MultiSelect } from '../../../styles/MultiSelect'

import {
  DetailsContainer,
  DetailsHeader,
  FormSection,
  SectionTitle,
  FieldsColumn,
  FieldsRow,
  Field,
  CheckboxRow,
  FormActions
} from './styles'

export const MarkupForm = (props) => {
  const {
    t,
    isEdit,
    actionLoading,
    isShowBusinessSelect = true,
    markupId,

    formState,
    setFormState,

    handleToggleRounding,
    handleSubmit,
    onUpdateEnabled,

    filteredBusinessOptions,
    filteredSitesOptions,
    deliveryTypeOptions,
    roundingOptions,
    markupTypeOptions,

    businessSearchValue,
    setBusinessSearchValue,
    sitesSearchValue,
    setSitesSearchValue,
    businessPagination,
    handleChangeBusinessPage,
    businessesLoading
  } = props
  console.log(businessPagination)
  const normalizeFixedDecimalString = (value) => {
    const raw = String(value ?? '')
    const digitsAndDot = raw.replace(/[^\d.]/g, '')
    const parts = digitsAndDot.split('.')
    if (parts.length <= 2) return digitsAndDot
    return `${parts[0]}.${parts.slice(1).join('')}`
  }

  const normalizePercentageString = (value) => {
    const raw = String(value ?? '')
    const digitsOnly = raw.replace(/\D/g, '')
    if (!digitsOnly) return ''
    const trimmed = digitsOnly.slice(0, 3)
    const num = Number(trimmed)
    if (!Number.isFinite(num)) return ''
    return String(Math.min(999, num))
  }

  const normalizeMarkupValueString = (value, type) => {
    return type === 'percentage'
      ? normalizePercentageString(value)
      : normalizeFixedDecimalString(value)
  }

  const handleMarkupValueChange = (key, type) => (e) => {
    const next = normalizeMarkupValueString(e.target.value, type)
    setFormState((prev) => ({ ...prev, [key]: next }))
  }

  const handleMarkupValueKeyDown = (type) => (e) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End'
    ]

    if (allowedKeys.includes(e.key)) return
    if (e.ctrlKey || e.metaKey) return

    if (type === 'percentage') {
      if (!/^\d$/.test(e.key)) {
        e.preventDefault()
        return
      }
      const el = e.currentTarget
      const current = String(el?.value ?? '')
      const start = el?.selectionStart ?? current.length
      const end = el?.selectionEnd ?? current.length
      const selectedLen = Math.max(0, end - start)
      const nextLen = Math.max(0, current.length - selectedLen) + 1
      if (nextLen > 3) e.preventDefault()
      return
    }

    // fixed/decimal
    if (/^\d$/.test(e.key)) return
    if (e.key === '.') {
      const current = String(e.currentTarget?.value ?? '')
      if (!current.includes('.')) return
    }
    e.preventDefault()
  }

  const handleMarkupValuePaste = (key, type) => (e) => {
    e.preventDefault()
    const text = e.clipboardData?.getData?.('text') ?? ''
    const el = e.currentTarget
    const current = String(el?.value ?? '')
    const start = el?.selectionStart ?? current.length
    const end = el?.selectionEnd ?? current.length
    const nextRaw = `${current.slice(0, start)}${text}${current.slice(end)}`
    const next = normalizeMarkupValueString(nextRaw, type)
    setFormState((prev) => ({ ...prev, [key]: next }))
  }

  return (
    <DetailsContainer>
      <DetailsHeader>
        <div>
          <h1>
            {formState.name?.trim()
              ? formState.name
              : (isEdit ? t('EDIT_MARKUP', 'Edit markup') : t('CREATE_MARKUP', 'Create markup'))}
          </h1>
          {isEdit && (
            <Switch
              defaultChecked={!!formState.enabled}
              onChange={(val) => {
                const nextEnabled = !!val
                setFormState((prev) => ({ ...prev, enabled: nextEnabled }))
                if (markupId != null && typeof onUpdateEnabled === 'function') {
                  onUpdateEnabled(markupId, nextEnabled)
                }
              }}
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
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t('NAME', 'Name')}
            />
          </Field>
        </FieldsColumn>
      </FormSection>

      <FormSection>
        <FieldsColumn>
          {isShowBusinessSelect && (
            <Field maxWidthForFirstElement>
              <label>{t('BUSINESS', 'Business')}</label>
              <Select
                options={filteredBusinessOptions}
                defaultValue={formState.business_id}
                onChange={(val) => setFormState((prev) => ({ ...prev, business_id: val }))}
                placeholder={t('ALL_BUSINESSES', 'All businesses')}
                isShowSearchBar
                searchValue={businessSearchValue}
                handleChangeSearch={setBusinessSearchValue}
                searchBarPlaceholder={t('SEARCH', 'Search')}
                isDisabled={isEdit}
                pagination={businessPagination}
                handleChangePage={handleChangeBusinessPage}
                isLoading={businessesLoading}
              />
            </Field>
          )}

          <Field>
            <label>{t('SITE', 'Site')}</label>
            <Select
              options={filteredSitesOptions}
              defaultValue={formState.site_id}
              onChange={(val) => setFormState((prev) => ({ ...prev, site_id: val }))}
              placeholder={t('ALL_SITES', 'All sites')}
              isShowSearchBar
              searchValue={sitesSearchValue}
              handleChangeSearch={setSitesSearchValue}
              searchBarPlaceholder={t('SEARCH', 'Search')}
              isDisabled={isEdit}
            />
          </Field>

          <Field>
            <label>{t('DELIVERY_TYPE', 'Delivery type')}</label>
            <Select
              options={deliveryTypeOptions}
              defaultValue={formState.delivery_type}
              onChange={(val) => setFormState((prev) => ({ ...prev, delivery_type: val }))}
              placeholder={t('ALL_DELIVERY_TYPES', 'All delivery types')}
              isDisabled={isEdit}
            />
          </Field>

          <Field>
            <label>{t('ROUNDING_VALUES', 'Rounding values')}</label>
            <MultiSelect
              placeholder={t('ROUNDING_VALUES', 'Rounding values')}
              options={roundingOptions}
              optionsPosition='left'
              dropdownMinWidth='100%'
              isFullWidthOptions
              optionInnerMargin='10px'
              optionInnerMaxHeight='150px'
              optionBottomBorder
              defaultValue={Array.isArray(formState.rounding_values) ? formState.rounding_values : []}
              onChange={(val) => handleToggleRounding(val)}
            />
          </Field>
        </FieldsColumn>
      </FormSection>

      <FormSection>
        <SectionTitle>{t('RULES', 'Rules')}</SectionTitle>
        <FieldsRow>
          <Field>
            <label>{t('PRODUCTS_MARKUP_TYPE', 'Products markup type')}</label>
            <Select
              options={markupTypeOptions}
              defaultValue={formState.products_markup_type}
              onChange={(val) => setFormState((prev) => ({
                ...prev,
                products_markup_type: val,
                products_markup_value: val === 'percentage'
                  ? normalizePercentageString(prev.products_markup_value)
                  : prev.products_markup_value
              }))}
            />
          </Field>
          <Field>
            <label>{t('PRODUCTS_MARKUP_VALUE', 'Products markup value')}</label>
            <Input
              value={formState.products_markup_value}
              inputMode={formState.products_markup_type === 'percentage' ? 'numeric' : 'decimal'}
              onKeyDown={handleMarkupValueKeyDown(formState.products_markup_type)}
              onPaste={handleMarkupValuePaste('products_markup_value', formState.products_markup_type)}
              onChange={handleMarkupValueChange('products_markup_value', formState.products_markup_type)}
              placeholder='0'
            />
          </Field>
        </FieldsRow>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CheckboxRow>
            <Checkbox
              checked={!!formState.apply_to_suboptions}
              onChange={(e) => setFormState((prev) => ({
                ...prev,
                apply_to_suboptions: e.target.checked,
                apply_same_value: e.target.checked ? prev.apply_same_value : false
              }))}
            />
            {t('APPLY_TO_SUBOPTIONS', 'Apply to suboptions')}
          </CheckboxRow>

          {formState.apply_to_suboptions && (
            <CheckboxRow>
              <Checkbox
                checked={!!formState.apply_same_value}
                onChange={(e) => setFormState((prev) => ({ ...prev, apply_same_value: e.target.checked }))}
              />
              {t('APPLY_SAME_VALUE', 'Apply same value')}
            </CheckboxRow>
          )}
        </div>

        {formState.apply_to_suboptions && !formState.apply_same_value && (
          <FieldsRow style={{ marginTop: 12 }}>
            <Field>
              <label>{t('SUBOPTIONS_MARKUP_TYPE', 'Suboptions markup type')}</label>
              <Select
                options={markupTypeOptions}
                defaultValue={formState.suboptions_markup_type}
                onChange={(val) => setFormState((prev) => ({
                  ...prev,
                  suboptions_markup_type: val,
                  suboptions_markup_value: val === 'percentage'
                    ? normalizePercentageString(prev.suboptions_markup_value)
                    : prev.suboptions_markup_value
                }))}
              />
            </Field>
            <Field>
              <label>{t('SUBOPTIONS_MARKUP_VALUE', 'Suboptions markup value')}</label>
              <Input
                value={formState.suboptions_markup_value}
                inputMode
                  ={formState.suboptions_markup_type === 'percentage' ? 'numeric' : 'decimal'}
                onKeyDown={handleMarkupValueKeyDown(formState.suboptions_markup_type)}
                onPaste={handleMarkupValuePaste('suboptions_markup_value', formState.suboptions_markup_type)}
                onChange={handleMarkupValueChange('suboptions_markup_value', formState.suboptions_markup_type)}
                placeholder='0'
              />
            </Field>
          </FieldsRow>
        )}
      </FormSection>

      <FormActions>
        <Button
          color='primary'
          borderRadius='8px'
          disabled={!!actionLoading}
          onClick={handleSubmit}
        >
          {actionLoading ? t('SAVING', 'Saving') : t('SAVE', 'Save')}
        </Button>
      </FormActions>
    </DetailsContainer>
  )
}
