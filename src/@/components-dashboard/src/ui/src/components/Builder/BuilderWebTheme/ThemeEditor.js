import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Dropdown } from 'react-bootstrap'
import { ExclamationCircle, PencilSquare, Palette } from 'react-bootstrap-icons'
import { useTheme } from 'styled-components'

import {
  BuilderThemeEditor as BuilderThemeEditorController,
  ToastType,
  useLanguage,
  useToast,
  useUtils
} from '../../../../../index'
import { Button, Input } from '../../../styles'
import { addQueryToUrl, removeQueryToUrl } from '../../../utils'
import { Confirm } from '../../Shared'
import { BuilderMessage } from '../BuilderShared'
import { FieldHelp, RenameButton, RenameForm } from '../styles'
import { ThemeSchemaEditor, showsPath } from '../ThemeSchemaEditor'
import { PathList } from '../ThemeSchemaEditor/PathList'
import { componentGroupsOf, isClamped, isPlacedElsewhere, pageGroupsOf, storedErrorsOf } from '../ThemeSchemaEditor/schemaNodes'
import { EditorHeader, EditorScroll, EditorShell, NoticeRow, SaveBar, StatusPill } from './styles'
import { THEME_NAME_MAX_LENGTH } from './CreateThemePanel'

/**
 * What "Reset to preset" sends for the section open: its `reset`, a
 * component's or a page's with `{component}` and `{page}` filled in, once per
 * platform for `{platform}`. A page's or a component's also takes back the
 * groups of other sections it shows (their `pages`, `components`), on all
 * screens and on each platform. A section whose groups pages or components
 * show resets only the rest: a whole root it names (`visibility`,
 * `platforms.<p>.visibility`) is the paths of those groups.
 */
export const getResetSections = (schema, location) => {
  const section = (schema?.editor?.sections || []).find(item => item.key === location?.section)
  const [, name] = String(location?.item || '').split('.')
  const platforms = Array.isArray(schema?.platforms) ? schema.platforms : []
  const groups = section?.groups || []
  const moved = groups.some(group => isPlacedElsewhere(schema, group))
  const own = groups.filter(group => !isPlacedElsewhere(schema, group)).flatMap(group => group.paths || [])
  const narrow = (path) => {
    const root = path.replace(/^platforms\.[^.]+\./, '')
    if (!moved || root.includes('.') || !own.some(item => item.startsWith(`${root}.`))) return [path]
    const prefix = path.slice(0, path.length - root.length)
    return own.filter(item => item.startsWith(`${root}.`)).map(item => `${prefix}${item}`)
  }
  const reset = (section?.reset || []).flatMap(template => {
    if (/\{(component|page)\}/.test(template) && !name) return []
    const filled = template.replace('{component}', name).replace('{page}', name)
    return filled.includes('{platform}') ? platforms.map(platform => filled.replace('{platform}', platform)) : [filled]
  }).flatMap(narrow)
  const kind = ['page', 'component'].find(item => (section?.reset || []).some(template => template.includes(`{${item}}`)))
  if (!name || !kind) return reset
  const shown = (kind === 'page' ? pageGroupsOf(schema, name) : componentGroupsOf(schema, name)).flatMap(group => group.paths || [])
  return [...reset, ...shown, ...platforms.flatMap(platform => shown.map(path => `platforms.${platform}.${path}`))]
}

/**
 * What the URL has open (`?section=`, and in a list section `&item=` with the
 * component or page, as `components.button`), so it can be shared and opened
 * again. An unknown section or item opens the first (ThemeSchemaEditor's
 * `start`); leaving the editor takes them out (BuilderProductDetail).
 */
const readEditorLocation = () => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return { section: params.get('section'), item: params.get('item') }
}

/** The address of a section of the editor, or of a component or page in it: this page's, with them. */
export const getEditorHref = ({ section, item }) => {
  const params = new URLSearchParams(window.location.search)
  params.set('section', section)
  if (item) params.set('item', item)
  else params.delete('item')
  return `${window.location.pathname}?${params}`
}

