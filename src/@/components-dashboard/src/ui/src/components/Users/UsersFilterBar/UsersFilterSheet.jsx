import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button, NumberField, Sheet, TextField } from '../../Shared/Product'
import { Field } from '../../Shared/Product/Field'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { SHEET_KEYS, clearSheetFields, completeFilterValues } from './userFilters'
import './users-filter-bar.css'

// redesign UC-B3 (decision 3; M-C6): the «Filters» sheet of the customers list, with the fields of today's modal that have no
// pill (ID, External ID, Name, Last name, Email, Amount of orders). Everything typed is a DRAFT: it reaches the list once,
// on «Apply» (`onApply(values)`, a complete `multiFilterValues`); Esc, the close button and the scrim discard it. «Clear» empties the sheet's own
// fields in the draft only (the pills keep their values) and is applied with «Apply», like any other edit.
// redesign BO-B2 (promotion): moved from CustomersDirectory/CustomersFilterSheet.jsx. `sheetKeys` says which fields it paints, in
// that order (the default is the customers list's); it also adds `countryPhoneCode` and `cellphone` as possible fields. Only the
// keys in `sheetKeys` are read from the draft and written back, so a key the sheet does not show is never touched.

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'ge', label: '>=' },
  { value: 'le', label: '<=' }
]

const digitsOnly = (text) => String(text ?? '').replace(/\D/g, '')

// The draft holds text (`''` for empty); the values go back to the controller as null when empty
const draftOf = (multiFilterValues) => {
  const values = completeFilterValues(multiFilterValues)
  return {
    id: values.id ?? '',
    externalId: values.externalId ?? '',
    name: values.name ?? '',
    lastname: values.lastname ?? '',
    email: values.email ?? '',
    countryPhoneCode: values.countryPhoneCode ?? '',
    cellphone: values.cellphone ?? '',
    ordersCount: { value: values.ordersCount?.value ?? '', condition: values.ordersCount?.condition || 'eq' }
  }
}

const valuesOf = (draft, sheetKeys) => {
  const text = (value) => (String(value).trim() === '' ? null : value)
  const values = {}
  sheetKeys.forEach(key => {
    values[key] = key === 'ordersCount'
      ? { value: draft.ordersCount.value === null || draft.ordersCount.value === undefined ? '' : String(draft.ordersCount.value), condition: draft.ordersCount.condition }
      : text(draft[key])
  })
  return values
}

// The text fields the sheet can paint: label, and whether the value is digits only
const TEXT_FIELDS = {
  id: { labelKey: 'ID', label: 'ID', digits: true },
  externalId: { labelKey: 'EXTERNAL_ID', label: 'External ID', digits: true },
  name: { labelKey: 'NAME', label: 'Name' },
  lastname: { labelKey: 'LAST_NAME', label: 'Last name' },
  email: { labelKey: 'EMAIL', label: 'Email' },
  countryPhoneCode: { labelKey: 'COUNTRY_PHONE_CODE', label: 'Country phone code', digits: true },
  cellphone: { labelKey: 'PHONE_NUMBER', label: 'Phone number' }
}

export const UsersFilterSheet = ({ open = false, onOpenChange, multiFilterValues, onApply, sheetKeys = SHEET_KEYS, showOrders = true }) => {
  const [, t] = useLanguage()
  const phone = useIsPhone()
  const hintId = useId()
  const legendId = useId()
  const bodyRef = useRef(null)
  const [draft, setDraft] = useState(() => draftOf(multiFilterValues))

  // Each opening starts from what the list holds: a discarded draft never comes back
  useEffect(() => {
    if (open) setDraft(draftOf(multiFilterValues))
  }, [open])

  const change = (patch) => setDraft(current => ({ ...current, ...patch }))
  const changeOrders = (patch) => setDraft(current => ({ ...current, ordersCount: { ...current.ordersCount, ...patch } }))

  const apply = () => {
    onApply?.(completeFilterValues(multiFilterValues, valuesOf(draft, sheetKeys)))
    onOpenChange?.(false)
  }
  // «Clear» empties the sheet's fields in the draft, through the same helper as the chips
  const clear = () => setDraft(draftOf(clearSheetFields(completeFilterValues(multiFilterValues, valuesOf(draft, sheetKeys)), sheetKeys)))

  const ordersValue = draft.ordersCount.value === '' ? null : Number(draft.ordersCount.value)

  // Amount of orders wins over the Orders control (the controller sends it last): said under the field, not left to be found.
  // With no Orders control on the page there is nothing for it to override, so no hint.
  const ordersHint = showOrders
  const ordersField = (
    <div key='ordersCount' role='group' aria-labelledby={legendId} className='odc-cf-amount'>
      <span id={legendId} className='odc-cf-legend'>{t('AMOUNT_OF_ORDERS', 'Amount of orders')}</span>
      <div className='odc-cf-amount-row'>
        <Field aria-label={t('SELECT_CONDITION', 'Select a condition')}>
          <select
            className='odc-field-input odc-cf-select'
            aria-label={t('SELECT_CONDITION', 'Select a condition')}
            aria-describedby={ordersHint ? hintId : undefined}
            value={draft.ordersCount.condition}
            onChange={(event) => changeOrders({ condition: event.target.value })}
          >
            {OPERATORS.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
          </select>
        </Field>
        <NumberField
          aria-label={t('NUMBER', 'Number')}
          aria-describedby={ordersHint ? hintId : undefined}
          min={0}
          step={1}
          format={{ maximumFractionDigits: 0, useGrouping: false }}
          value={ordersValue}
          onChange={(number) => changeOrders({ value: number === null || number === undefined ? '' : String(Math.max(0, Math.trunc(number))) })}
        />
      </div>
      {ordersHint && <p id={hintId} className='odc-cf-hint'>{t('CUSTOMERS_ORDERS_AMOUNT_HINT', 'Overrides the Orders filter')}</p>}
    </div>
  )

  const fieldOf = (key) => {
    if (key === 'ordersCount') return ordersField
    const spec = TEXT_FIELDS[key]
    if (!spec) return null
    return (
      <TextField
        key={key}
        label={t(spec.labelKey, spec.label)}
        inputMode={spec.digits ? 'numeric' : undefined}
        value={draft[key]}
        onChange={(value) => change({ [key]: spec.digits ? digitsOnly(value) : value })}
        autoComplete='off'
      />
    )
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('FILTERS', 'Filters')}
      closeLabel={t('CLOSE', 'Close')}
      side={phone ? 'bottom' : 'end'}
      className='odc-cf-sheet'
      initialFocus={() => bodyRef.current?.querySelector('input') || true}
      footer={(
        <>
          <Button onClick={clear}>{t('CLEAR', 'Clear')}</Button>
          <Button variant='primary' onClick={apply}>{t('APPLY', 'Apply')}</Button>
        </>
      )}
    >
      <div ref={bodyRef} className='odc-cf-form'>
        {sheetKeys.map(fieldOf)}
      </div>
    </Sheet>
  )
}
