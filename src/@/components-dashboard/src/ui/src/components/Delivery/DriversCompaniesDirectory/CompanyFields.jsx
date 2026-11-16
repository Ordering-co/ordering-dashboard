import React from 'react'

import { useLanguage } from '../../../../../index'
import { CopyButton, SegmentedControl, TextField } from '../../Shared/Product'
import { PRIORITY_VALUES, priorityLabel } from './companyData'
import { valueOf } from './companyForm'
import { TimezoneSelect } from './TimezoneSelect'

// redesign DC-B3 (decision 3 | M-DC10, M-DC13): the fields of a driver company, shared by its panel and the add form. They draw
// what is on screen (the pending change, else the company's: `valueOf`) and hand every edit to `onChange(field, value)` (the
// controller's `handleChangesState`); they keep no state. `errors` is `{ field: message }` (companyForm.validate): the message
// goes under its field. The fields and their order are main's (the former General and Webhooks tabs,
// the former add form's General and Webhooks forms).

const text = (value) => (value === null || value === undefined ? '' : String(value))

// main let only digits be typed in Limit (onKeyPress); a paste of anything else is cleaned the same way
const digitsOnly = (value) => String(value ?? '').replace(/\D+/g, '')

/** Name, Limit, Timezone, Priority, Address. `timezoneKey` remounts the time zone list (it keeps its own value) after a Discard. */
export const GeneralFields = ({ changes, company, errors = {}, onChange, disabled = false, readOnly = false, timezoneKey }) => {
  const [, t] = useLanguage()
  const requiredLabel = t('REQUIRED', 'Required')
  // main sent priority 0 («Normal») when none was chosen on add (K/DriversCompanyDetails: extraAttributes): that is what shows there.
  // A company whose priority is none of the four shows none chosen (review r1 F7: the row says «Unknown»), as main's empty select.
  const priority = valueOf('priority', changes, company)
  const known = PRIORITY_VALUES.includes(parseInt(priority, 10))
  const shownPriority = known ? String(parseInt(priority, 10)) : (company ? '' : '0')

  return (
    <div className='odc-dc-fields' data-section='general'>
      <TextField
        label={t('NAME', 'Name')}
        required
        requiredLabel={requiredLabel}
        name='name'
        value={text(valueOf('name', changes, company))}
        error={errors.name}
        disabled={disabled}
        autoComplete='off'
        onChange={value => onChange?.('name', value)}
        fieldProps={{ 'data-field': 'name' }}
      />
      <div className='odc-dc-pair'>
        <TextField
          label={t('LIMIT', 'Limit')}
          name='limit'
          inputMode='numeric'
          value={text(valueOf('limit', changes, company))}
          disabled={disabled}
          autoComplete='off'
          onChange={value => onChange?.('limit', digitsOnly(value))}
          fieldProps={{ 'data-field': 'limit' }}
        />
        <TimezoneSelect
          key={timezoneKey}
          label={t('TIMEZONE', 'Timezone')}
          required
          requiredLabel={requiredLabel}
          placeholder={t('SELECT_TIMEZONE', 'Select a timezone')}
          value={valueOf('timezone', changes, company)}
          error={errors.timezone}
          disabled={disabled}
          onChange={zone => onChange?.('timezone', zone)}
        />
      </div>
      {/* redesign (n.º 10, review L2 #3): an integration is read only and P/SegmentedControl has no `disabled`, so its
          priority is shown as the other read-only fields are: a disabled field with the value */}
      {readOnly && (
        <TextField
          label={t('PRIORITY', 'Priority')}
          name='priority'
          value={shownPriority === '' ? '' : priorityLabel(Number(shownPriority), t)}
          disabled
          onChange={() => {}}
        />
      )}
      {!readOnly && (
      <div className='odc-root odc-field odc-dc-priority' data-field='priority' data-disabled={disabled ? '' : undefined}>
        <span className='odc-field-label' aria-hidden='true'>{t('PRIORITY', 'Priority')}</span>
        <SegmentedControl
          label={t('PRIORITY', 'Priority')}
          value={shownPriority}
          options={PRIORITY_VALUES.map(value => ({ value: String(value), label: priorityLabel(value, t) }))}
          // P/SegmentedControl has no `disabled`: a press is ignored here instead (agent finding, B3 tests)
          onValueChange={value => { if (!disabled) onChange?.('priority', Number(value)) }}
        />
      </div>
      )}
      <TextField
        label={t('ADDRESS', 'Address')}
        required
        requiredLabel={requiredLabel}
        name='address'
        value={text(valueOf('address', changes, company))}
        error={errors.address}
        disabled={disabled}
        autoComplete='off'
        onChange={value => onChange?.('address', value)}
        fieldProps={{ 'data-field': 'address' }}
      />
    </div>
  )
}

/** The three webhooks and, for a company that exists, its API key (read only, with Copy). */
export const WebhooksFields = ({ changes, company, errors = {}, onChange, disabled = false, showApiKey = false, integration = false }) => {
  const [, t] = useLanguage()
  const requiredLabel = t('REQUIRED', 'Required')
  const apiKey = text(company?.api_key)
  const apiKeyLabel = t('API_KEY', 'API Key')

  const webhook = (field, label, required) => (
    <TextField
      key={field}
      label={label}
      required={required}
      requiredLabel={required ? requiredLabel : undefined}
      name={field}
      type='url'
      dir='ltr'
      value={text(valueOf(field, changes, company))}
      error={errors[field]}
      disabled={disabled}
      autoComplete='off'
      spellCheck={false}
      onChange={value => onChange?.(field, value)}
      fieldProps={{ 'data-field': field }}
    />
  )

  return (
    <div className='odc-dc-fields' data-section='webhooks'>
      {webhook('webhook_new_order', t('WEBHOOK_NEW_ORDER', 'Webhook new order'), !integration)}
      {webhook('webhook_cancel_request', t('WEBHOOK_CANCEL_REQUEST', 'Webhook cancel request'), !integration)}
      {webhook('webhook_order_status_changed', t('WEBHOOK_ORDER_STATUS_CHANGED', 'Webhook order status changed'), false)}
      {showApiKey && (
        <div className='odc-dc-apikey'>
          <TextField
            label={apiKeyLabel}
            name='api_key'
            dir='ltr'
            value={apiKey}
            readOnly
            autoComplete='off'
            spellCheck={false}
            fieldProps={{ 'data-field': 'api_key' }}
          />
          <CopyButton
            iconOnly
            text={apiKey || undefined}
            label={t('BUILDER_COPY_VALUE', 'Copy _value_').replace('_value_', apiKeyLabel)}
            copiedLabel={t('COPIED', 'Copied')}
            failedLabel={t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")}
          />
        </div>
      )}
    </div>
  )
}
