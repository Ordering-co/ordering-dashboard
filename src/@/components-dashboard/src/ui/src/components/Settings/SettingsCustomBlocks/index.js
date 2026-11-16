import React, { createContext, useContext, useId, useRef, useState } from 'react'
import { useConfig, useLanguage } from '../../../../../index'
import {
  applySettingsConfigCopy,
  DATE_TIME_CUSTOM_VALUE,
  DATE_TIME_PRESETS,
  findConfigByKey,
  formatWithDateTokens,
  getActiveCustomBlocks,
  getConfigToggleValues,
  getCustomBlockCopy,
  getDateTimeCompanionValues,
  getDateTimePreview,
  getPreorderTypeRows,
  getRecaptchaFieldGroups,
  getRecaptchaValidation,
  getSettingsBlockFieldName,
  getSettingsBlockFocusId,
  getSettingsInputPresentation,
  getSettingsFocusId,
  getVisibleSettingsConfigs,
  isConfigOn,
  SETTINGS_CUSTOM_BLOCKS,
  normalizeRecaptchaType,
  persistRecaptchaType,
  RECAPTCHA_TYPE_OPTIONS,
  SETTINGS_CONFIG_EFFECT,
  isDateTimePreset,
  LOCATION_CHECK_STATUSES,
  MULTI_CHECKOUT_DISCOUNT_KEYS,
  MULTI_CHECKOUT_DISCOUNT_LABELS,
  ONESIGNAL_APPS,
  PREORDER_TYPE_LABELS,
  parseReservationSettingValue,
  RESERVATION_SETTING_FIELDS,
  updateReservationSettingValue,
  updateType6Value
} from '../../../../../utils/settingsCustomSections'
import { DEFAULT_VISIBLE_DATE_FORMAT } from '../../../../../contexts/UtilsContext'
import { getSettingsSelectOptions } from '../../../../../utils/settingsSelectOptions'
import { SettingsSelectUI } from '../SettingsSelectUI'
import { useSettingsHubForm } from '../SettingsHubForm/SettingsHubFormContext'
import { Field as ProductField, NumberField, TextField, useFieldFrame } from '../../Shared/Product/Field'
import { Checkbox } from '../../Shared/Product/Checkbox'
import { SecretField } from '../../Shared/Product/SecretField'
import { Switch } from '../../Shared/Product/Switch'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import {
  Block,
  BlockHeader,
  BlockHelp,
  BlockTitle,
  BlocksStack,
  CompactTable,
  Field,
  FieldControl,
  FieldHelp,
  FieldLabel,
  FieldError,
  FieldSelect,
  PreviewItem,
  PreviewList,
  Table,
  ToggleRow
} from './styles'
import '../SettingsHubForm/settings-hub-form.css'
import './settings-blocks.css'
import { useLabelFocusesTrigger } from '../SettingsHubForm/useLabelFocusesTrigger'

const SAMPLE_DATE = new Date(2026, 8, 14, 14, 30, 0)

// The date block writes three configs from one choice: the format, `format_time` and `dates_moment_format` (the last two live
// in the block's configs or, hidden in the hub, in the project dictionary). One function for the legacy block and the hub one.
const persistDateTimeFormat = ({ nextFormat, config, configs, projectConfigs, handleInputChange }) => {
  handleInputChange(nextFormat, config.id)
  const companions = getDateTimeCompanionValues(nextFormat)
  const formatTime = findConfigByKey(configs, 'format_time') || projectConfigs?.format_time
  const momentFormat = findConfigByKey(configs, 'dates_moment_format') || projectConfigs?.dates_moment_format
  if (formatTime?.id) handleInputChange(companions.format_time, formatTime.id)
  if (momentFormat?.id) handleInputChange(companions.dates_moment_format, momentFormat.id)
}

const BlockShell = ({ blockId, children }) => {
  const [, t] = useLanguage()
  const copy = getCustomBlockCopy(blockId)
  if (!copy) return children
  return (
    <Block>
      {!copy.hideHeader && (
        <BlockHeader>
          <BlockTitle>{t(copy.titleKey, copy.title)}</BlockTitle>
          {copy.help && <BlockHelp>{t(copy.helpKey, copy.help)}</BlockHelp>}
        </BlockHeader>
      )}
      {children}
    </Block>
  )
}

const ConfigToggle = ({ config, handleInputChange, label }) => {
  if (!config) return null
  const { on, off } = getConfigToggleValues(config)
  return (
    <ToggleRow>
      <input
        type='checkbox'
        checked={isConfigOn(config)}
        onChange={(event) => handleInputChange(event.target.checked ? on : off, config.id)}
      />
      <span>{label || config.name}</span>
    </ToggleRow>
  )
}

const ConfigText = ({ config, handleInputChange, type = 'text', label, help, error, min, max, step, focused }) => {
  if (!config) return null
  const helpText = help || (SETTINGS_CONFIG_EFFECT[config.key] ? config.description : null)
  return (
    <Field id={getSettingsFocusId(config.key)} $focused={!!focused}>
      <FieldLabel htmlFor={`settings-${config.key}`}>{label || config.name}</FieldLabel>
      {helpText && <FieldHelp>{helpText}</FieldHelp>}
      <FieldControl
        id={`settings-${config.key}`}
        type={type}
        value={config.value ?? ''}
        $invalid={!!error}
        min={min}
        max={max}
        step={step}
        onChange={(event) => handleInputChange(event.target.value, config.id)}
        placeholder={label || config.name}
      />
      {error && <FieldError>{error}</FieldError>}
    </Field>
  )
}

