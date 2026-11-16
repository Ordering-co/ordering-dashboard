import React, { useState } from 'react'

import {
  BuilderProductThemes as BuilderProductThemesController,
  ToastType,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { CircleAlert, Info, Plus, Trash2 } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, IconButton, InlineNotice, Skeleton, StatusBadge } from '../../Shared/Product'
import { byKind, getProductKind } from '../utils'
import { CreateThemePanel } from './CreateThemePanel'
import './builder-themes.css'

// redesign B3a: the Theme tab's list on Product pieces: P/Skeleton, P/EmptyState (load error), P/Button, P/IconButton
// (Delete, named), P/StatusBadge (Active done, Unpublished pending; «Converted from» a neutral token badge, .odc-bt-converted:
// it says how the theme is stored, not a state that asks for anything), P/InlineNotice and P/ConfirmDialog. Same controller,
// texts, toasts and conditions as main.

/** Most themes a product keeps. */
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
    onEditTheme,
    product
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ parseDate }] = useUtils()
  const [createSource, setCreateSource] = useState(null)
  // `open` goes false on close while the theme stays, so the dialog keeps its title while it fades out
  const [confirm, setConfirm] = useState(null)
  const closeConfirm = () => setConfirm(current => current && { ...current, open: false })

  // A website's or an app's: what the texts say of it
  const kind = getProductKind(product)
  const themes = themesState.themes || []
  const atLimit = themes.length >= THEMES_MAX
  const activeTheme = themes.find(theme => theme.active)
  // A copy of the active theme: a previous-version one converts only for a website (an app's schema has no
  // map from the previous version, and the API answers `theme.no_schema`)
  const canCopyActive = !!activeTheme && (activeTheme.version !== 1 || kind === 'web')
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
    // a confirmation acts once: it stays mounted while it fades out (review of B3a)
    if (!confirm?.open) return
    closeConfirm()
    const { ok } = await activateTheme(theme.id)
    showToast(ok ? ToastType.Success : ToastType.Error, ok
      ? byKind(kind, t('BUILDER_THEME_ACTIVATED', '_name_ is active. Your website shows it within 5 minutes.'), t('BUILDER_APP_THEME_ACTIVATED', '_name_ is active. Your customers see it the next time they open the app.')).replace('_name_', themeName(theme))
      : t('BUILDER_THEME_ACTIVATE_ERROR', 'We couldn’t activate it. Try again.'))
  }

  const handleDelete = async (theme) => {
    // a confirmation acts once: it stays mounted while it fades out (review of B3a)
    if (!confirm?.open) return
    closeConfirm()
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
      <div className='odc-bt-busy' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        {/* main's 64, 80 and 80px */}
        <Skeleton shape='box' block='var(--od-space-8)' />
        <Skeleton shape='box' block='calc(var(--od-space-8) + var(--od-space-4))' />
        <Skeleton shape='box' block='calc(var(--od-space-8) + var(--od-space-4))' />
      </div>
    )
  }

  if (themesState.error) {
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_THEMES_LOAD_ERROR', 'We couldn’t load the themes')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={() => reloadThemes()}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
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
      <div key={theme.id} className='odc-bt-row'>
        <div className='odc-bt-row-text'>
          <div className='odc-bt-row-name'>
            <strong>{name}</strong>
            {theme.active && <StatusBadge family='done' label={t('BUILDER_THEME_ACTIVE', 'Active')} />}
            {theme.has_draft && <StatusBadge family='pending' label={t('BUILDER_THEME_UNPUBLISHED', 'Unpublished changes')} />}
            {/* Saved with another version of the website: the editor shows it converted until it saves */}
            {theme.upgraded_from && (
              <span className='odc-bt-converted'>{t('BUILDER_THEME_CONVERTED_FROM', 'Converted from _version_').replace('_version_', theme.upgraded_from)}</span>
            )}
          </div>
          {meta && <span className='odc-bt-row-meta'>{meta}</span>}
        </div>
        <div className='odc-bt-row-actions'>
          {isV1 && theme.active && canCopyActive && (
            <Button disabled={busy || atLimit} onClick={() => setCreateSource('current')}>
              {t('BUILDER_THEME_CREATE_FROM_CURRENT', 'Create a new theme from this one')}
            </Button>
          )}
          {!isV1 && (
            <Button aria-label={`${t('BUILDER_THEME_EDIT', 'Edit')}: ${name}`} onClick={() => onEditTheme(theme.id)}>
              {t('BUILDER_THEME_EDIT', 'Edit')}
            </Button>
          )}
          {!theme.active && (
            <Button disabled={busy} aria-label={`${t('BUILDER_ACTIVATE', 'Activate')}: ${name}`} onClick={() => setConfirm({ type: 'activate', theme, open: true })}>
              {rowBusy && themeAction.type === 'activate' ? t('BUILDER_THEME_ACTIVATING', 'Activating…') : t('BUILDER_ACTIVATE', 'Activate')}
            </Button>
          )}
          {!theme.active && (
            <IconButton
              icon={Trash2}
              variant='secondary'
              disabled={busy}
              label={t('BUILDER_THEME_DELETE_NAMED', 'Delete _name_').replace('_name_', name)}
              title={t('BUILDER_THEME_DELETE', 'Delete')}
              onClick={() => setConfirm({ type: 'delete', theme, open: true })}
            />
          )}
        </div>
      </div>
    )
  }

  const confirmName = confirm ? themeName(confirm.theme) : ''

  return (
    <>
      <section className='odc-bt-card' aria-labelledby='builder-saved-themes'>
        <header className='odc-bt-card-head'>
          <div>
            <h2 id='builder-saved-themes'>{t('BUILDER_THEMES_SAVED', 'Saved themes')}</h2>
            <span className='odc-bt-count'>{t('BUILDER_THEMES_COUNT', '_count_ of _max_').replace('_count_', themes.length).replace('_max_', THEMES_MAX)}</span>
          </div>
          <div className='odc-bt-card-create'>
            <Button
              variant='primary'
              icon={Plus}
              disabled={atLimit || busy}
              aria-describedby={atLimit ? 'builder-themes-limit' : undefined}
              onClick={() => setCreateSource(canCopyActive ? 'current' : 'blank')}
            >
              {t('BUILDER_THEME_NEW', 'New theme')}
            </Button>
            {atLimit && <span id='builder-themes-limit' className='odc-bt-limit'>{t('BUILDER_THEME_LIMIT', 'You already have 5 themes. Delete one to create another.')}</span>}
          </div>
        </header>
        {themes.length
          ? themes.map(renderTheme)
          : <p className='odc-bt-empty'>{byKind(kind, t('BUILDER_THEMES_EMPTY', 'This website has no saved themes yet. Create one to change how it looks.'), t('BUILDER_APP_THEMES_EMPTY', 'This app has no saved themes yet. Create one to change how it looks.'))}</p>}
      </section>

      <InlineNotice tone='info' icon={Info} live={false} className='odc-bt-notice'>
        <strong>{byKind(kind, t('BUILDER_THEME_NOTICE_TITLE', 'Activating a theme changes your website for everyone'), t('BUILDER_APP_THEME_NOTICE_TITLE', 'Activating a theme changes your app for everyone'))}</strong>
        {byKind(kind, t('BUILDER_THEME_NOTICE', 'Customers see it within 5 minutes. Unpublished changes stay in the editor until you publish them.'), t('BUILDER_APP_THEME_NOTICE', 'Customers see it the next time they open the app. Unpublished changes stay in the editor until you publish them.'))}
      </InlineNotice>

      {createSource && (
        <CreateThemePanel
          kind={kind}
          hasActive={canCopyActive}
          initialSource={createSource}
          presetsState={presetsState}
          getPresets={getPresets}
          createState={{ loading: themeAction?.type === 'create' }}
          onCreate={handleCreate}
          onClose={() => setCreateSource(null)}
        />
      )}

      <ConfirmDialog
        open={!!confirm?.open && confirm.type === 'activate'}
        tone='primary'
        title={confirm?.type === 'activate' ? t('BUILDER_THEME_ACTIVATE_TITLE', 'Activate _name_?').replace('_name_', confirmName) : ''}
        confirmLabel={t('BUILDER_ACTIVATE', 'Activate')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => handleActivate(confirm.theme)}
        onCancel={closeConfirm}
      >
        <p>
          {confirm?.theme?.has_draft
            ? byKind(kind, t('BUILDER_THEME_ACTIVATE_DRAFT_HELP', 'Your customers see what you published of it within 5 minutes. Its unpublished changes stay in the editor.'), t('BUILDER_APP_THEME_ACTIVATE_DRAFT_HELP', 'Your customers see what you published of it the next time they open the app. Its unpublished changes stay in the editor.'))
            : byKind(kind, t('BUILDER_THEME_ACTIVATE_HELP', 'Your customers see it within 5 minutes, instead of the current theme.'), t('BUILDER_APP_THEME_ACTIVATE_HELP', 'Your customers see it the next time they open the app, instead of the current theme.'))}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!confirm?.open && confirm.type === 'delete'}
        title={confirm?.type === 'delete' ? t('BUILDER_THEME_DELETE_TITLE', 'Delete _name_?').replace('_name_', confirmName) : ''}
        confirmLabel={t('BUILDER_THEME_DELETE', 'Delete')}
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        onConfirm={() => handleDelete(confirm.theme)}
        onCancel={closeConfirm}
      >
        <p>{t('BUILDER_THEME_DELETE_HELP', 'You can’t undo this.')}</p>
      </ConfirmDialog>
    </>
  )
}

/** The Theme tab of a Builder product with themes (a website, or an app like the Marketplace App): its saved themes. */
export const BuilderWebThemes = (props) => (
  <BuilderProductThemesController {...props} productId={props.product.id} UIComponent={BuilderWebThemesUI} />
)

export { BuilderThemeEditorView } from './ThemeEditor'