/**
 * What the editor says of the theme above it: that it was saved with another
 * version of the website, earlier or later, and is shown converted (`upgraded_from`),
 * with what converting it lost (`upgrade_dropped`); what it saved that this
 * version no longer takes (`invalid`, dropped when it saves; the rows the
 * editor shows are marked, the rest listed); and what a save refused where
 * the editor shows nothing (`fieldErrors`).
 */
export const ThemeNotices = ({ t, schema, theme, edits, fieldErrors }) => {
  const dropped = Array.isArray(theme?.upgrade_dropped) ? theme.upgrade_dropped : []
  const invalid = Object.entries(storedErrorsOf(theme?.invalid, edits)).map(([path, code]) => ({ path, code }))
  // A number out of its range reads at the closest limit; anything else is dropped
  const clamped = invalid.filter(item => isClamped(item.code)).length
  const invalidDropped = invalid.length - clamped
  const invalidHidden = invalid.filter(item => !showsPath(schema, item.path))
  const refusedHidden = Object.entries(fieldErrors || {}).map(([path, code]) => ({ path, code })).filter(item => !showsPath(schema, item.path))
  const notice = { flex: '1 1 260px', minWidth: 0 }
  return (
    <>
      {theme?.upgraded_from && (
        <NoticeRow role='status' style={{ marginBottom: 16 }}>
          <div style={notice}>
            <p style={{ margin: 0 }}>
              {t('BUILDER_THEME_UPGRADED', 'This theme was saved with version _from_ of the website and you see it converted to version _to_. It’s saved converted the next time you save the draft, publish or reset it.')
                .replace('_from_', theme.upgraded_from)
                .replace('_to_', theme.schema_version || '')}
            </p>
            {dropped.length > 0 && (
              <>
                <p style={{ margin: '8px 0 0' }}>{t('BUILDER_THEME_UPGRADE_DROPPED', 'Converting it dropped these values, which take their default:')}</p>
                <PathList t={t} schema={schema} items={dropped.map(path => ({ path }))} />
              </>
            )}
          </div>
        </NoticeRow>
      )}
      {invalid.length > 0 && (
        <NoticeRow role='status' style={{ marginBottom: 16 }}>
          <div style={notice}>
            {invalidDropped > 0 && (
              <p style={{ margin: 0 }}>
                {invalidDropped === 1
                  ? t('BUILDER_THEME_ONE_INVALID', '1 saved value isn’t valid in this version of the website: it’s dropped when you save. The editor marks it where it shows it.')
                  : t('BUILDER_THEME_N_INVALID', '_count_ saved values aren’t valid in this version of the website: they’re dropped when you save. The editor marks them where it shows them.').replace('_count_', invalidDropped)}
              </p>
            )}
            {clamped > 0 && (
              <p style={{ margin: invalidDropped ? '8px 0 0' : 0 }}>
                {clamped === 1
                  ? t('BUILDER_THEME_ONE_CLAMPED', '1 saved value is outside the range this version of the website takes: it was set to the closest limit, and it’s saved like that when you save. The editor marks it where it shows it.')
                  : t('BUILDER_THEME_N_CLAMPED', '_count_ saved values are outside the range this version of the website takes: they were set to the closest limit, and they’re saved like that when you save. The editor marks them where it shows them.').replace('_count_', clamped)}
              </p>
            )}
            {invalidHidden.length > 0 && (
              <>
                <p style={{ margin: '8px 0 0' }}>{t('BUILDER_THEME_NOT_IN_EDITOR', 'These aren’t in the editor:')}</p>
                <PathList t={t} schema={schema} items={invalidHidden} />
              </>
            )}
          </div>
        </NoticeRow>
      )}
      {refusedHidden.length > 0 && (
        <NoticeRow role='alert' style={{ marginBottom: 16, color: '#B0213D' }}>
          <div style={notice}>
            <p style={{ margin: 0 }}>{t('BUILDER_THEME_REFUSED_HIDDEN', 'The website didn’t take these values, which aren’t in the editor:')}</p>
            <PathList t={t} schema={schema} items={refusedHidden} />
          </div>
        </NoticeRow>
      )}
    </>
  )
}

/** Whether the schema is in nodes (THEMES_V2_SCHEMA_FORMAT), what this editor reads. */
const isNodeSchema = (schema) => Array.isArray(schema?.editor?.sections)

