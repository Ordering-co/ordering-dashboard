import React, { useId, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { EmptyState, Field, SelectField, Skeleton, Switch, TextField } from '../../Shared/Product'
import { SecretField } from '../../Shared/Product/SecretField'
import { TriangleAlert } from '../../Shared/Icon'
import { isSecretConfig } from '../SettingsList/secretConfigKeys'
import { applySettingsConfigCopy } from '../../../../../utils/settingsCustomSections'
import { getSettingsSelectOptions, getSettingsSwitchModel } from '../../../../../utils/settingsSelectOptions'
import '../SettingsHubForm/settings-hub-form.css'
import './site-setting-details.css'

// the «Custom» option's own value in the select. The option list gives it the stored value (as main's legacy select),
// which can be any text, so the select tells it apart by this key; picking it still sends the stored value, as main did.
const CUSTOM_KEY = '\u0000custom'

// a type 2 config. The controller does not write an edit back into `config.value` (outside the hub every edit is one PUT;
// inside it the change waits in the screen), so the choice lives here, else the control would snap back to the stored value.
// The options are main's (getSettingsSelectOptions, no inversion, as SettingsSelectUI drew them for a site): exact Yes/No is a
// switch (getSettingsSwitchModel, as the hub rows), anything else the Product select; the Custom option keeps its free text.
const SiteSelectControl = ({ config, change }) => {
  const [, t] = useLanguage()
  const baseId = useId()
  const display = applySettingsConfigCopy(config, t)
  const name = display?.name
  const hint = display?.description || undefined
  const list = getSettingsSelectOptions({ config, t })
  const regular = (list || []).filter(item => !item.custom)
  const customItem = (list || []).find(item => item.custom)
  const isRegular = value => regular.some(item => String(item.value) === String(value))
  const [state, setState] = useState(() => ({ value: config.value, custom: !!customItem && !isRegular(config.value) }))
  const pick = (value, custom = false) => {
    setState({ value, custom })
    change(value)
  }

  const model = getSettingsSwitchModel({ config: { ...config, value: state.value } })
  if (model) {
    return (
      <div className='odc-hub-row' data-layout='inline'>
        <div className='odc-hub-switch-row'>
          <div className='odc-hub-switch-text'>
            <p id={`${baseId}-label`} className='odc-hub-label'>{name}</p>
            {hint && <p id={`${baseId}-hint`} className='odc-hub-hint'>{hint}</p>}
          </div>
          <Switch
            label={name}
            aria-labelledby={`${baseId}-label`}
            aria-describedby={hint ? `${baseId}-hint` : undefined}
            checked={model.checked}
            onCheckedChange={next => pick(next ? model.onValue : model.offValue)}
          />
        </div>
      </div>
    )
  }

  if (!list) {
    return (
      <div className='odc-hub-row'>
        <Field label={name} hint={hint} error={t('NO_OPTIONS_VALUE', 'There is no options value')} />
      </div>
    )
  }

  const options = list.map(item => (item.custom ? { value: CUSTOM_KEY, label: item.label } : { value: item.value, label: item.label }))
  return (
    <div className='odc-hub-row' data-layout='inline'>
      <SelectField
        label={name}
        hint={hint}
        value={state.custom ? CUSTOM_KEY : state.value}
        options={options}
        placeholder={t('SELECT_A_OPTION', 'Select a option')}
        onValueChange={value => (value === CUSTOM_KEY ? pick(customItem.value, true) : pick(value))}
      />
      {state.custom && (
        <TextField
          fieldClassName='ssd-custom'
          aria-label={`${name} · ${customItem.label}`}
          placeholder={customItem.label}
          value={state.value ?? ''}
          onChange={value => pick(value, true)}
        />
      )}
    </div>
  )
}

// one config of a site. A credential (type 7, or type 1 with a key of secretConfigKeys.js) is a P/SecretField, hidden by
// default with «Show» and «Ends in …», as in the Settings hub; a public value is a P/TextField. What is saved does not
// change: every edit goes through the same handleChangeConfig(value, siteId, configId) as before.
const SiteConfigControl = ({ config, selectedSiteId, handleChangeConfig }) => {
  const [, t] = useLanguage()
  const change = (value) => handleChangeConfig(value, selectedSiteId, config?.id)

  if (config?.type === 2) return <SiteSelectControl config={config} change={change} />

  if (isSecretConfig(config)) {
    const [endsBefore, endsAfter] = t('SECRET_ENDS_IN', 'Ends in _ending_').split('_ending_')
    return (
      <div className='odc-hub-row'>
        <SecretField
          label={config?.name}
          defaultValue={config?.value ?? ''}
          placeholder={config?.name}
          showLabel={t('SHOW', 'Show')}
          hideLabel={t('HIDE', 'Hide')}
          endingLabel={ending => <>{endsBefore}{ending}{endsAfter}</>}
          onChange={change}
        />
      </div>
    )
  }

  if (config?.type === 1) {
    return (
      <div className='odc-hub-row'>
        {/* uncontrolled, as main: the controller does not write the edit back into config.value */}
        <TextField label={config?.name} defaultValue={config?.value ?? ''} placeholder={config?.name} onChange={change} />
      </div>
    )
  }

  return null
}

const ConfigList = ({ configs, selectedSiteId, handleChangeConfig }) => (
  <div className='ssd-list'>
    {configs.map((config, i) => (
      <SiteConfigControl
        key={config?.id ?? i}
        config={config}
        selectedSiteId={selectedSiteId}
        handleChangeConfig={handleChangeConfig}
      />
    ))}
  </div>
)

export const SiteSettingDetails = (props) => {
  const {
    selectedSiteId,
    siteConfigsState,
    siteGroupConfigsState,
    handleChangeConfig
  } = props

  const [, t] = useLanguage()
  const loading = siteConfigsState.loading || siteGroupConfigsState?.loading

  return (
    <div className='odc-root ssd'>
      <h3 className='ssd-title'>{t('SETTINGS', 'All Settings')}</h3>
      {loading
        ? (
          <div className='ssd-loading' aria-busy='true'>
            <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
            {[...Array(6).keys()].map(i => (
              <div key={i} className='ssd-loading-row'>
                <Skeleton size='40%' />
                <Skeleton block='var(--od-x-control-height-lg)' />
              </div>
            ))}
          </div>
          )
        : siteConfigsState.configs.length > 0 && siteGroupConfigsState?.categories?.length === 0 && (
          <ConfigList configs={siteConfigsState.configs} selectedSiteId={selectedSiteId} handleChangeConfig={handleChangeConfig} />
        )}
      {!siteGroupConfigsState?.loading && siteGroupConfigsState?.categories?.length > 0 && (
        siteGroupConfigsState?.categories.map((category, i) => (
          <section key={i} className='ssd-category'>
            {category && (
              <div className='ssd-category-head'>
                <h4 className='ssd-category-name'>{category.name}</h4>
                {category?.description && <p className='ssd-category-description'>{category.description}</p>}
              </div>
            )}
            {category.configs.length > 0 && (
              <ConfigList configs={category.configs} selectedSiteId={selectedSiteId} handleChangeConfig={handleChangeConfig} />
            )}
          </section>
        ))
      )}
      {!siteConfigsState.loading && siteConfigsState.error && (
        <EmptyState tone='error' icon={TriangleAlert} title={t('NOT_FOUND_CONFIG', 'Sorry, we couldn\'t find the config.')} />
      )}
    </div>
  )
}
