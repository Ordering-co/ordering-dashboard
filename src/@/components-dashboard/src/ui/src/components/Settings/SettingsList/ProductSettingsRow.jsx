import React, { useId, useRef, useState } from 'react'
import { isSupportedCountry } from 'libphonenumber-js'
import { useLanguage } from '../../../../../index'
import { Field, NumberField, TextField, useFieldFrame } from '../../Shared/Product/Field'
import { Switch } from '../../Shared/Product/Switch'
import { Checkbox } from '../../Shared/Product/Checkbox'
import { ColorField } from '../../Shared/Product/ColorField'
import { SecretField } from '../../Shared/Product/SecretField'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { SettingsCountryFilter } from '../SettingsCountryFilter'
import { HubImageField } from './HubImageField'
import { parseJsonArray } from '../../../../../utils/safeJsonParse'
import {
  getPreorderTypeRows,
  getSettingsFocusId,
  getSettingsFieldDependency,
  getSettingsInputPresentation,
  getSettingsPipeYesNoModel,
  getSettingsType6TypeLabel,
  getSettingsType6Unit,
  updateType6Value
} from '../../../../../utils/settingsCustomSections'
import {
  SETTINGS_INVERTED_VALUE_KEYS,
  SETTINGS_ORDER_TYPES_BY_NUMBER_KEYS,
  SETTINGS_ORDER_TYPE_SELECT_KEYS,
  getSettingsSelectOptions,
  getSettingsSwitchModel,
  toggleSettingsJsonArrayValue,
  toggleSettingsPipeValue
} from '../../../../../utils/settingsSelectOptions'
import { ConfigRow } from './styles'
import '../SettingsHubForm/settings-hub-form.css'
import { useLabelFocusesTrigger } from '../SettingsHubForm/useLabelFocusesTrigger'
import { isSecretConfig } from './secretConfigKeys'

// redesign settings B (decision 3A): one row of SettingsList inside the Settings hub. The label and the hint are tied
// to the control (P/Field and its family). The id used by `?focus=` and the `$focused` mark stay those of the legacy row.
// Behaviour is the legacy one: same options, same values written through `handleInputChange`, same filters.

const configsTypeColors = ['dashboard_buttons_colors']

// The select is the Product anatomy (C18): trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }

// A text config whose stored value is longer than this stacks (label above, control below) instead of sitting in one line.
// Read once when the row mounts: the layout must not jump while the user types.
const SHORT_TEXT_MAX_LENGTH = 48

// the instruction the API ships as a stored value («Add your Recaptcha Site Key»)
const ADD_YOUR_HINT = /^add your\s/i

// type 1 configs that hold a number (guest_uuid_max_days is «Set Expiry for Shared Order Details», in days). They are
// still stored as text. ST9: the row asks for the numeric keyboard and says in line when the text is not a number;
// SettingsList's save bar uses the same two helpers to refuse it, so the row and the bar can never disagree.
const NUMERIC_TEXT_CONFIG_KEYS = ['guest_uuid_max_days']
export const isNumericTextConfig = (item) => item?.type === 1 && NUMERIC_TEXT_CONFIG_KEYS.includes(item.key)
/** A numeric text config whose text is not a number («5x»). Empty is not an error: the field is optional, as the bar has it. */
export const isNotANumericText = (item) => isNumericTextConfig(item) && String(item.value ?? '').trim() !== '' && isNaN(Number(item.value))

export const isNotACountryCode = (item) => item?.key === 'default_country_code' && String(item.value ?? '') !== '' && !isSupportedCountry(String(item.value))

const typeSixValue = (raw) => {
  if (raw === '' || raw == null) return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}

const formatArray = (values) => String(values ?? '').replace('[', '').replace(']', '')

