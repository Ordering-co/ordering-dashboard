import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { CircleAlert } from '../../Shared/Icon'
import { Button, ConfirmDialog, InlineNotice, RadioGroup, Sheet, Skeleton, TextField } from '../../Shared/Product'
import { byKind } from '../utils'
import './builder-themes.css'

// redesign B3a: the create panel on P/Sheet, P/TextField and two P/RadioGroup (the sources, and the presets as cards
// with their preview as `media`): one choice across both, as main's radios that shared a name. Same fields, checks, codes and
// texts as main. main's SideBar never closed on an outside click (Escape only from 1000px), so a typed name was never lost by
// accident: Escape, the scrim, the X and Cancel ask before dropping one, and nothing closes while it creates (BuilderCreatePanel).

/** Longest name of a theme, on create and rename. */
export const THEME_NAME_MAX_LENGTH = 100

const FORM_ID = 'builder-theme-create-form'

/**
 * A new theme: its name (required) and where it starts: the active theme,
 * from scratch (the schema's defaults) or a preset, which it is copied from.
 * `hasActive`: the active theme can be copied. `kind` (`web` or `app`): what
 * the texts say of the product.
 */
export const CreateThemePanel = (props) => {
  const { onClose, kind = 'web', hasActive, initialSource, presetsState, getPresets, createState, onCreate } = props
  const [, t] = useLanguage()
  const [name, setName] = useState('')
  const [source, setSource] = useState(initialSource || (hasActive ? 'current' : 'blank'))
  const [nameError, setNameError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [discard, setDiscard] = useState(false)

  useEffect(() => { getPresets() }, [])

  const presets = presetsState?.presets || []
  const nameTooLong = name.length > THEME_NAME_MAX_LENGTH

  // P/Button `busy` ignores clicks, unlike main's disabled button it can't stop every submit (Enter): one create at a time
  const creating = useRef(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (creating.current || createState?.loading) return
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
    creating.current = true
    let answer
    try {
      answer = await onCreate({ name: trimmed, source: presetId ? 'preset' : source, presetId })
    } finally {
      creating.current = false
    }
    const { ok, errorCodes } = answer
    if (ok) return
    if (errorCodes.includes('name.required')) setNameError('required')
    else if (errorCodes.includes('name.max')) setNameError('max')
    else if (errorCodes.includes('theme.limit')) setFormError('limit')
    else if (errorCodes.includes('preset.not_found')) setFormError('preset')
    // The active theme couldn't be copied (one of the previous version, with no way to convert it)
    else if (errorCodes.includes('theme.no_schema') && source === 'current') setFormError('current')
    else setFormError('error')
  }

  const requestClose = () => {
    if (createState?.loading || creating.current) return
    if (name.trim() !== '') setDiscard(true)
    else onClose()
  }

  const formErrors = {
    limit: t('BUILDER_THEME_LIMIT', 'You already have 5 themes. Delete one to create another.'),
    preset: t('BUILDER_THEME_PRESET_GONE', 'That preset is no longer available. Choose another option.'),
    current: t('BUILDER_THEME_CURRENT_UNAVAILABLE', 'Your current theme can’t be copied. Start from scratch or from a preset.'),
    error: t('BUILDER_THEME_CREATE_ERROR', 'We couldn’t create the theme. Try again.')
  }

  const nameHelp = nameError === 'required'
    ? t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.')
    : nameError === 'max' ? t('BUILDER_ERROR_NAME_MAX', 'Use _max_ characters or fewer.').replace('_max_', THEME_NAME_MAX_LENGTH) : null

  const startOptions = [
    hasActive && {
      value: 'current',
      label: t('BUILDER_THEME_SOURCE_CURRENT', 'Your current theme'),
      description: byKind(kind, t('BUILDER_THEME_SOURCE_CURRENT_HELP', 'Copies the colors, fonts and rounding your website uses now.'), t('BUILDER_APP_THEME_SOURCE_CURRENT_HELP', 'Copies the colors, fonts and rounding your app uses now.'))
    },
    {
      value: 'blank',
      label: t('BUILDER_THEME_SOURCE_BLANK', 'From scratch'),
      description: byKind(kind, t('BUILDER_THEME_SOURCE_BLANK_HELP', 'The standard look of this kind of website.'), t('BUILDER_APP_THEME_SOURCE_BLANK_HELP', 'The standard look of this kind of app.'))
    }
  ].filter(Boolean)

  const presetOptions = presets.map(preset => ({
    value: `preset:${preset.id}`,
    media: preset.preview ? <img className='odc-bt-preview' src={preset.preview} alt='' /> : <span className='odc-bt-preview' />,
    label: preset.name,
    description: t('BUILDER_THEME_VERSION', 'Version _version_').replace('_version_', preset.version)
  }))

  const footer = (
    <>
      <Button disabled={!!createState?.loading} onClick={requestClose}>{t('CANCEL', 'Cancel')}</Button>
      <Button type='submit' form={FORM_ID} variant='primary' busy={!!createState?.loading}>
        {createState?.loading ? t('BUILDER_CREATING', 'Creating…') : t('BUILDER_THEME_CREATE_AND_EDIT', 'Create and edit')}
      </Button>
    </>
  )

  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => { if (!open) requestClose() }}
        title={t('BUILDER_THEME_NEW', 'New theme')}
        closeLabel={t('CLOSE', 'Close')}
        footer={footer}
      >
        <form id={FORM_ID} className='odc-bt-create' onSubmit={handleSubmit} noValidate>
          {formError && (
            <InlineNotice tone='danger' icon={CircleAlert} role='alert'>{formErrors[formError]}</InlineNotice>
          )}

          <TextField
            id='builder-theme-new-name'
            label={t('BUILDER_NAME', 'Name')}
            value={name}
            maxLength={THEME_NAME_MAX_LENGTH}
            autoComplete='off'
            required
            requiredLabel={t('REQUIRED', 'Required')}
            placeholder={t('BUILDER_THEME_NAME_PLACEHOLDER', 'e.g. Summer 2026')}
            error={nameHelp || undefined}
            hint={nameHelp ? undefined : t('BUILDER_APP_NAME_HELP', 'You can change it later.')}
            // the counter is read with the field, as main's help block
            aria-describedby='builder-theme-new-name-count'
            onChange={(value) => { setName(value); setNameError(null) }}
          />
          <span id='builder-theme-new-name-count' className='odc-bt-name-count odc-figure' data-over={nameTooLong ? 'true' : undefined}>
            {name.length}/{THEME_NAME_MAX_LENGTH}
          </span>

          <RadioGroup
            label={t('BUILDER_THEME_START_FROM', 'Start from')}
            variant='cards'
            value={source}
            onValueChange={setSource}
            options={startOptions}
          />

          {/* As main's fieldset: the title and its help above the states and the presets */}
          <div className='odc-bt-presets'>
            <p className='odc-bt-legend'>{t('BUILDER_THEME_OR_PRESET', 'Or a preset')}</p>
            <p id='builder-theme-preset-help' className='odc-bt-help'>{t('BUILDER_THEME_PRESET_HELP', 'A ready-made style. It’s copied into your theme, so you can change anything.')}</p>
            {presetsState?.loading && <Skeleton shape='box' block='calc(var(--od-space-10) + var(--od-space-3))' />}
            {!presetsState?.loading && presetsState?.error && (
              <p className='odc-bt-help' role='alert'>{t('BUILDER_THEME_PRESETS_ERROR', 'We couldn’t load the presets.')}</p>
            )}
            {!presetsState?.loading && !presetsState?.error && !presets.length && (
              <p className='odc-bt-help'>{byKind(kind, t('BUILDER_THEME_NO_PRESETS', 'There are no presets for this kind of website yet.'), t('BUILDER_APP_THEME_NO_PRESETS', 'There are no presets for this kind of app yet.'))}</p>
            )}
            {presets.length > 0 && (
              <RadioGroup
                label={t('BUILDER_THEME_OR_PRESET', 'Or a preset')}
                hideLabel
                variant='cards'
                value={source}
                onValueChange={setSource}
                options={presetOptions}
                aria-describedby='builder-theme-preset-help'
              />
            )}
          </div>
        </form>
      </Sheet>
      <ConfirmDialog
        open={discard}
        title={t('ORDER_PANEL_DISCARD_TITLE', 'Discard your changes?')}
        confirmLabel={t('DISCARD', 'Discard')}
        cancelLabel={t('KEEP_EDITING', 'Keep editing')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => {
          setDiscard(false)
          onClose()
        }}
        onCancel={() => setDiscard(false)}
      >
        {t('DRIVERS_DISCARD_BODY', 'What you changed here is not saved yet.')}
      </ConfirmDialog>
    </>
  )
}
