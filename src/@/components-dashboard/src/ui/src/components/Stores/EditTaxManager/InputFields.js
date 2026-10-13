import React from 'react'
import {
  TypeSelectWrapper,
  Option,
  LabelCustom,
  InputContainer
} from './styles'
import { Select } from '../../../styles/Select/FirstSelect'
import { Input } from '../../../styles/Inputs'
import { Switch } from '../../../styles'
import { RecipientSelect } from '../../Shared'
import { useLanguage } from '../../../../../index'

const POSITIVE_NUMBER_FIELDS = ['rate', 'fixed', 'percentage']
const NUMERIC_PATTERN = /^\d*\.?\d*$/

export const InputsFields = (props) => {
  const {
    orderType,
    hideDefaultInputs,
    type,
    formChanges,
    onChange,
    data,
    deliveryState,
    setDeliveryState,
    pickupState,
    setPickupState,
    eatInState,
    setEatInState,
    formMethods
  } = props

  const [, t] = useLanguage()

  // Validation functions
  const validateNumber = (value, fieldName) => {
    if (isNaN(Number(value))) {
      return t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.')
        .replace('_attribute_', fieldName)
    }
    return true
  }

  const validatePercentage = (value) => {
    if (Number(value) > 100) {
      return t('VALIDATION_MUST_SMALLER_HUNDRED', 'The percentage must be not bigger than 100')
    }
    return true
  }

  // Input configurations
  const baseInputs = [
    {
      field: 'name',
      placeholder: t('NAME', 'Name'),
      required: t('NAME_REQUIRED', 'The name is required')
    },
    {
      field: 'description',
      placeholder: t('DESCRIPTION', 'Description'),
      required: t('DESCRIPTION_REQUIRED', 'The Description is required')
    }
  ]

  const taxInputs = [{
    field: 'rate',
    placeholder: t('RATE', 'Rate'),
    required: t('TAX_RATE_REQUIRED', 'Tax rate is required'),
    pattern: {
      value: NUMERIC_PATTERN,
      message: t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.')
        .replace('_attribute_', t('RATE', 'Rate'))
    },
    validate: (value) => validateNumber(value, t('RATE', 'Rate'))
  }]

  const feeInputs = [
    {
      field: 'fixed',
      placeholder: t('FIXED', 'Fixed'),
      required: t('FEE_FIXED_REQUIRED', 'Fee fixed is required'),
      pattern: {
        value: NUMERIC_PATTERN,
        message: t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.')
          .replace('_attribute_', t('FIXED', 'Fixed'))
      },
      validate: (value) => validateNumber(value, t('FIXED', 'Fixed'))
    },
    {
      field: 'percentage',
      placeholder: t('PERCENTAGE', 'Percentage'),
      required: t('FEE_PERCENTAGE_REQUIRED', 'Fee percentage is required'),
      pattern: {
        value: NUMERIC_PATTERN,
        message: t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.')
          .replace('_attribute_', t('PERCENTAGE', 'Percentage'))
      },
      validate: (value) => validateNumber(value, t('PERCENTAGE', 'Percentage')) && validatePercentage(value)
    }
  ]

  const inputConfigurations = [...baseInputs, ...(type === 'taxes' ? taxInputs : feeInputs)]

  // Filter inputs based on hideDefaultInputs
  const visibleInputs = hideDefaultInputs
    ? inputConfigurations.filter(input => input.field !== 'name' && input.field !== 'description')
    : inputConfigurations

  // Get field value helper
  const getFieldValue = (field) => {
    if (field === 'rate' || field === 'type') {
      if (orderType === 'delivery') return isNaN(deliveryState[field]) ? '' : deliveryState[field] ?? ''
      if (orderType === 'pickup') return isNaN(pickupState[field]) ? '' : pickupState[field] ?? ''
      if (orderType === 'eatin') return isNaN(eatInState[field]) ? '' : eatInState[field] ?? ''
    }
    return formChanges?.[field] ?? data?.[field] ?? ''
  }

  // Handle input changes
  const handleInputChange = (field, value) => {
    // Handle regular fields without order type specificity
    if (!orderType || (field !== 'rate' && field !== 'type')) {
      onChange(field, value)
      return
    }

    // Handle rate and type fields with order type specificity
    const complementaryField = field === 'rate' ? 'type' : 'rate'

    const updateOrderTypeState = (currentState, stateSetter) => {
      const complementaryValue = currentState[complementaryField]

      // Update local state
      stateSetter({
        ...currentState,
        [field]: value,
        [complementaryField]: complementaryValue
      })

      // Notify parent of both field changes
      onChange(field, value, orderType)
      onChange(complementaryField, complementaryValue, orderType)
    }

    if (orderType === 'delivery') {
      updateOrderTypeState(deliveryState, setDeliveryState)
    } else if (orderType === 'pickup') {
      updateOrderTypeState(pickupState, setPickupState)
    } else if (orderType === 'eatin') {
      updateOrderTypeState(eatInState, setEatInState)
    }
  }

  // Handle key press for numeric fields
  const handleKeyPress = (e, field) => {
    if (POSITIVE_NUMBER_FIELDS.includes(field) && !/^[0-9.]$/.test(e.key)) {
      e.preventDefault()
    }
  }

  // Type select options for taxes
  const typeSelectOptions = [
    {
      value: 1,
      content: t('INCLUDED_ON_PRICE', 'Included on price'),
      showOnSelected: <Option>{t('INCLUDED_ON_PRICE', 'Included on price')}</Option>
    },
    {
      value: 2,
      content: t('NOT_INCLUDED_ON_PRICE', 'Not included on price'),
      showOnSelected: <Option>{t('NOT_INCLUDED_ON_PRICE', 'Not included on price')}</Option>
    }
  ]

  // Get default value for type select
  const getTypeSelectDefaultValue = () => {
    if (orderType) {
      return formChanges?.order_type_rates?.[orderType]?.type ??
             data?.order_type_rates?.[orderType]?.type ?? 1
    }
    return formChanges?.type ?? data?.type ?? 1
  }

  return (
    <>
      {visibleInputs.map(input => (
        <InputContainer key={input.field}>
          <LabelCustom htmlFor={input.field}>
            {input.placeholder}
          </LabelCustom>
          <Input
            name={input.field}
            id={input.field}
            placeholder={input.placeholder}
            defaultValue={orderType ? undefined : getFieldValue(input.field)}
            value={!orderType ? undefined : getFieldValue(input.field)}
            onChange={(e) => handleInputChange(input.field, e.target.value)}
            ref={formMethods.register({
              required: input.required,
              pattern: input.pattern,
              validate: input.validate
            })}
            onKeyPress={(e) => handleKeyPress(e, input.field)}
            autoComplete='off'
          />
        </InputContainer>
      ))}

      {/* Tax target only supports "product" (API no longer accepts "order") */}
      {type === 'taxes' && (
        <>
          <InputContainer>
            <LabelCustom htmlFor='type'>
              {t('TYPE', 'Type')}
            </LabelCustom>
            <TypeSelectWrapper>
              <Select
                placeholder={formChanges?.type ?? data?.type}
                defaultValue={getTypeSelectDefaultValue()}
                options={typeSelectOptions}
                onChange={(val) => onChange('type', val, orderType)}
              />
            </TypeSelectWrapper>
          </InputContainer>
          {!orderType && (
            <>
              <InputContainer>
                <LabelCustom>{t('APPLY_TO_FEES', 'Apply to fees')}</LabelCustom>
                <Switch
                  defaultChecked={
                    typeof formChanges?.apply_to_fees !== 'undefined'
                      ? formChanges.apply_to_fees
                      : data?.apply_to_fees ?? false
                  }
                  onChange={(val) => onChange('apply_to_fees', val)}
                />
              </InputContainer>
              <InputContainer>
                <RecipientSelect
                  value={formChanges?.recipient ?? data?.recipient ?? 'business'}
                  onChange={(val) => onChange('recipient', val)}
                />
              </InputContainer>
            </>
          )}
        </>
      )}
      {type === 'fees' && !orderType && (
        <>
          <InputContainer>
            <LabelCustom>{t('TAXABLE', 'Taxable')}</LabelCustom>
            <Switch
              defaultChecked={
                typeof formChanges?.taxable !== 'undefined'
                  ? formChanges.taxable
                  : data?.taxable ?? true
              }
              onChange={(val) => onChange('taxable', val)}
            />
          </InputContainer>
          {(formChanges?.target === 'customer' || data?.target === 'customer') && (
            <InputContainer>
              <RecipientSelect
                value={formChanges?.recipient ?? data?.recipient ?? 'business'}
                onChange={(val) => onChange('recipient', val)}
              />
            </InputContainer>
          )}
        </>
      )}
    </>
  )
}