const BuilderThemeEditorUI = (props) => {
  const {
    onBack,
    schemaState,
    themeState,
    current,
    edits,
    editCount,
    fieldErrors,
    resolution,
    editorAction,
    reload,
    setValue,
    saveDraft,
    publish,
    discardDraft,
    resetToPreset,
    rename,
    uploadImage,
    onUnsavedChange
  } = props

  const theme = useTheme()
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const [{ parseDate }] = useUtils()
  const [location, setLocation] = useState(null)
  const [start] = useState(readEditorLocation)
  const [confirm, setConfirm] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameError, setNameError] = useState(null)

  const { schema, format } = schemaState
  const themeDetail = themeState.theme
  const busy = !!editorAction
  const hasEdits = editCount > 0

  // The page around it (its breadcrumb) asks before leaving with changes
  useEffect(() => {
    onUnsavedChange && onUnsavedChange(hasEdits)
  }, [hasEdits])
  useEffect(() => () => { onUnsavedChange && onUnsavedChange(false) }, [])

  useEffect(() => {
    if (!hasEdits) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasEdits])

  // The editor reaches the bottom of the window from where it starts
  const shell = useRef(null)
  const [shellHeight, setShellHeight] = useState(null)
  const ready = !!themeDetail && !!schema
  useLayoutEffect(() => {
    if (!ready) return
    const measure = () => {
      if (!shell.current) return
      setShellHeight(Math.max(320, window.innerHeight - (shell.current.getBoundingClientRect().top + window.scrollY)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [ready])

  const formatDate = (value) => value ? parseDate(value, { outputFormat: 'MMM D, h:mm A' }) : ''

  const leave = () => {
    if (hasEdits) setConfirm({ type: 'leave' })
    else onBack()
  }

  // The URL follows what is open
  const followLocation = (next) => {
    setLocation(next)
    if (!next.item) removeQueryToUrl(['item'])
    addQueryToUrl(next.item ? { section: next.section, item: next.item } : { section: next.section })
  }

  if ((themeState.loading && !themeDetail) || (schemaState.loading && !schema)) {
    return (
      <div aria-busy='true'>
        <Skeleton height={32} width={280} />
        <Skeleton height={420} style={{ marginTop: 20 }} />
      </div>
    )
  }

  if (themeState.error || schemaState.error || !themeDetail) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={themeState.notFound ? t('BUILDER_THEME_NOT_FOUND', 'This theme doesn’t exist') : t('BUILDER_THEME_LOAD_ERROR', 'We couldn’t load this theme')}
        text={themeState.notFound ? t('BUILDER_THEME_NOT_FOUND_HELP', 'It may have been deleted.') : t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Button color='secundary' borderRadius='8px' onClick={onBack}>{t('BUILDER_THEME_BACK', 'Back to themes')}</Button>
          {!themeState.notFound && <Button color='primary' borderRadius='8px' onClick={reload}>{t('BUILDER_RETRY', 'Try again')}</Button>}
        </div>
      </BuilderMessage>
    )
  }

  if (themeDetail.version !== 2 || !schema) {
    return (
      <BuilderMessage
        icon={<Palette aria-hidden='true' />}
        title={t('BUILDER_THEME_PREVIOUS_VERSION', 'This theme was made with the previous editor')}
        text={t('BUILDER_THEME_PREVIOUS_VERSION_HELP', 'Create a new theme from it to edit it here.')}
      >
        <Button color='primary' borderRadius='8px' onClick={onBack}>{t('BUILDER_THEME_BACK', 'Back to themes')}</Button>
      </BuilderMessage>
    )
  }

  if (!isNodeSchema(schema)) {
    return (
      <BuilderMessage
        icon={<Palette aria-hidden='true' />}
        title={t('BUILDER_THEME_SCHEMA_PENDING', 'The editor for this website isn’t ready yet')}
        text={t('BUILDER_THEME_SCHEMA_PENDING_HELP', 'Its theme schema hasn’t moved to the new format. Try again later.')}
      >
        <Button color='primary' borderRadius='8px' onClick={onBack}>{t('BUILDER_THEME_BACK', 'Back to themes')}</Button>
      </BuilderMessage>
    )
  }

  const resetSections = getResetSections(schema, location)

  // A refusal the editor marks nowhere says where it is listed instead
  const invalidMessage = (errors) => (errors.length > 0 && errors.every(item => !showsPath(schema, item.path))
    ? t('BUILDER_THEME_INVALID_HIDDEN', 'Some values aren’t valid and the editor doesn’t show them. They’re listed above the editor.')
    : t('BUILDER_THEME_INVALID', 'Some values aren’t valid. Check the marked fields.'))

  const handleSave = async () => {
    const { ok, errorCodes, errors } = await saveDraft()
    if (ok) {
      showToast(ToastType.Success, t('BUILDER_THEME_DRAFT_SAVED', 'Draft saved'))
      return
    }
    showToast(ToastType.Error, errorCodes.includes('theme.invalid')
      ? invalidMessage(errors)
      : t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
  }

  const handlePublish = async () => {
    const { ok, errorCodes, errors } = await publish()
    if (ok) {
      showToast(ToastType.Success, themeDetail.active
        ? t('BUILDER_THEME_PUBLISHED_ACTIVE', 'Published. Your website shows it within 5 minutes.')
        : t('BUILDER_THEME_PUBLISHED_INACTIVE', 'Published. Activate the theme to show it on your website.'))
      return
    }
    showToast(ToastType.Error, errorCodes.includes('theme.invalid')
      ? invalidMessage(errors)
      : t('BUILDER_THEME_PUBLISH_ERROR', 'We couldn’t publish it. Try again.'))
  }

  const handleDiscard = async () => {
    setConfirm(null)
    const { ok } = await discardDraft()
    showToast(ok ? ToastType.Success : ToastType.Error, ok
      ? t('BUILDER_THEME_DRAFT_DISCARDED', 'Draft discarded')
      : t('BUILDER_THEME_DISCARD_ERROR', 'We couldn’t discard the draft. Try again.'))
  }

  const handleReset = async (sections) => {
    setConfirm(null)
    const { ok, errorCodes } = await resetToPreset(sections)
    if (ok) {
      showToast(ToastType.Success, t('BUILDER_THEME_RESET_DONE', 'The preset’s values are in the draft. Publish to use them.'))
      return
    }
    // A preset of a version of the website this one no longer takes leaves the draft as it was
    showToast(ToastType.Error, errorCodes.includes('preset.incompatible')
      ? t('BUILDER_THEME_PRESET_INCOMPATIBLE', 'This preset was made for an earlier version of the website, so it can’t be applied. The draft didn’t change.')
      : t('BUILDER_THEME_RESET_ERROR', 'We couldn’t reset it. Try again.'))
  }

  const startRename = () => {
    setNameDraft(themeDetail.name || '')
    setNameError(null)
    setRenaming(true)
  }

  const handleRename = async (e) => {
    e.preventDefault()
    const name = nameDraft.trim()
    if (!name) {
      setNameError(t('BUILDER_ERROR_NAME_REQUIRED', 'Enter a name.'))
      return
    }
    if (name === themeDetail.name) {
      setRenaming(false)
      return
    }
    const { ok, errorCodes } = await rename(name)
    if (ok) {
      setRenaming(false)
      showToast(ToastType.Success, t('BUILDER_RENAMED', 'Renamed to _name_').replace('_name_', name))
      return
    }
    setNameError(errorCodes.includes('name.max')
      ? t('BUILDER_ERROR_NAME_MAX', 'Use _max_ characters or fewer.').replace('_max_', THEME_NAME_MAX_LENGTH)
      : t('BUILDER_SAVE_ERROR', 'We couldn’t save it. Try again.'))
  }

  const status = [
    hasEdits
      ? (editCount === 1 ? t('BUILDER_THEME_ONE_UNSAVED', '1 unsaved change') : t('BUILDER_THEME_N_UNSAVED', '_count_ unsaved changes').replace('_count_', editCount))
      : t('BUILDER_THEME_NO_UNSAVED', 'No unsaved changes'),
    themeDetail.has_draft && themeDetail.updated_at && t('BUILDER_THEME_DRAFT_SAVED_ON', 'Draft saved _date_').replace('_date_', formatDate(themeDetail.updated_at))
  ].filter(Boolean).join(' · ')

  return (
    <EditorShell ref={shell} style={shellHeight ? { height: shellHeight } : undefined}>
      {/* A list and its detail (Components, Pages) scroll each on their own, not the whole editor */}
      <EditorScroll $fill={!!location?.list}>
        <EditorHeader>
          {renaming
            ? (
              <RenameForm onSubmit={handleRename} noValidate>
                <label htmlFor='builder-theme-name' className='sr-only'>{t('BUILDER_THEME_NAME', 'Theme name')}</label>
                <div>
                  <Input
                    id='builder-theme-name'
                    type='text'
                    value={nameDraft}
                    maxLength={THEME_NAME_MAX_LENGTH}
                    autoComplete='off'
                    autoFocus
                    aria-invalid={nameError ? 'true' : 'false'}
                    aria-describedby={nameError ? 'builder-theme-name-error' : undefined}
                    onChange={(e) => { setNameDraft(e.target.value); setNameError(null) }}
                    onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(false) }}
                  />
                  {nameError && <FieldHelp><span id='builder-theme-name-error' role='alert'>{nameError}</span></FieldHelp>}
                </div>
                <Button type='submit' color='primary' borderRadius='8px' disabled={editorAction === 'rename'}>
                  {editorAction === 'rename' ? t('BUILDER_SAVING', 'Saving…') : t('SAVE', 'Save')}
                </Button>
                <Button type='button' color='secundary' borderRadius='8px' onClick={() => setRenaming(false)}>{t('CANCEL', 'Cancel')}</Button>
              </RenameForm>
              )
            : (
              <div>
                <h1>{themeDetail.name}</h1>
                <RenameButton type='button' aria-label={t('BUILDER_THEME_RENAME', 'Rename theme')} title={t('BUILDER_RENAME', 'Rename')} onClick={startRename}>
                  <PencilSquare aria-hidden='true' />
                </RenameButton>
                <StatusPill tone={themeDetail.active ? 'active' : 'inactive'}>
                  {themeDetail.active ? t('BUILDER_THEME_ACTIVE', 'Active') : t('BUILDER_THEME_NOT_ACTIVE', 'Not active')}
                </StatusPill>
                {(themeDetail.has_draft || hasEdits) && <StatusPill tone='draft'>{t('BUILDER_THEME_UNPUBLISHED', 'Unpublished changes')}</StatusPill>}
              </div>
              )}
          <p>
            {[
              themeDetail.preset && t('BUILDER_THEME_BASED_ON', 'Based on _name_ v_version_').replace('_name_', themeDetail.preset.name || '').replace('_version_', themeDetail.preset.version),
              themeDetail.active
                ? t('BUILDER_THEME_ACTIVE_HELP', 'Your website uses this theme: publishing changes it within 5 minutes.')
                : t('BUILDER_THEME_INACTIVE_HELP', 'This theme isn’t active, so publishing doesn’t change your website until you activate it.')
            ].filter(Boolean).join(' · ')}
          </p>
        </EditorHeader>

        <ThemeNotices t={t} schema={schema} theme={themeDetail} edits={edits} fieldErrors={fieldErrors} />

        <ThemeSchemaEditor
          schema={schema}
          format={format}
          resolved={resolution?.resolved}
          sources={resolution?.sources}
          aliases={resolution?.aliases}
          current={current}
          edits={edits}
          fieldErrors={fieldErrors}
          invalid={themeDetail.invalid}
          setValue={setValue}
          uploadImage={uploadImage}
          editorAction={editorAction}
          // A refused save: the section that shows the first value refused
          focus={Object.keys(fieldErrors || {})[0]}
          start={start}
          linkTo={getEditorHref}
          onLocationChange={followLocation}
        />
      </EditorScroll>

      <SaveBar role='region' aria-label={t('BUILDER_THEME_SAVE_BAR', 'Save and publish')}>
        <span role='status'>{status}</span>
        <div>
          <Button type='button' color='secundary' borderRadius='8px' onClick={leave}>{t('BUILDER_THEME_BACK', 'Back to themes')}</Button>
          {(themeDetail.has_draft || hasEdits) && (
            <Button type='button' color='secundary' borderRadius='8px' disabled={busy} onClick={() => setConfirm({ type: 'discard' })}>
              {t('BUILDER_THEME_DISCARD_DRAFT', 'Discard draft')}
            </Button>
          )}
          {themeDetail.preset && (
            <Dropdown>
              <Dropdown.Toggle
                as={Button}
                color='secundary'
                borderRadius='8px'
                id='builder-theme-reset'
                disabled={busy || hasEdits}
                title={hasEdits ? t('BUILDER_THEME_RESET_SAVE_FIRST', 'Save or discard your changes first.') : undefined}
              >
                {t('BUILDER_THEME_RESET_PRESET', 'Reset to preset')}
              </Dropdown.Toggle>
              <Dropdown.Menu align={theme?.rtl ? 'left' : 'right'}>
                <Dropdown.Item as='button' onClick={() => setConfirm({ type: 'reset', sections: [] })}>
                  {t('BUILDER_THEME_RESET_ALL', 'The whole theme')}
                </Dropdown.Item>
                {resetSections.length > 0 && (
                  <Dropdown.Item as='button' onClick={() => setConfirm({ type: 'reset', sections: resetSections })}>
                    {t('BUILDER_THEME_RESET_SECTION', 'Only this section')}
                  </Dropdown.Item>
                )}
              </Dropdown.Menu>
            </Dropdown>
          )}
          <Button type='button' color='primary' outline borderRadius='8px' disabled={busy || (!hasEdits && !themeDetail.upgraded_from)} onClick={handleSave}>
            {editorAction === 'save' ? t('BUILDER_SAVING', 'Saving…') : t('BUILDER_THEME_SAVE_DRAFT', 'Save draft')}
          </Button>
          <Button type='button' color='primary' borderRadius='8px' disabled={busy || (!hasEdits && !themeDetail.has_draft)} onClick={handlePublish}>
            {editorAction === 'publish' ? t('BUILDER_THEME_PUBLISHING', 'Publishing…') : t('BUILDER_THEME_PUBLISH', 'Publish')}
          </Button>
        </div>
      </SaveBar>

      <Confirm
        open={confirm?.type === 'discard'}
        width='min(440px, calc(100vw - 72px))'
        title={t('BUILDER_THEME_DISCARD_TITLE', 'Discard the draft?')}
        acceptText={t('BUILDER_THEME_DISCARD_DRAFT', 'Discard draft')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={handleDiscard}
        onCancel={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      >
        <p>{t('BUILDER_THEME_DISCARD_HELP', 'The theme goes back to what you last published. Changes you haven’t saved are lost too.')}</p>
      </Confirm>

      <Confirm
        open={confirm?.type === 'reset'}
        width='min(440px, calc(100vw - 72px))'
        title={confirm?.sections?.length
          ? t('BUILDER_THEME_RESET_SECTION_TITLE', 'Reset this section to the preset?')
          : t('BUILDER_THEME_RESET_ALL_TITLE', 'Reset the whole theme to the preset?')}
        acceptText={t('BUILDER_THEME_RESET', 'Reset')}
        cancelText={t('CANCEL', 'Cancel')}
        onAccept={() => handleReset(confirm.sections)}
        onCancel={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      >
        <p>{t('BUILDER_THEME_RESET_HELP', 'The draft takes the values of _preset_. Nothing changes on your website until you publish.').replace('_preset_', themeDetail.preset?.name || '')}</p>
      </Confirm>

      <Confirm
        open={confirm?.type === 'leave'}
        width='min(440px, calc(100vw - 72px))'
        title={t('BUILDER_THEME_LEAVE_TITLE', 'Leave without saving?')}
        acceptText={t('BUILDER_THEME_LEAVE', 'Leave')}
        cancelText={t('BUILDER_THEME_STAY', 'Stay')}
        onAccept={() => { setConfirm(null); onBack() }}
        onCancel={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      >
        <p>{t('BUILDER_THEME_LEAVE_HELP', 'You have changes you haven’t saved. They’ll be lost.')}</p>
      </Confirm>
    </EditorShell>
  )
}

/** The editor of a theme of a Builder website. */
export const BuilderThemeEditorView = (props) => (
  <BuilderThemeEditorController {...props} productId={props.product.id} UIComponent={BuilderThemeEditorUI} />
)
