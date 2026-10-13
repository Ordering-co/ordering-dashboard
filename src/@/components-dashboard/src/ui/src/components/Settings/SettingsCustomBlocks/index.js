import React, { useState } from 'react'
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
  getSettingsBlockFocusId,
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
import { SettingsSelectUI } from '../SettingsSelectUI'
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

const SAMPLE_DATE = new Date(2026, 8, 14, 14, 30, 0)

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

const DateTimeBlock = ({ configs, handleInputChange, focus }) => {
  const [, t] = useLanguage()
  const [{ configs: projectConfigs }] = useConfig()
  const config = findConfigByKey(configs, 'dates_general_format')
  if (!config) return null
  const value = config.value || 'YYYY-MM-DD HH:mm:ss'
  const preset = isDateTimePreset(value) ? value : DATE_TIME_CUSTOM_VALUE
  const preview = getDateTimePreview(value, SAMPLE_DATE)

  const persistDateTime = (nextFormat) => {
    handleInputChange(nextFormat, config.id)
    const companions = getDateTimeCompanionValues(nextFormat)
    const formatTime = findConfigByKey(configs, 'format_time') || projectConfigs?.format_time
    const momentFormat = findConfigByKey(configs, 'dates_moment_format') || projectConfigs?.dates_moment_format
    if (formatTime?.id) handleInputChange(companions.format_time, formatTime.id)
    if (momentFormat?.id) handleInputChange(companions.dates_moment_format, momentFormat.id)
  }

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
                      value={app.idConfig.value ?? ''}
                      onChange={(event) => handleInputChange(event.target.value, app.idConfig.id)}
                    />
                  )}
                </td>
                <td>
                  {app.secretConfig && (
                    <input
                      type='password'
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

export const SettingsCustomBlocks = ({ configs, handleInputChange, focus }) => {
  const visibleConfigs = getVisibleSettingsConfigs(configs)
  const blocks = getActiveCustomBlocks(visibleConfigs)
  if (!blocks.length) return null

  return (
    <BlocksStack>
      {blocks.map(blockId => {
        const Renderer = BLOCK_RENDERERS[blockId]
        if (!Renderer) return null
        const anchorKey = SETTINGS_CUSTOM_BLOCKS[blockId]?.keys?.[0]
        return (
          <div key={blockId} id={getSettingsBlockFocusId(anchorKey)}>
            <Renderer
              configs={visibleConfigs}
              handleInputChange={handleInputChange}
              focus={focus}
            />
          </div>
        )
      })}
    </BlocksStack>
  )
}