// redesign settings C: one fallback for both renderings.
// a project with no stored value is not on ISO; the dashboard paints DEFAULT_VISIBLE_DATE_FORMAT with the clock of
// format_time (24h unless 12; UtilsContext parseDate). The select marks that, so what it shows is what the user sees. This only
// picks what to show: nothing is written until the user changes the select.
const getDateFormatValue = (config, formatTimeConfig) => {
  if (typeof config.value === 'string' && config.value.trim() !== '') return config.value
  const clock = String(formatTimeConfig?.value) === '12' ? 'hh:mm A' : 'HH:mm'
  return `${DEFAULT_VISIBLE_DATE_FORMAT} ${clock}`
}

const DateTimeBlock = ({ configs, handleInputChange, focus }) => {
  const [, t] = useLanguage()
  const [{ configs: projectConfigs }] = useConfig()
  const config = findConfigByKey(configs, 'dates_general_format')
  if (!config) return null
  const value = getDateFormatValue(config, findConfigByKey(configs, 'format_time') || projectConfigs?.format_time)
  const preset = isDateTimePreset(value) ? value : DATE_TIME_CUSTOM_VALUE
  const preview = getDateTimePreview(value, SAMPLE_DATE)

  const persistDateTime = (nextFormat) => persistDateTimeFormat({ nextFormat, config, configs, projectConfigs, handleInputChange })

  const effect = SETTINGS_CONFIG_EFFECT.dates_general_format
  return (
    <BlockShell blockId='date_time'>
      <Field
        id={getSettingsFocusId('dates_general_format')}
        $focused={focus === 'dates_general_format'}
      >
        <FieldLabel htmlFor='settings-dates_general_format'>
          {t('SETTINGS_DATE_TIME_FORMAT', 'Date and time format')}
        </FieldLabel>
        {effect && <FieldHelp>{t(effect.helpKey, effect.help)}</FieldHelp>}
        <FieldSelect
          id='settings-dates_general_format'
          value={preset}
          onChange={(event) => {
            const next = event.target.value
            persistDateTime(next === DATE_TIME_CUSTOM_VALUE ? value : next)
          }}
        >
          {DATE_TIME_PRESETS.map(format => (
            <option key={format} value={format}>
              {formatWithDateTokens(format, SAMPLE_DATE)}
            </option>
          ))}
          <option value={DATE_TIME_CUSTOM_VALUE}>{t('CUSTOM', 'Custom')}</option>
        </FieldSelect>
      </Field>
      {preset === DATE_TIME_CUSTOM_VALUE && (
        <Field>
          <FieldLabel htmlFor='settings-dates_general_format-custom'>
            {t('SETTINGS_DATE_TIME_CUSTOM', 'Custom format')}
          </FieldLabel>
          <FieldControl
            id='settings-dates_general_format-custom'
            type='text'
            value={value}
            onChange={(event) => persistDateTime(event.target.value)}
          />
        </Field>
      )}
      <PreviewList>
        <PreviewItem>
          <span>{t('SETTINGS_DATE_PREVIEW_DATE', 'Date')}</span>
          <span>{preview.date}</span>
        </PreviewItem>
        <PreviewItem>
          <span>{t('SETTINGS_DATE_PREVIEW_TIME', 'Time')}</span>
          <span>{preview.time}</span>
        </PreviewItem>
        <PreviewItem>
          <span>{t('SETTINGS_DATE_PREVIEW_SCHEDULED', 'Scheduled order date')}</span>
          <span>{preview.scheduled}</span>
        </PreviewItem>
      </PreviewList>
    </BlockShell>
  )
}

const RECAPTCHA_ERROR_COPY = {
  SETTINGS_RECAPTCHA_REQUIRED: 'This field is required for the selected version.',
  SETTINGS_RECAPTCHA_SCORE_RANGE: 'Enter a score between 0 and 1.'
}

const RecaptchaBlock = ({ configs, handleInputChange, focus }) => {
  const [, t] = useLanguage()
  const [showErrors, setShowErrors] = useState(false)
  const typeConfig = findConfigByKey(configs, 'security_recaptcha_type')
  const typeValue = normalizeRecaptchaType(typeConfig?.value)
  const switches = ['security_recaptcha_auth', 'security_recaptcha_signup', 'security_recaptcha_order']
    .map(key => findConfigByKey(configs, key))
    .filter(Boolean)
  const anySwitchOn = switches.some(config => isConfigOn(config))
  const validation = getRecaptchaValidation({ type: typeConfig?.value, configs })
  const shouldShowErrors = showErrors || anySwitchOn
  const fieldGroups = getRecaptchaFieldGroups(typeConfig?.value)
  const baseUrlConfig = findConfigByKey(configs, 'security_recaptcha_base_url')

  const translateError = (code) => (
    code ? t(code, RECAPTCHA_ERROR_COPY[code] || code) : null
  )

  const handleTypeChange = (nextType) => {
    if (!typeConfig) return
    handleInputChange(persistRecaptchaType(nextType), typeConfig.id)
    setShowErrors(false)
  }

  const handleToggle = (config, on, off) => (event) => {
    if (event.target.checked && !validation.isValid) {
      setShowErrors(true)
      return
    }
    handleInputChange(event.target.checked ? on : off, config.id)
  }

  return (
    <BlockShell blockId='recaptcha'>
      {typeConfig && (
        <Field>
          <FieldLabel htmlFor='settings-security_recaptcha_type'>
            {t('SETTINGS_RECAPTCHA_VERSION', 'Version')}
          </FieldLabel>
          <FieldSelect
            id='settings-security_recaptcha_type'
            value={typeValue}
            onChange={(event) => handleTypeChange(event.target.value)}
          >
            {RECAPTCHA_TYPE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.label)}
              </option>
            ))}
          </FieldSelect>
        </Field>
      )}
      {switches.map(config => {
        const { on, off } = getConfigToggleValues(config)
        const effect = SETTINGS_CONFIG_EFFECT[config.key]
        return (
          <Field
            key={config.key}
            id={getSettingsFocusId(config.key)}
            $focused={focus === config.key}
          >
            <ToggleRow>
              <input
                type='checkbox'
                checked={isConfigOn(config)}
                onChange={handleToggle(config, on, off)}
              />
              <span>{applySettingsConfigCopy(config, t).name}</span>
            </ToggleRow>
            {effect && <FieldHelp>{t(effect.helpKey, effect.help)}</FieldHelp>}
          </Field>
        )
      })}
      {shouldShowErrors && !validation.isValid && (
        <FieldError>
          {t('SETTINGS_RECAPTCHA_ENABLE_INVALID', 'Fill the required keys for the selected version before enabling reCAPTCHA.')}
        </FieldError>
      )}
      {fieldGroups.map(group => (
        <React.Fragment key={group.id}>
          {fieldGroups.length > 1 && (
            <FieldLabel as='h4'>{t(group.titleKey, group.title)}</FieldLabel>
          )}
          {group.keys.map(key => {
            const config = findConfigByKey(configs, key)
            if (!config) return null
            const copied = applySettingsConfigCopy(config, t)
            return (
              <ConfigText
                key={key}
                config={copied}
                handleInputChange={handleInputChange}
                type={key.includes('secret') ? 'password' : (key.includes('score') ? 'number' : 'text')}
                min={key.includes('score') ? 0 : undefined}
                max={key.includes('score') ? 1 : undefined}
                step={key.includes('score') ? 'any' : undefined}
                error={shouldShowErrors ? translateError(validation.errors[key]) : null}
              />
            )
          })}
        </React.Fragment>
      ))}
      {baseUrlConfig && (
        <ConfigText
          config={applySettingsConfigCopy(baseUrlConfig, t)}
          handleInputChange={handleInputChange}
        />
      )}
    </BlockShell>
  )
}

const LocationChecksBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const rows = LOCATION_CHECK_STATUSES.map(row => ({
    ...row,
    enabled: findConfigByKey(configs, `location_validation_enabled_status_${row.status}`),
    distance: findConfigByKey(configs, `location_validation_distance_status_${row.status}`),
    validity: findConfigByKey(configs, `location_validation_validity_status_${row.status}`)
  })).filter(row => row.enabled || row.distance || row.validity)

  if (!rows.length) return null

  return (
    <BlockShell blockId='location_checks'>
      <CompactTable>
        <Table>
          <thead>
            <tr>
              <th>{t('SETTINGS_LOCATION_STATUS', 'Status')}</th>
              <th>{t('SETTINGS_LOCATION_ENABLE', 'Enable')}</th>
              <th>{t('SETTINGS_LOCATION_DISTANCE', 'Min distance (m)')}</th>
              <th>{t('SETTINGS_LOCATION_AGE', 'Max age (min)')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.status}>
                <td>{t(row.labelKey, row.label)}</td>
                <td>
                  {row.enabled && (
                    <input
                      type='checkbox'
                      checked={isConfigOn(row.enabled)}
                      onChange={(event) => {
                        const { on, off } = getConfigToggleValues(row.enabled)
                        handleInputChange(event.target.checked ? on : off, row.enabled.id)
                      }}
                      aria-label={t(row.labelKey, row.label)}
                    />
                  )}
                </td>
                <td>
                  {row.distance && (
                    <input
                      type='number'
                      min='0'
                      aria-label={`${t(row.labelKey, row.label)}: ${t('SETTINGS_LOCATION_DISTANCE', 'Min distance (m)')}`}
                      value={row.distance.value ?? ''}
                      onChange={(event) => handleInputChange(event.target.value, row.distance.id)}
                    />
                  )}
                </td>
                <td>
                  {row.validity && (
                    <input
                      type='number'
                      min='0'
                      aria-label={`${t(row.labelKey, row.label)}: ${t('SETTINGS_LOCATION_AGE', 'Max age (min)')}`}
                      value={row.validity.value ?? ''}
                      onChange={(event) => handleInputChange(event.target.value, row.validity.id)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CompactTable>
    </BlockShell>
  )
}

const PreorderWindowBlock = ({ configs, handleInputChange, focus }) => {
  const [, t] = useLanguage()
  const defaultDays = findConfigByKey(configs, 'max_days_preorder')
  const byType = findConfigByKey(configs, 'preorder_maximum_days')
  const includeCatering = true
  const rows = byType ? getPreorderTypeRows(byType.value, { includeCatering }) : []

  return (
    <BlockShell blockId='preorder_window'>
      {defaultDays && (
        <ConfigText
          config={applySettingsConfigCopy(defaultDays, t)}
          handleInputChange={handleInputChange}
          type='number'
          focused={focus === defaultDays.key}
        />
      )}
      {byType && (
        <CompactTable>
          <Table>
            <thead>
              <tr>
                <th>{t('SETTINGS_PREORDER_TYPE', 'Order type')}</th>
                <th>{t('SETTINGS_PREORDER_DAYS', 'Days')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const copy = PREORDER_TYPE_LABELS[row.type] || { labelKey: row.type.toUpperCase(), label: row.type.replace(/_/g, ' ') }
                return (
                  <tr key={row.type}>
                    <td>{t(copy.labelKey, copy.label)}</td>
                    <td>
                      <input
                        type='number'
                        min='1'
                        aria-label={`${t(copy.labelKey, copy.label)}: ${t('SETTINGS_PREORDER_DAYS', 'Days')}`}
                        value={row.value}
                        onChange={(event) => handleInputChange(
                          updateType6Value(byType.value, row.type, event.target.value),
                          byType.id
                        )}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        </CompactTable>
      )}
    </BlockShell>
  )
}

const OneSignalBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const apps = ONESIGNAL_APPS.map(app => ({
    ...app,
    idConfig: findConfigByKey(configs, app.idKey),
    secretConfig: findConfigByKey(configs, app.secretKey)
  })).filter(app => app.idConfig || app.secretConfig)

  if (!apps.length) return null

  return (
    <BlockShell blockId='onesignal'>
      <CompactTable>
        <Table>
          <thead>
            <tr>
              <th>{t('SETTINGS_ONESIGNAL_APP', 'App')}</th>
              <th>{t('SETTINGS_ONESIGNAL_ID', 'App ID')}</th>
              <th>{t('SETTINGS_ONESIGNAL_KEY', 'REST API key')}</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(app => (
              <tr key={app.idKey}>
                <td>{t(app.labelKey, app.label)}</td>
                <td>
                  {app.idConfig && (
                    <input
                      type='text'
                      aria-label={`${t(app.labelKey, app.label)}: ${t('SETTINGS_ONESIGNAL_ID', 'App ID')}`}
                      value={app.idConfig.value ?? ''}
                      onChange={(event) => handleInputChange(event.target.value, app.idConfig.id)}
                    />
                  )}
                </td>
                <td>
                  {app.secretConfig && (
                    <input
                      type='password'
                      aria-label={`${t(app.labelKey, app.label)}: ${t('SETTINGS_ONESIGNAL_KEY', 'REST API key')}`}
                      value={app.secretConfig.value ?? ''}
                      onChange={(event) => handleInputChange(event.target.value, app.secretConfig.id)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CompactTable>
    </BlockShell>
  )
}

const OrderAlertsBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const inApp = findConfigByKey(configs, 'notification_in_app_enabled')
  const position = findConfigByKey(configs, 'notification_in_app_position')
  const toast = findConfigByKey(configs, 'notification_toast')

  return (
    <BlockShell blockId='order_alerts'>
      <ConfigToggle
        config={inApp}
        handleInputChange={handleInputChange}
        label={applySettingsConfigCopy(inApp || {}, t).name}
      />
      {position && (
        <SettingsSelectUI
          config={applySettingsConfigCopy(position, t)}
          defaultValue={position.value}
          handleSelectChange={(value) => handleInputChange(value, position.id)}
        />
      )}
      <ConfigToggle
        config={toast}
        handleInputChange={handleInputChange}
        label={applySettingsConfigCopy(toast || {}, t).name}
      />
    </BlockShell>
  )
}

const MultiCheckoutBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const rows = MULTI_CHECKOUT_DISCOUNT_KEYS
    .map(key => ({ key, config: findConfigByKey(configs, key), ...MULTI_CHECKOUT_DISCOUNT_LABELS[key] }))
    .filter(row => row.config)

  if (!rows.length) return null

  return (
    <BlockShell blockId='multi_checkout'>
      <CompactTable>
        <Table>
          <thead>
            <tr>
              <th>{t('SETTINGS_MULTI_CART', 'Cart')}</th>
              <th>{t('SETTINGS_MULTI_DISCOUNT', 'Discount %')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key}>
                <td>{t(row.labelKey, row.label)}</td>
                <td>
                  <input
                    type='number'
                    min='0'
                    max='100'
                    aria-label={`${t(row.labelKey, row.label)}: ${t('SETTINGS_MULTI_DISCOUNT', 'Discount %')}`}
                    value={row.config.value ?? ''}
                    onChange={(event) => handleInputChange(event.target.value, row.config.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </CompactTable>
    </BlockShell>
  )
}

const ReservationSettingsBlock = ({ configs, handleInputChange, focus }) => {
  const [, t] = useLanguage()
  const config = findConfigByKey(configs, 'reservation_setting')
  if (!config) return null
  const values = parseReservationSettingValue(config.value)

  return (
    <BlockShell blockId='reservation'>
      <Field id={getSettingsFocusId(config.key)} $focused={focus === config.key}>
      <CompactTable>
        <Table>
          <thead>
            <tr>
              <th>{t('SETTINGS_RESERVATION_COL', 'Setting')}</th>
              <th>{t('SETTINGS_TYPE6_VALUE', 'Value')}</th>
            </tr>
          </thead>
          <tbody>
            {RESERVATION_SETTING_FIELDS.map((field) => {
              const fieldId = `settings-reservation-${field.key}`
              const label = t(field.labelKey, field.label)
              return (
                <tr key={field.key}>
                  <td>{label}</td>
                  <td>
                    {field.type === 'boolean'
                      ? (
                        <select
                          id={fieldId}
                          aria-label={label}
                          value={values[field.key] ? '1' : '0'}
                          onChange={(event) => handleInputChange(
                            updateReservationSettingValue(config.value, field.key, event.target.value),
                            config.id
                          )}
                        >
                          <option value='1'>{t('YES', 'Yes')}</option>
                          <option value='0'>{t('NO', 'No')}</option>
                        </select>
                        )
                      : (
                        <input
                          id={fieldId}
                          aria-label={label}
                          type='number'
                          min='0'
                          value={values[field.key] ?? ''}
                          onChange={(event) => handleInputChange(
                            updateReservationSettingValue(config.value, field.key, event.target.value),
                            config.id
                          )}
                        />
                        )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </CompactTable>
      </Field>
    </BlockShell>
  )
}

const BLOCK_RENDERERS = {
  date_time: DateTimeBlock,
  recaptcha: RecaptchaBlock,
  location_checks: LocationChecksBlock,
  preorder_window: PreorderWindowBlock,
  onesignal: OneSignalBlock,
  order_alerts: OrderAlertsBlock,
  multi_checkout: MultiCheckoutBlock,
  reservation: ReservationSettingsBlock
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// redesign settings C: the same 8 blocks inside the Settings hub (SettingsHubFormContext provider), drawn with the
// Product anatomy of Lote B (`odc-hub-*` rows, P/Field family, P/Checkbox, P/Switch, C18 select). Same values, same rules, same
// `handleInputChange(value, config.id)` calls, same focus anchors as the legacy blocks above; only the controls change. Every
// control has a name: a bound label, or «row — column» in a table cell. Without the provider none of this renders.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

// The select is the Product anatomy (C18): trigger as wide as the field, brand rows.
const FIT_TRIGGER = { fitTrigger: true }

// The id of the title of the block being drawn: its tables are named by it.
const BlockTitleContext = createContext(undefined)

const numberOrNull = (raw) => {
  if (raw === '' || raw == null) return null
  const number = Number(raw)
  return Number.isFinite(number) ? number : null
}

// NumberField speaks numbers (or null when empty); the configs store strings.
const numberToValue = (next) => (next == null ? '' : String(next))

const ProductBlock = ({ blockId, children }) => {
  const [, t] = useLanguage()
  const titleId = useId()
  const copy = getCustomBlockCopy(blockId)
  if (!copy) return children
  const titled = !copy.hideHeader
  return (
    <BlockTitleContext.Provider value={titled ? titleId : undefined}>
      <section className='odc-block' aria-labelledby={titled ? titleId : undefined}>
        {titled && (
          <div className='odc-block-header'>
            <h3 id={titleId} className='odc-block-title'>{t(copy.titleKey, copy.title)}</h3>
            {copy.help && <p className='odc-block-help'>{t(copy.helpKey, copy.help)}</p>}
          </div>
        )}
        {children}
      </section>
    </BlockTitleContext.Provider>
  )
}

// A row of the block. `configKey` puts the `?focus=` anchor of the legacy field on it (rows that had none keep none).
const ProductRow = ({ configKey, focused = false, layout, children }) => (
  <div
    id={configKey ? getSettingsFocusId(configKey) : undefined}
    className='odc-hub-row'
    data-layout={layout}
    data-focused={focused ? '' : undefined}
  >
    {children}
  </div>
)

const ProductTable = ({ children }) => {
  const titleId = useContext(BlockTitleContext)
  return (
    <div className='odc-hub-table-wrap'>
      <table className='odc-hub-table' aria-labelledby={titleId}>{children}</table>
    </div>
  )
}

/** The C18 select, named by the label of its Field (the trigger names itself «label + value»). */
const BlockSelect = ({ items, value, label, onSelect }) => {
  const [, t] = useLanguage()
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
          defaultValue={value}
          onChange={onSelect}
          placeholder={t('SELECT_A_OPTION', 'Select a option')}
        />
      </SelectSurfaceContext.Provider>
    </span>
  )
}

/** P/SecretField with the hub's words: hidden by default, «Show» / «Hide», and the last four characters («Ends in …»). */
const ProductSecretInput = ({ value, placeholder, onChange, ...frame }) => {
  const [, t] = useLanguage()
  const [endsBefore, endsAfter] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
  return (
    <SecretField
      {...frame}
      value={value ?? ''}
      placeholder={placeholder}
      showLabel={t('SHOW', 'Show')}
      hideLabel={t('HIDE', 'Hide')}
      endingLabel={ending => <>{endsBefore}{ending}{endsAfter}</>}
      onChange={onChange}
    />
  )
}

/**
 * A config of the block as one labelled field: text, secret (P/SecretField: hidden, «Show», «Ends in») or number.
 * a value that is an instruction («Add your Recaptcha Site Key») paints as the hint of an empty field.
 */
const ProductConfigField = ({ config, handleInputChange, kind = 'text', label, help, error, min, max, step, focused }) => {
  const name = label || config.name
  const hint = help || (SETTINGS_CONFIG_EFFECT[config.key] ? config.description : undefined) || undefined
  const change = (value) => handleInputChange(value, config.id)
  const presentation = getSettingsInputPresentation(config)
  let control
  if (kind === 'number') {
    control = (
      <NumberField
        label={name}
        hint={hint}
        error={error}
        min={min}
        max={max}
        step={step}
        value={numberOrNull(presentation.value)}
        placeholder={presentation.placeholder}
        onChange={(next) => change(numberToValue(next))}
      />
    )
  } else if (kind === 'password') {
    control = (
      <ProductSecretInput
        label={name}
        hint={hint}
        error={error}
        value={presentation.value}
        placeholder={presentation.placeholder}
        onChange={change}
      />
    )
  } else {
    control = (
      <TextField
        label={name}
        hint={hint}
        error={error}
        value={presentation.value ?? ''}
        placeholder={presentation.placeholder}
        onChange={change}
      />
    )
  }
  return (
    <ProductRow configKey={config.key} focused={!!focused} layout={kind === 'number' ? 'inline' : undefined}>
      {control}
    </ProductRow>
  )
}

/** A single yes/no config drawn as the Product checkbox, controlled by the current value. */
const ProductToggle = ({ config, label, handleInputChange }) => {
  if (!config) return null
  const { on, off } = getConfigToggleValues(config)
  return (
    <ProductRow>
      <Checkbox
        checked={isConfigOn(config)}
        onCheckedChange={(next) => handleInputChange(next ? on : off, config.id)}
      >
        {label || config.name}
      </Checkbox>
    </ProductRow>
  )
}

const ProductDateTimeBlock = ({ configs, handleInputChange, focus, fieldErrors }) => {
  const [, t] = useLanguage()
  const [{ configs: projectConfigs }] = useConfig()
  const config = findConfigByKey(configs, 'dates_general_format')
  if (!config) return null
  const value = getDateFormatValue(config, findConfigByKey(configs, 'format_time') || projectConfigs?.format_time)
  const preset = isDateTimePreset(value) ? value : DATE_TIME_CUSTOM_VALUE
  const preview = getDateTimePreview(value, SAMPLE_DATE)
  const persistDateTime = (nextFormat) => persistDateTimeFormat({ nextFormat, config, configs, projectConfigs, handleInputChange })
  const effect = SETTINGS_CONFIG_EFFECT.dates_general_format
  const label = t('SETTINGS_DATE_TIME_FORMAT', 'Date and time format')
  const items = [
    ...DATE_TIME_PRESETS.map(format => ({ value: format, content: formatWithDateTokens(format, SAMPLE_DATE) })),
    { value: DATE_TIME_CUSTOM_VALUE, content: t('CUSTOM', 'Custom') }
  ]

  return (
    <ProductBlock blockId='date_time'>
      <ProductRow configKey='dates_general_format' focused={focus === 'dates_general_format'} layout='inline'>
        <ProductField
          label={label}
          hint={effect ? t(effect.helpKey, effect.help) : undefined}
          error={fieldErrors?.dates_general_format || null}
        >
          <BlockSelect
            items={items}
            value={preset}
            label={label}
            onSelect={(next) => persistDateTime(next === DATE_TIME_CUSTOM_VALUE ? value : next)}
          />
        </ProductField>
      </ProductRow>
      {preset === DATE_TIME_CUSTOM_VALUE && (
        <ProductRow>
          <TextField
            label={t('SETTINGS_DATE_TIME_CUSTOM', 'Custom format')}
            value={value}
            onChange={persistDateTime}
          />
        </ProductRow>
      )}
      <ul className='odc-block-preview'>
        <li><span>{t('SETTINGS_DATE_PREVIEW_DATE', 'Date')}</span><span>{preview.date}</span></li>
        <li><span>{t('SETTINGS_DATE_PREVIEW_TIME', 'Time')}</span><span>{preview.time}</span></li>
        <li><span>{t('SETTINGS_DATE_PREVIEW_SCHEDULED', 'Scheduled order date')}</span><span>{preview.scheduled}</span></li>
      </ul>
    </ProductBlock>
  )
}

const ProductRecaptchaBlock = ({ configs, handleInputChange, focus, fieldErrors }) => {
  const [, t] = useLanguage()
  const baseId = useId()
  const [showErrors, setShowErrors] = useState(false)
  const typeConfig = findConfigByKey(configs, 'security_recaptcha_type')
  const typeValue = normalizeRecaptchaType(typeConfig?.value)
  const switches = ['security_recaptcha_auth', 'security_recaptcha_signup', 'security_recaptcha_order']
    .map(key => findConfigByKey(configs, key))
    .filter(Boolean)
  const anySwitchOn = switches.some(config => isConfigOn(config))
  const validation = getRecaptchaValidation({ type: typeConfig?.value, configs })
  const shouldShowErrors = showErrors || anySwitchOn
  const fieldGroups = getRecaptchaFieldGroups(typeConfig?.value)
  const baseUrlConfig = findConfigByKey(configs, 'security_recaptcha_base_url')
  const versionLabel = t('SETTINGS_RECAPTCHA_VERSION', 'Version')

  const translateError = (code) => (
    code ? t(code, RECAPTCHA_ERROR_COPY[code] || code) : null
  )
  const enableError = shouldShowErrors && !validation.isValid
    ? t('SETTINGS_RECAPTCHA_ENABLE_INVALID', 'Fill the required keys for the selected version before enabling reCAPTCHA.')
    : null
  // The message the save step gave (under `security_recaptcha_type`) goes under the version, unless the block already says it.
  const alreadyShown = [enableError, ...(shouldShowErrors ? Object.values(validation.errors).map(translateError) : [])]
  const submitError = fieldErrors?.security_recaptcha_type
  const versionError = submitError && !alreadyShown.includes(submitError) ? submitError : null

  const handleTypeChange = (nextType) => {
    if (!typeConfig) return
    handleInputChange(persistRecaptchaType(nextType), typeConfig.id)
    setShowErrors(false)
  }

  const handleToggle = (config, on, off, next) => {
    if (next && !validation.isValid) {
      setShowErrors(true)
      return
    }
    handleInputChange(next ? on : off, config.id)
  }

  return (
    <ProductBlock blockId='recaptcha'>
      {typeConfig && (
        <ProductRow layout='inline'>
          <ProductField label={versionLabel} error={versionError}>
            <BlockSelect
              items={RECAPTCHA_TYPE_OPTIONS.map(option => ({ value: option.value, content: t(option.labelKey, option.label) }))}
              value={typeValue}
              label={versionLabel}
              onSelect={handleTypeChange}
            />
          </ProductField>
        </ProductRow>
      )}
      {switches.map(config => {
        const { on, off } = getConfigToggleValues(config)
        const effect = SETTINGS_CONFIG_EFFECT[config.key]
        const hintId = `${baseId}-${config.key}-hint`
        return (
          <ProductRow key={config.key} configKey={config.key} focused={focus === config.key}>
            <div className='odc-hub-group'>
              <Checkbox
                aria-describedby={effect ? hintId : undefined}
                checked={isConfigOn(config)}
                onCheckedChange={(next) => handleToggle(config, on, off, next)}
              >
                {applySettingsConfigCopy(config, t).name}
              </Checkbox>
              {effect && <p id={hintId} className='odc-hub-hint'>{t(effect.helpKey, effect.help)}</p>}
            </div>
          </ProductRow>
        )
      })}
      {enableError && <p className='odc-hub-error' role='alert'>{enableError}</p>}
      {fieldGroups.map(group => (
        <React.Fragment key={group.id}>
          {fieldGroups.length > 1 && (
            <h4 className='odc-block-subtitle'>{t(group.titleKey, group.title)}</h4>
          )}
          {group.keys.map(key => {
            const config = findConfigByKey(configs, key)
            if (!config) return null
            return (
              <ProductConfigField
                key={key}
                config={applySettingsConfigCopy(config, t)}
                handleInputChange={handleInputChange}
                kind={key.includes('secret') ? 'password' : (key.includes('score') ? 'number' : 'text')}
                step={key.includes('score') ? 0.1 : undefined}
                error={shouldShowErrors ? translateError(validation.errors[key]) : null}
              />
            )
          })}
        </React.Fragment>
      ))}
      {baseUrlConfig && (
        <ProductConfigField
          config={applySettingsConfigCopy(baseUrlConfig, t)}
          handleInputChange={handleInputChange}
        />
      )}
    </ProductBlock>
  )
}

const ProductLocationChecksBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const rows = LOCATION_CHECK_STATUSES.map(row => ({
    ...row,
    enabled: findConfigByKey(configs, `location_validation_enabled_status_${row.status}`),
    distance: findConfigByKey(configs, `location_validation_distance_status_${row.status}`),
    validity: findConfigByKey(configs, `location_validation_validity_status_${row.status}`)
  })).filter(row => row.enabled || row.distance || row.validity)

  if (!rows.length) return null
  const enableText = t('SETTINGS_LOCATION_ENABLE', 'Enable')
  const distanceText = t('SETTINGS_LOCATION_DISTANCE', 'Min distance (m)')
  const ageText = t('SETTINGS_LOCATION_AGE', 'Max age (min)')

  return (
    <ProductBlock blockId='location_checks'>
      <ProductTable>
        <thead>
          <tr>
            <th scope='col'>{t('SETTINGS_LOCATION_STATUS', 'Status')}</th>
            <th scope='col'>{enableText}</th>
            <th scope='col'>{distanceText}</th>
            <th scope='col'>{ageText}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const rowText = t(row.labelKey, row.label)
            return (
              <tr key={row.status}>
                <td>{rowText}</td>
                <td>
                  {row.enabled && (
                    <Checkbox
                      label={getSettingsBlockFieldName(row.enabled, t)}
                      checked={isConfigOn(row.enabled)}
                      onCheckedChange={(next) => {
                        const { on, off } = getConfigToggleValues(row.enabled)
                        handleInputChange(next ? on : off, row.enabled.id)
                      }}
                    />
                  )}
                </td>
                <td>
                  {row.distance && (
                    <NumberField
                      aria-label={getSettingsBlockFieldName(row.distance, t)}
                      min={0}
                      value={numberOrNull(row.distance.value)}
                      onChange={(next) => handleInputChange(numberToValue(next), row.distance.id)}
                    />
                  )}
                </td>
                <td>
                  {row.validity && (
                    <NumberField
                      aria-label={getSettingsBlockFieldName(row.validity, t)}
                      min={0}
                      value={numberOrNull(row.validity.value)}
                      onChange={(next) => handleInputChange(numberToValue(next), row.validity.id)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </ProductTable>
    </ProductBlock>
  )
}

const ProductPreorderWindowBlock = ({ configs, handleInputChange, focus, fieldErrors }) => {
  const [, t] = useLanguage()
  const defaultDays = findConfigByKey(configs, 'max_days_preorder')
  const byType = findConfigByKey(configs, 'preorder_maximum_days')
  const rows = byType ? getPreorderTypeRows(byType.value, { includeCatering: true }) : []
  const daysText = t('SETTINGS_PREORDER_DAYS', 'Days')

  return (
    <ProductBlock blockId='preorder_window'>
      {defaultDays && (
        <ProductConfigField
          config={applySettingsConfigCopy(defaultDays, t)}
          handleInputChange={handleInputChange}
          kind='number'
          focused={focus === defaultDays.key}
          error={fieldErrors?.[defaultDays.key] || null}
        />
      )}
      {byType && (
        <ProductTable>
          <thead>
            <tr>
              <th scope='col'>{t('SETTINGS_PREORDER_TYPE', 'Order type')}</th>
              <th scope='col'>{daysText}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const copy = PREORDER_TYPE_LABELS[row.type] || { labelKey: row.type.toUpperCase(), label: row.type.replace(/_/g, ' ') }
              const typeText = t(copy.labelKey, copy.label)
              return (
                <tr key={row.type}>
                  <td>{typeText}</td>
                  <td>
                    <NumberField
                      aria-label={`${typeText} — ${daysText}`}
                      min={1}
                      value={numberOrNull(row.value)}
                      onChange={(next) => handleInputChange(
                        updateType6Value(byType.value, row.type, numberToValue(next)),
                        byType.id
                      )}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </ProductTable>
      )}
    </ProductBlock>
  )
}

const ProductOneSignalBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const apps = ONESIGNAL_APPS.map(app => ({
    ...app,
    idConfig: findConfigByKey(configs, app.idKey),
    secretConfig: findConfigByKey(configs, app.secretKey)
  })).filter(app => app.idConfig || app.secretConfig)

  if (!apps.length) return null
  const idText = t('SETTINGS_ONESIGNAL_ID', 'App ID')
  const keyText = t('SETTINGS_ONESIGNAL_KEY', 'REST API key')

  return (
    <ProductBlock blockId='onesignal'>
      <ProductTable>
        <thead>
          <tr>
            <th scope='col'>{t('SETTINGS_ONESIGNAL_APP', 'App')}</th>
            <th scope='col'>{idText}</th>
            <th scope='col'>{keyText}</th>
          </tr>
        </thead>
        <tbody>
          {apps.map(app => {
            const appText = t(app.labelKey, app.label)
            return (
              <tr key={app.idKey}>
                <td>{appText}</td>
                <td>
                  {app.idConfig && (
                    <TextField
                      aria-label={getSettingsBlockFieldName(app.idConfig, t)}
                      value={app.idConfig.value ?? ''}
                      onChange={(next) => handleInputChange(next, app.idConfig.id)}
                    />
                  )}
                </td>
                <td className='odc-hub-secret-cell'>
                  {app.secretConfig && (
                    <ProductSecretInput
                      aria-label={getSettingsBlockFieldName(app.secretConfig, t)}
                      value={getSettingsInputPresentation(app.secretConfig).value}
                      placeholder={getSettingsInputPresentation(app.secretConfig).placeholder}
                      onChange={(next) => handleInputChange(next, app.secretConfig.id)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </ProductTable>
    </ProductBlock>
  )
}

const ProductOrderAlertsBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const inApp = findConfigByKey(configs, 'notification_in_app_enabled')
  const position = findConfigByKey(configs, 'notification_in_app_position')
  const toast = findConfigByKey(configs, 'notification_toast')
  const positionCopy = position ? applySettingsConfigCopy(position, t) : null
  const positionItems = positionCopy
    ? getSettingsSelectOptions({ config: positionCopy, t })?.map(item => ({ value: item.value, content: item.label }))
    : null

  return (
    <ProductBlock blockId='order_alerts'>
      <ProductToggle
        config={inApp}
        handleInputChange={handleInputChange}
        label={applySettingsConfigCopy(inApp || {}, t).name}
      />
      {position && (
        <ProductRow layout='inline'>
          <ProductField
            label={positionCopy.name}
            hint={positionCopy.description || undefined}
            error={positionItems ? null : t('NO_OPTIONS_VALUE', 'There is no options value')}
          >
            {positionItems && (
              <BlockSelect
                items={positionItems}
                value={position.value}
                label={positionCopy.name}
                onSelect={(next) => handleInputChange(next, position.id)}
              />
            )}
          </ProductField>
        </ProductRow>
      )}
      <ProductToggle
        config={toast}
        handleInputChange={handleInputChange}
        label={applySettingsConfigCopy(toast || {}, t).name}
      />
    </ProductBlock>
  )
}

const ProductMultiCheckoutBlock = ({ configs, handleInputChange }) => {
  const [, t] = useLanguage()
  const rows = MULTI_CHECKOUT_DISCOUNT_KEYS
    .map(key => ({ key, config: findConfigByKey(configs, key), ...MULTI_CHECKOUT_DISCOUNT_LABELS[key] }))
    .filter(row => row.config)

  if (!rows.length) return null
  const discountText = t('SETTINGS_MULTI_DISCOUNT', 'Discount %')

  return (
    <ProductBlock blockId='multi_checkout'>
      <ProductTable>
        <thead>
          <tr>
            <th scope='col'>{t('SETTINGS_MULTI_CART', 'Cart')}</th>
            <th scope='col'>{discountText}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const cartText = t(row.labelKey, row.label)
            return (
              <tr key={row.key}>
                <td>{cartText}</td>
                <td>
                  <NumberField
                    aria-label={getSettingsBlockFieldName(row.config, t)}
                    min={0}
                    max={100}
                    value={numberOrNull(row.config.value)}
                    onChange={(next) => handleInputChange(numberToValue(next), row.config.id)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </ProductTable>
    </ProductBlock>
  )
}

const ProductReservationBlock = ({ configs, handleInputChange, focus, fieldErrors }) => {
  const [, t] = useLanguage()
  const config = findConfigByKey(configs, 'reservation_setting')
  if (!config) return null
  const values = parseReservationSettingValue(config.value)
  const valueText = t('SETTINGS_TYPE6_VALUE', 'Value')
  const error = fieldErrors?.[config.key]

  return (
    <ProductBlock blockId='reservation'>
      <ProductRow configKey={config.key} focused={focus === config.key}>
        <ProductTable>
          <thead>
            <tr>
              <th scope='col'>{t('SETTINGS_RESERVATION_COL', 'Setting')}</th>
              <th scope='col'>{valueText}</th>
            </tr>
          </thead>
          <tbody>
            {RESERVATION_SETTING_FIELDS.map((field) => {
              const rowText = t(field.labelKey, field.label)
              const write = (next) => handleInputChange(
                updateReservationSettingValue(config.value, field.key, next),
                config.id
              )
              return (
                <tr key={field.key}>
                  <td>{rowText}</td>
                  <td>
                    {field.type === 'boolean'
                      ? (
                        <Switch
                          label={`${rowText} — ${valueText}`}
                          checked={!!values[field.key]}
                          onCheckedChange={(next) => write(next ? '1' : '0')}
                        />
                        )
                      : (
                        <NumberField
                          aria-label={`${rowText} — ${valueText}`}
                          min={0}
                          value={numberOrNull(values[field.key])}
                          onChange={(next) => write(numberToValue(next))}
                        />
                        )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </ProductTable>
        {error && <p className='odc-hub-error' role='alert'>{error}</p>}
      </ProductRow>
    </ProductBlock>
  )
}

const PRODUCT_BLOCK_RENDERERS = {
  date_time: ProductDateTimeBlock,
  recaptcha: ProductRecaptchaBlock,
  location_checks: ProductLocationChecksBlock,
  preorder_window: ProductPreorderWindowBlock,
  onesignal: ProductOneSignalBlock,
  order_alerts: ProductOrderAlertsBlock,
  multi_checkout: ProductMultiCheckoutBlock,
  reservation: ProductReservationBlock
}

/**
 * `fieldErrors` (SettingsList inside the hub): `{ [config key]: translated message }`, shown under the field that failed.
 * Ignored without the hub provider.
 */
export const SettingsCustomBlocks = ({ configs, handleInputChange, focus, fieldErrors }) => {
  const product = !!useSettingsHubForm()
  const visibleConfigs = getVisibleSettingsConfigs(configs)
  const blocks = getActiveCustomBlocks(visibleConfigs)
  if (!blocks.length) return null
  const renderers = product ? PRODUCT_BLOCK_RENDERERS : BLOCK_RENDERERS

  return (
    <BlocksStack>
      {blocks.map(blockId => {
        const Renderer = renderers[blockId]
        if (!Renderer) return null
        const anchorKey = SETTINGS_CUSTOM_BLOCKS[blockId]?.keys?.[0]
        return (
          <div key={blockId} id={getSettingsBlockFocusId(anchorKey)}>
            <Renderer
              configs={visibleConfigs}
              handleInputChange={handleInputChange}
              focus={focus}
              fieldErrors={product ? fieldErrors : undefined}
            />
          </div>
        )
      })}
    </BlocksStack>
  )
}
