import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, InfoCircle, Plus, Trash } from 'react-bootstrap-icons'

import {
  BuilderProductThemes as BuilderProductThemesController,
  ToastType,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import { BuilderMessage } from '../BuilderShared'
import { MutedText } from '../styles'
import { CreateThemePanel } from './CreateThemePanel'
import { IconAction, NoticeBox, StatusPill, ThemeActions, ThemeRow, ThemesCard, ThemesCount, ThemeText } from './styles'

/** Most themes a website keeps. */
const THEMES_MAX = 5

const BuilderWebThemesUI = (props) => {
  const {
    themesState,
    presetsState,
    themeAction,
    reloadThemes,
    getPresets,
    createTheme,
    activateTheme,
    deleteTheme,
    onEditTheme
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ parseDate }] = useUtils()
  const [createSource, setCreateSource] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const themes = themesState.themes || []
  const atLimit = themes.length >= THEMES_MAX
  const hasActive = themes.some(theme => theme.active)
  const busy = !!themeAction
  const formatDate = (value) => value ? parseDate(value, { outputFormat: 'MMM D, YYYY' }) : ''
  const themeName = (theme) => theme.version === 1 ? t('BUILDER_THEME_V1_NAME', 'Current theme (previous version)') : theme.name

  const handleCreate = async (fields) => {
    const answer = await createTheme(fields)
    if (answer.ok) {
      setCreateSource(null)
      showToast(ToastType.Success, t('BUILDER_THEME_CREATED', '_name_ was created').replace('_name_', fields.name))
      if (answer.theme?.id) onEditTheme(answer.theme.id)
    }
    return answer
  }

  const handleActivate = async (theme) => {
    setConfirm(null)
    const { ok } = await activateTheme(theme.id)
    showToast(ok ? ToastType.Success : ToastType.Error, ok
      ? t('BUILDER_THEME_ACTIVATED', '_name_ is active. Your website shows it within 5 minutes.').replace('_name_', themeName(theme))
      : t('BUILDER_THEME_ACTIVATE_ERROR', 'We couldn’t activate it. Try again.'))
  }

  const handleDelete = async (theme) => {
    setConfirm(null)
    const { ok, errorCodes } = await deleteTheme(theme.id)
    if (ok) {
      showToast(ToastType.Success, t('BUILDER_THEME_DELETED', '_name_ was deleted').replace('_name_', themeName(theme)))
      return
    }
    showToast(ToastType.Error, errorCodes.includes('theme.active')
      ? t('BUILDER_THEME_DELETE_ACTIVE', 'Activate another theme before deleting this one.')
      : t('BUILDER_THEME_DELETE_ERROR', 'We couldn’t delete it. Try again.'))
  }

  if (themesState.loading && !themes.length) {
    return (
      <div aria-busy='true'>
        <Skeleton height={64} />
        <Skeleton height={80} count={2} style={{ marginTop: 12 }} />
      </div>
    )
  }

  if (themesState.error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_THEMES_LOAD_ERROR', 'We couldn’t load the themes')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={() => reloadThemes()}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }

  const renderTheme = (theme) => {
    const name = themeName(theme)
    const isV1 = theme.version === 1
    const meta = isV1
      ? t('BUILDER_THEME_V1_HELP', 'Made with the previous editor. Create a new theme from it to use the new editor; this one stays active until you activate another.')
      : [
          theme.preset && t('BUILDER_THEME_BASED_ON', 'Based on _name_ v_version_').replace('_name_', theme.preset.name || '').replace('_version_', theme.preset.version),
          theme.updated_at && t('BUILDER_THEME_UPDATED_ON', 'Updated _date_').replace('_date_', formatDate(theme.updated_at))
        ].filter(Boolean).join(' · ')
    const rowBusy = busy && themeAction?.themeId === theme.id
    return (
      <ThemeRow key={theme.id}>
        <ThemeText>
          <div>
            <strong>{name}</strong>
            {theme.active && <StatusPill tone='active'>{t('BUILDER_THEME_ACTIVE', 'Active')}</StatusPill>}
            {theme.has_draft && <StatusPill tone='draft'>{t('BUILDER_THEME_UNPUBLISHED', 'Unpublished changes')}</StatusPill>}
            {/* Saved with another version of the website: the editor shows it converted until it saves */}
            {theme.upgraded_from && <StatusPill tone='inactive'>{t('BUILDER_THEME_CONVERTED_FROM', 'Converted from _version_').replace('_version_', theme.upgraded_from)}</StatusPill>}
          </div>
          {meta && <span>{meta}</span>}
        </ThemeText>
        <ThemeActions>
          {isV1 && theme.active && (
            <Button type='button' color='primary' outline borderRadius='8px' disabled={busy || atLimit} onClick={() => setCreateSource('current')}>
              {t('BUILDER_THEME_CREATE_FROM_CURRENT', 'Create a new theme from this one')}
            </Button>
          )}
          {!isV1 && (
            <Button type='button' color='primary' outline borderRadius='8px' aria-label={`${t('BUILDER_THEME_EDIT', 'Edit')}: ${name}`} onClick={() => onEditTheme(theme.id)}>
              {t('BUILDER_THEME_EDIT', 'Edit')}
            </Button>
          )}
          {!theme.active && (
            <Button type='button' color='primary' outline borderRadius='8px' disabled={busy} aria-label={`${t('BUILDER_ACTIVATE', 'Activate')}: ${name}`} onClick={() => setConfirm({ type: 'activate', theme })}>
              {rowBusy && themeAction.type === 'activate' ? t('BUILDER_THEME_ACTIVATING', 'Activating…') : t('BUILDER_ACTIVATE', 'Activate')}
            </Button>
          )}
          {!theme.active && (
            <IconAction
              type='button'
              disabled={busy}
              aria-label={t('BUILDER_THEME_DELETE_NAMED', 'Delete _name_').replace('_name_', name)}
              title={t('BUILDER_THEME_DELETE', 'Delete')}
              onClick={() => setConfirm({ type: 'delete', theme })}
            >
              <Trash aria-hidden='true' />
            </IconAction>
          )}
        </ThemeActions>
      </ThemeRow>
    )
  }

  return (
    <>
      <ThemesCard aria-labelledby='builder-saved-themes'>
        <header>
          <div>
            <h2 id='builder-saved-themes' style={{ display: 'inline' }}>{t('BUILDER_THEMES_SAVED', 'Saved themes')}</h2>
            <ThemesCount>{t('BUILDER_THEMES_COUNT', '_count_ of _max_').replace('_count_', themes.length).replace('_max_', THEMES_MAX)}</ThemesCount>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Button type='button' color='primary' borderRadius='8px' disabled={atLimit || busy} aria-describedby={atLimit ? 'builder-themes-limit' : undefined} onClick={() => setCreateSource(hasActive ? 'current' : 'blank')}>
              <Plus aria-hidden='true' /> {t('BUILDER_THEME_NEW', 'New theme')}
            </Button>
            {atLimit && <MutedText small id='builder-themes-limit'>{t('BUILDER_THEME_LIMIT', 'You already have 5 themes. Delete one to create another.')}</MutedText>}
          </div>
        </header>
        {themes.length
          ? themes.map(renderTheme)
          : <p style={{ margin: 0, padding: '0 24px 20px', color: '#5E6B7D' }}>{t('BUILDER_THEMES_EMPTY', 'This website has no saved themes yet. Create one to change how it looks.')}</p>}
      </ThemesCard>

      <NoticeBox>
        <InfoCircle aria-hidden='true' />
        <div>
          <strong>{t('BUILDER_THEME_NOTICE_TITLE', 'Activating a theme changes your website for everyone')}</strong>
          {t('BUILDER_THEME_NOTICE', 'Customers see it within 5 minutes. Unpublished changes stay in the editor until you publish them.')}
        </div>
      </NoticeBox>

      {createSource && (
        <CreateThemePanel
          hasActive={hasActive}
          initialSource={createSource}
          presetsState={presetsState}
          getPresets={getPresets}
          createState={{ loading: themeAction?.type === 'create' }}
          onCreate={handleCreate}
          onClose={() => setCreateSource(null)}
        />
      )}

      <Confirm
        open={confirm?.type === 'activate'}
        width='min(440px, calc(100vw - 72px))'
        title={confirm?.type === 'activate' ? t('BUILDER_THEME_ACTIVATE_TITLE', 'Activate _name_?').replace('_name_', themeName(confirm.theme)) : ''}
        acceptText={t('BUILDER_ACTIVATE', 'Activate')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={() => handleActivate(confirm.theme)}
        onCancel={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      >
        <p>
          {confirm?.theme?.has_draft
            ? t('BUILDER_THEME_ACTIVATE_DRAFT_HELP', 'Your customers see what you published of it within 5 minutes. Its unpublished changes stay in the editor.')
            : t('BUILDER_THEME_ACTIVATE_HELP', 'Your customers see it within 5 minutes, instead of the current theme.')}
        </p>
      </Confirm>

      <Confirm
        open={confirm?.type === 'delete'}
        width='min(440px, calc(100vw - 72px))'
        title={confirm?.type === 'delete' ? t('BUILDER_THEME_DELETE_TITLE', 'Delete _name_?').replace('_name_', themeName(confirm.theme)) : ''}
        acceptText={t('BUILDER_THEME_DELETE', 'Delete')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={() => handleDelete(confirm.theme)}
        onCancel={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      >
        <p>{t('BUILDER_THEME_DELETE_HELP', 'You can’t undo this.')}</p>
      </Confirm>
    </>
  )
}

/** The Theme tab of a Builder website: its saved themes. */
export const BuilderWebThemes = (props) => (
  <BuilderProductThemesController {...props} productId={props.product.id} UIComponent={BuilderWebThemesUI} />
)

export { BuilderThemeEditorView } from './ThemeEditor'