/** A native-looking dropdown tied to the label of its Field (the C18 trigger names itself «label + value»). */
const FramedSelect = ({ config, items, placeholder, label, onSelect }) => {
  const frame = useFieldFrame()
  const rootRef = useRef(null)
  useLabelFocusesTrigger(rootRef, frame?.labelId) // redesign settings R-03
  return (
    <span ref={rootRef} className='odc-hub-select'>
      <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
        <FirstSelect
          ariaLabelledBy={frame?.labelId || undefined}
          ariaLabel={label}
          options={items}
          defaultValue={config.value}
          onChange={onSelect}
          placeholder={placeholder}
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

const RowText = ({ labelId, hintId, name, hint }) => (
  <>
    <p id={labelId} className='odc-hub-label'>{name}</p>
    {hint && <p id={hintId} className='odc-hub-hint'>{hint}</p>}
  </>
)

export const ProductSettingsRow = ({
  config,
  focused = false,
  error = null,
  handleInputChange,
  configOptionsToHide = [],
  orderTypeValues = [],
  guestOrderTypeValues = [],
  includeCateringTypes = false,
  handleKeyPress
}) => {
  const [, t] = useLanguage()
  const baseId = useId()
  const labelId = `${baseId}-label`
  const hintId = `${baseId}-hint`
  const [longText] = useState(() => String(config?.value ?? '').length > SHORT_TEXT_MAX_LENGTH)

  const name = config.name || config.key
  const hint = config.description || undefined
  const change = (value) => handleInputChange(value, config.id)
  // an instruction the API ships as the value («Add your Recaptcha Site Key») is a hint on any field, not only on
  // the dependents; untouched, the field writes nothing. Outside the dependents only that «Add your …» form counts: a real
  // value that happens to equal the field's name stays a value (review of batch S)
  const rawValue = String(config?.value ?? '').trim()
  const inputPresentation = getSettingsFieldDependency(config.key)
    ? getSettingsInputPresentation(config)
    : ADD_YOUR_HINT.test(rawValue)
      ? { value: '', placeholder: rawValue }
      : { value: config?.value ?? '', placeholder: config?.name }

  // , type 1 credentials (secretConfigKeys.js) paint in P/SecretField like a type 7 key
  const isSecret = isSecretConfig(config)

  let layout = 'stack'
  let body = null

  if (config.type === 1 && !isSecret) {
    if (configsTypeColors.includes(config.key)) {
      body = <ColorField label={name} hint={hint} error={error} value={config.value} onChange={change} />
    } else {
      layout = longText ? 'stack' : 'inline'
      const numeric = isNumericTextConfig(config)
      const ownError = isNotANumericText(config)
        ? t('VALIDATION_ERROR_NUMERIC', 'The _attribute_ must be a number.').replace('_attribute_', name)
        : isNotACountryCode(config)
          ? t('SETTINGS_DEFAULT_COUNTRY_CODE_INVALID', 'Use a two-letter country code in capital letters, like US, CA or MX. A dialing prefix like +1 does not work.')
          : null
      body = (
        <TextField
          label={name}
          hint={hint}
          // the message of the save bar wins; before it, the row says it as the person types
          error={error || ownError}
          value={inputPresentation.value}
          placeholder={inputPresentation.placeholder}
          inputMode={numeric ? 'numeric' : undefined}
          onChange={change}
          onKeyDown={(event) => handleKeyPress && handleKeyPress(event, config.key)}
        />
      )
    }
  }

  if (config.type === 2) {
    if (config.key === 'country_autocomplete') {
      body = (
        <Field label={name} hint={hint} error={error}>
          <SettingsCountryFilter defaultValue={config.value} handleSelectChange={change} />
        </Field>
      )
    } else {
      layout = 'inline'
      const options = config.options?.filter(option => !configOptionsToHide.find(hidden => hidden.key === config.key && hidden.value === option.value))
      const visible = { ...config, options }
      const invertValues = SETTINGS_INVERTED_VALUE_KEYS.includes(config.key)
      const model = getSettingsSwitchModel({ config: visible, invertValues })
      if (model) {
        body = (
          <div className='odc-hub-switch-row'>
            <div className='odc-hub-switch-text'>
              <RowText labelId={labelId} hintId={hintId} name={name} hint={hint} />
            </div>
            <Switch
              label={name}
              aria-labelledby={labelId}
              aria-describedby={hint ? hintId : undefined}
              checked={model.checked}
              onCheckedChange={(next) => change(next ? model.onValue : model.offValue)}
            />
          </div>
        )
      } else {
        const list = getSettingsSelectOptions({ config: visible, t, invertValues })
        const items = list?.map(item => (
          item.custom
            ? {
                value: item.value,
                content: item.label,
                showOnSelected: (
                  <input
                    className='odc-hub-custom-input'
                    aria-label={`${name} · ${item.label}`}
                    placeholder={item.label}
                    defaultValue={config.value}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => change(event.target.value)}
                  />
                )
              }
            : { value: item.value, content: item.label }
        ))
        body = (
          <Field
            label={name}
            hint={hint}
            error={error || (items ? null : t('NO_OPTIONS_VALUE', 'There is no options value'))}
          >
            {items && (
              <FramedSelect
                config={config}
                items={items}
                label={name}
                placeholder={t('SELECT_A_OPTION', 'Select a option')}
                onSelect={change}
              />
            )}
          </Field>
        )
      }
    }
  }

  // a type 3 list whose only two options are Yes and No is one exclusive choice, drawn as the Yes/No switch of type 2
  // (two independent boxes could be ticked together and send «1|0»). Real lists keep their checkboxes.
  const pipeSwitch = config.type === 3 && !SETTINGS_ORDER_TYPE_SELECT_KEYS.includes(config.key)
    ? getSettingsPipeYesNoModel(config)
    : null
  if (pipeSwitch) {
    layout = 'inline'
    body = (
      <div className='odc-hub-switch-row'>
        <div className='odc-hub-switch-text'>
          <RowText labelId={labelId} hintId={hintId} name={name} hint={hint} />
        </div>
        <Switch
          label={name}
          aria-labelledby={labelId}
          aria-describedby={hint ? hintId : undefined}
          checked={pipeSwitch.checked}
          onCheckedChange={(next) => change(next ? pipeSwitch.onValue : pipeSwitch.offValue)}
        />
      </div>
    )
  }

  if (!pipeSwitch && (config.type === 3 || (config.type === 4 && config.key !== 'driver_tip_options'))) {
    const isPipe = config.type === 3
    const orderTypeList = SETTINGS_ORDER_TYPES_BY_NUMBER_KEYS.includes(config.key) ? guestOrderTypeValues : orderTypeValues
    let options = config.options
    if (isPipe && SETTINGS_ORDER_TYPE_SELECT_KEYS.includes(config.key)) {
      options = options?.filter(option => (
        option.value === 'external_id' ||
        option.value === 'driver' ||
        option.value === 'driver_group_general' ||
        orderTypeList.includes(option.value)
      ))
    }
    const stored = String(config.value ?? '')
    body = (
      <div role='group' aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined} className='odc-hub-group'>
        <RowText labelId={labelId} hintId={hintId} name={name} hint={hint} />
        {options?.length > 0 && (
          <div className='odc-hub-checks'>
            {options.map((item, index) => (
              <Checkbox
                key={`${item.value}-${index}`}
                checked={isPipe ? stored.split('|').includes(item.value) : parseJsonArray(config.value).includes(parseInt(item.value))}
                onCheckedChange={(next) => change(
                  isPipe
                    ? toggleSettingsPipeValue(config.value, item.value, next)
                    : toggleSettingsJsonArrayValue(config.value, item.value, next)
                )}
              >
                <span className={isPipe ? 'odc-hub-check-text' : undefined}>
                  {isPipe ? t(item.text.toUpperCase(), item.text.replace(/_/g, ' ').toLowerCase()) : item.text}
                </span>
              </Checkbox>
            ))}
          </div>
        )}
        {!config.options && <p className='odc-hub-error'>{t('NO_OPTIONS_VALUE', 'There is no options value')}</p>}
        {error && <p className='odc-hub-error' role='alert'>{error}</p>}
      </div>
    )
  }

  if (config.type === 4 && config.key === 'driver_tip_options') {
    layout = 'inline'
    body = (
      <TextField
        label={name}
        hint={hint}
        error={error}
        value={formatArray(config.value)}
        onChange={change}
      />
    )
  }

  if (config.type === 5) {
    // n.º 1, D-56 (a), settings P-6 (owner, 2026-10-20): inside the hub the picked image and «Restore default» are pending changes
    // of the bar, like any other field; the controller's Save chain uploads the image with the request it always used.
    // on P/ImageField (HubImageField), no longer SettingsImage's grey «Put your image here» box
    body = (
      <HubImageField
        config={config}
        hint={hint}
        error={error}
        onPick={image => handleInputChange(image, config.id)}
        onRestore={() => handleInputChange('', config.id)}
      />
    )
  }

  if (config.type === 6) {
    const unit = getSettingsType6Unit(config.key)
    const unitText = t(unit.labelKey, unit.label)
    body = (
      <div role='group' aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined} className='odc-hub-group'>
        <RowText labelId={labelId} hintId={hintId} name={name} hint={hint} />
        <div className='odc-hub-table-wrap'>
          <table className='odc-hub-table'>
            <thead>
              <tr>
                <th scope='col'>{t('SETTINGS_PREORDER_TYPE', 'Order type')}</th>
                <th scope='col'>{unitText}</th>
              </tr>
            </thead>
            <tbody>
              {getPreorderTypeRows(config.value, { includeCatering: includeCateringTypes }).map((row) => {
                const copy = getSettingsType6TypeLabel(row.type)
                const typeText = t(copy.labelKey, copy.label)
                return (
                  <tr key={row.type}>
                    <td>{typeText}</td>
                    <td>
                      <NumberField
                        aria-label={`${typeText} — ${unitText}`}
                        min={0}
                        value={typeSixValue(row.value)}
                        onChange={(next) => change(updateType6Value(config.value, row.type, next == null ? '' : String(next)))}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // apply-list row 43 (settings P-5, D-53 a): a key is P/SecretField, hidden by default, with «Show» and its last four characters;
  // it brings the same autocomplete='new-password' and password-manager opt-outs the plain field had
  if (isSecret) {
    const [endsBefore, endsAfter] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    body = (
      <SecretField
        label={name}
        hint={hint}
        error={error}
        value={inputPresentation.value ?? ''}
        placeholder={inputPresentation.placeholder}
        showLabel={t('SHOW', 'Show')}
        hideLabel={t('HIDE', 'Hide')}
        endingLabel={ending => <>{endsBefore}{ending}{endsAfter}</>}
        onChange={change}
      />
    )
  }

  return (
    <ConfigRow
      id={getSettingsFocusId(config.key)}
      $focused={focused}
      className='odc-hub-row'
      data-layout={layout}
    >
      {body}
    </ConfigRow>
  )
}
