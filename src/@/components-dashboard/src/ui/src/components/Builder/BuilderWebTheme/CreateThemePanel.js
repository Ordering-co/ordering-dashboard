import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import { ExclamationCircle } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { SideBar } from '../../Shared/SideBar'
import { ErrorBanner, Field, FieldHelp, MutedText, PanelContainer, PanelFooter, TypeFieldset, TypeText } from '../styles'
import { PresetGrid, PresetOption, SourceOption } from './styles'

/** Longest name of a theme, on create and rename. */
export const THEME_NAME_MAX_LENGTH = 100

/**
 * A new theme: its name (required) and where it starts: the active theme,
 * from scratch (the schema's defaults) or a preset, which it is copied from.
 */
export const CreateThemePanel = (props) => {
  const { onClose, hasActive, initialSource, presetsState, getPresets, createState, onCreate } = props
  const [, t] = useLanguage()
  const [name, setName] = useState('')
  const [source, setSource] = useState(initialSource || (hasActive ? 'current' : 'blank'))
  const [nameError, setNameError] = useState(null)
  const [formError, setFormError] = useState(null)

  useEffect(() => { getPresets() }, [])

  const presets = presetsState?.presets || []
  const nameTooLong = name.length > THEME_NAME_MAX_LENGTH

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('required')
      return
    }
    if (trimmed.length > THEME_NAME_MAX_LENGTH) {
      setNameError('max')
      return
    }
    setFormError(null)
    const presetId = source.startsWith('preset:') ? Number(source.slice(7)) : null
    const { ok, errorCodes } = await onCreate({ name: trimmed, source: presetId ? 'preset' : source, presetId })
    if (ok) return
    if (errorCodes.includes('name.required')) setNameError('required')
    else if (errorCodes.includes('name.max')) setNameError('max')
    else if (errorCodes.includes('theme.limit')) setFormError('limit')
    else if (errorCodes.includes('preset.not_found')) setFormError('preset')
    else setFormError('error')
  }

  const formErrors = {
    limit: t('BUILDER_THEME_LIMIT', 'You already have 5 themes. Delete one to create another.'),
    preset: t('BUILDER_THEME_PRESET_GONE', 'That preset is no longer available. Choose another option.'),
    error: t('BUILDER_THEME_CREATE_ERROR', 'We couldn’t create the theme. Try again.')
  }

  return (
    <SideBar open sidebarId='builder-theme-create-panel' defaultSideBarWidth={520} moveDistance={0} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate style={{ height: '100%' }}>
        <PanelContainer>
          <h2>{t('BUILDER_THEME_NEW', 'New theme')}</h2>
          {formError && (
            <ErrorBanner role='alert'>
              <ExclamationCircle aria-hidden='true' />
              <span>{formErrors[formError]}</span>
            </ErrorBanner>
          )}

          <Field invalid={!!nameError}>
            <label htmlFor='builder-theme-new-name'>{t('BUILDER_NAME', 'Name')}</label>
            <Input
              id='builder-theme-new-name'
              type='text'
              value={name}
              maxLength={THEME_NAME_MAX_LENGTH}
              autoComplete='off'
              required
              placeholder={t('BUILDER_THEME_NAME_PLACEHOLDER', 'e.g. Summer 2026')}
              aria-invalid={nameError ? 'true' : 'false'}
              aria-describedby='builder-theme-new-name-help'
              onChange={(e) => { setName(e.target.value); setNameError(null) }}
            />
            <FieldHelp id='builder-theme-new-name-help'>
              {nameError === 'required' && <span role='alert'>{t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.')}</span>}
              {nameError === 'max' && <span role='alert'>{t('BUILDER_ERROR_NAME_MAX', 'Use _max_ characters or fewer.').replace('_max_', THEME_NAME_MAX_LENGTH)}</span>}
              {!nameError && <span>{t('BUILDER_APP_NAME_HELP', 'You can change it later.')}</span>}
              <span data-over={nameTooLong ? 'true' : undefined}>{name.length}/{THEME_NAME_MAX_LENGTH}</span>
            </FieldHelp>
          </Field>

          <TypeFieldset>
            <legend>{t('BUILDER_THEME_START_FROM', 'Start from')}</legend>
            {hasActive && (
              <SourceOption selected={source === 'current'}>
                <input type='radio' name='builder-theme-source' value='current' checked={source === 'current'} onChange={() => setSource('current')} />
                <TypeText>
                  <strong>{t('BUILDER_THEME_SOURCE_CURRENT', 'Your current theme')}</strong>
                  <span>{t('BUILDER_THEME_SOURCE_CURRENT_HELP', 'Copies the colors, fonts and rounding your website uses now.')}</span>
                </TypeText>
              </SourceOption>
            )}
            <SourceOption selected={source === 'blank'}>
              <input type='radio' name='builder-theme-source' value='blank' checked={source === 'blank'} onChange={() => setSource('blank')} />
              <TypeText>
                <strong>{t('BUILDER_THEME_SOURCE_BLANK', 'From scratch')}</strong>
                <span>{t('BUILDER_THEME_SOURCE_BLANK_HELP', 'The standard look of this kind of website.')}</span>
              </TypeText>
            </SourceOption>
          </TypeFieldset>

          <TypeFieldset>
            <legend>{t('BUILDER_THEME_OR_PRESET', 'Or a preset')}</legend>
            <MutedText small>{t('BUILDER_THEME_PRESET_HELP', 'A ready-made style. It’s copied into your theme, so you can change anything.')}</MutedText>
            {presetsState?.loading && <Skeleton height={140} />}
            {!presetsState?.loading && presetsState?.error && (
              <MutedText small role='alert'>{t('BUILDER_THEME_PRESETS_ERROR', 'We couldn’t load the presets.')}</MutedText>
            )}
            {!presetsState?.loading && !presetsState?.error && !presets.length && (
              <MutedText small>{t('BUILDER_THEME_NO_PRESETS', 'There are no presets for this kind of website yet.')}</MutedText>
            )}
            {presets.length > 0 && (
              <PresetGrid>
                {presets.map(preset => {
                  const value = `preset:${preset.id}`
                  return (
                    <PresetOption key={preset.id} selected={source === value}>
                      {preset.preview ? <img src={preset.preview} alt='' /> : <span aria-hidden='true' />}
                      <span>
                        <input type='radio' name='builder-theme-source' value={value} checked={source === value} onChange={() => setSource(value)} />
                        <TypeText>
                          <strong>{preset.name}</strong>
                          <span>{t('BUILDER_THEME_VERSION', 'Version _version_').replace('_version_', preset.version)}</span>
                        </TypeText>
                      </span>
                    </PresetOption>
                  )
                })}
              </PresetGrid>
            )}
          </TypeFieldset>

          <PanelFooter>
            <div>
              <Button type='button' color='secundary' borderRadius='8px' onClick={onClose}>{t('CANCEL', 'Cancel')}</Button>
              <Button type='submit' color='primary' borderRadius='8px' disabled={!!createState?.loading}>
                {createState?.loading ? t('BUILDER_CREATING', 'Creating…') : t('BUILDER_THEME_CREATE_AND_EDIT', 'Create and edit')}
              </Button>
            </div>
          </PanelFooter>
        </PanelContainer>
      </form>
    </SideBar>
  )
}
