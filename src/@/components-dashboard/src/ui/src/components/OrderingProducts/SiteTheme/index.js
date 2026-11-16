import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLanguage, SiteTheme as SiteThemeController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Button, Checkbox, InlineNotice, Skeleton, useLeaveGuard } from '../../Shared/Product'
import { CircleAlert } from '../../Shared/Icon'
import { ThemeOption, ThemeSelect, getThemeChoices } from './ThemeOption'
import { ThemeComponent } from './ThemeComponent'
import { ThemeImage } from './ThemeImage'
import { buildBase, cloneValues, countChanges, firstMessage, getTitle, setAt } from './themeValues'
import './site-theme.css'

// redesign (lot D, decisions 7 and 8): the Theme tab of an Ordering product on Product controls. Same engine and same JSON as
// in `main` (section > blocks > options, the structure and the values of the theme record). What changes:
//  - the values are kept as a copy next to the base they started from (OP audit: `main` wrote into the loaded record); «dirty» is
//    the count of leaves that differ, Discard goes back to the base and remounts the controls with a new key;
//  - the controls are controlled by the current value, and the section's content is keyed by the section (OP-16);
//  - the failures are said: a load that fails (OP-07: no theme is offered to assign), assign and update (in the bar or under the
//    button, translated), and a list of themes that fails;
//  - «Update» stays always available, as in `main`, with «N unsaved changes» and the leave guard beside it.

const WRITE_OPTIONS = { inlineError: true }
const NO_REGISTER = () => () => {} // redesign (review r1, Q-03)

const SiteThemeUI = (props) => {
  const {
    siteThemesState,
    themesList,
    actionState,
    selectedTheme,
    handleSelectTheme,
    handleAssignTheme,
    handleUpdateSiteTheme,
    handleAddThemeGallery,
    getSiteTheme,
    getThemes
  } = props

  const [, t] = useLanguage()
  const mounted = useRef(true)
  const rootRef = useRef(null)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const record = siteThemesState.result?.[0]
  const structure = useMemo(() => record?.theme?.structure || {}, [record])
  const hasRecord = !siteThemesState.loading && !siteThemesState.error && !!record

  // `base` is what the form started from (or what was last saved); `values` is what is on screen.
  const [base, setBase] = useState(null)
  const [values, setValues] = useState({})
  const [selectedPage, setSelectedPage] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [updateError, setUpdateError] = useState(null)
  const [assignError, setAssignError] = useState(null)

  // The values start over when a theme record loads (and again on a retry), not when an update replaces the record. The key is
  // the theme the site has, not the id of the record: an update may hand the record back under another id (the synthetic API does).
  const recordKey = hasRecord ? String(record.theme_id ?? record.theme?.id ?? 'theme') : null
  const [seenKey, setSeenKey] = useState(null)
  if (seenKey !== recordKey) {
    setSeenKey(recordKey)
    if (recordKey !== null) {
      const initial = buildBase(record.theme?.values_default, record.values)
      setBase(initial)
      setValues(cloneValues(initial))
      setResetKey(key => key + 1)
      setUpdateError(null)
    }
  }

  const count = hasRecord && base ? countChanges(base, values) : 0
  const dirty = count > 0

  const pageChoices = useMemo(() => getThemeChoices(t, Object.keys(structure)), [structure])
  const themeChoices = useMemo(() => (themesList.result || []).map(theme => ({
    value: theme.id,
    content: (
      <span className='odc-op-theme-option'>{t(theme.name.toUpperCase(), theme.name.replace(/_/g, ' '))}</span>
    )
  })), [themesList.result])

  const handleChange = useCallback((path, value) => {
    setValues(current => setAt(current, path, value))
    setUpdateError(null)
  }, [])

  const update = async () => {
    if (saving) return { ok: false }
    setUpdateError(null)
    setSaving(true)
    const sent = cloneValues(values)
    let result
    try {
      result = await handleUpdateSiteTheme(sent, WRITE_OPTIONS)
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return { ok: !!result && !result.error }
    setSaving(false)
    if (!result || result.error) {
      setUpdateError(translateApiMessage(t, firstMessage(result?.result), t('SITE_THEME_UPDATE_FAILED', "We couldn't update this theme.")))
      return { ok: false }
    }
    setBase(sent)
    return { ok: true }
  }

  const discard = () => {
    setValues(cloneValues(base))
    setResetKey(key => key + 1)
    setUpdateError(null)
  }

  const assign = async () => {
    setAssignError(null)
    let result
    try {
      result = await handleAssignTheme(WRITE_OPTIONS)
    } catch (error) {
      result = { error: true, result: [error?.message] }
    }
    if (!mounted.current) return
    if (result?.error) {
      setAssignError(translateApiMessage(t, firstMessage(result.result), t('SITE_THEME_ASSIGN_FAILED', "We couldn't assign this theme.")))
    }
  }

  // The hook is always called; with no theme loaded nothing is dirty. Review r1 (Q-03): it registers in the host only (`NO_REGISTER`);
  // the panel (OrderingProductDetails) has the one close guard of the SplitView, so Esc asks about General and Theme together.
  useLeaveGuard({ dirty, count, label: t('THEME', 'Theme'), save: update, discard, registerCloseGuard: NO_REGISTER }) // N-04: the dialog names the tab

  const tryAgain = (action) => (
    <Button size='sm' onClick={() => action()}>{t('TRY_AGAIN', 'Try again')}</Button>
  )

  if (siteThemesState.loading) {
    return (
      <div className='odc-op-theme'>
        <div className='odc-op-theme-skeleton' role='status' aria-busy='true'>
          <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
          <Skeleton size='30%' />
          <Skeleton block='var(--od-x-control-height)' />
          <Skeleton size='30%' />
          <Skeleton block='var(--od-x-control-height-lg)' />
          <Skeleton size='30%' />
          <Skeleton block='var(--od-x-control-height)' />
        </div>
      </div>
    )
  }

  // redesign (OP-07): a load that fails is said with its reason and «Try again»; the site is NOT offered a theme to assign,
  // because it may already have one (assigning would put a new one over it).
  if (siteThemesState.error) {
    return (
      <div className='odc-op-theme'>
        <InlineNotice tone='danger' action={tryAgain(getSiteTheme)}>
          {translateApiMessage(t, firstMessage(siteThemesState.error), t('SITE_THEME_LOAD_FAILED', "We couldn't load this theme."))}
        </InlineNotice>
      </div>
    )
  }

  if (!record) {
    return (
      <div className='odc-op-theme'>
        <div className='odc-op-theme-assign'>
          {themesList.error && (
            <InlineNotice tone='danger' action={tryAgain(getThemes)}>
              {translateApiMessage(t, firstMessage(themesList.error), t('SITE_THEMES_LOAD_FAILED', "We couldn't load the themes."))}
            </InlineNotice>
          )}
          <ThemeSelect
            label={t('THEME', 'Theme')}
            placeholder={t('SELECT_THEME', 'Select theme')}
            options={themeChoices}
            onChange={themeId => handleSelectTheme(themeId)}
          />
          <div className='odc-op-theme-assign-actions'>
            <Button variant='primary' busy={actionState.loading} disabled={!selectedTheme} onClick={assign}>
              {t('SAVE', 'Save')}
            </Button>
            {assignError && (
              <p className='odc-op-theme-error' role='alert'>
                <CircleAlert className='odc-icon' aria-hidden='true' />
                <span>{assignError}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  const page = selectedPage ? structure[selectedPage] : null
  const pageComponents = page?.components
  const pageValues = selectedPage ? values[selectedPage] : null
  const countText = (count === 1
    ? t('SETTINGS_UNSAVED_CHANGES_ONE', '_count_ unsaved change')
    : t('SETTINGS_UNSAVED_CHANGES_OTHER', '_count_ unsaved changes')).replace('_count_', String(count))

  // redesign (review r1, Q-09): the Discard button goes with the changes, so the focus goes to the tab itself (as General's
  // Discard sends it to its form) and not to the panel behind it. It takes the focus without a ring, like `.odc-op-form`.
  const discardFromBar = () => {
    discard()
    rootRef.current?.focus({ preventScroll: true })
  }

  return (
    <div className='odc-op-theme' ref={rootRef} tabIndex={-1}>
      <div className='odc-op-theme-body'>
        <ThemeSelect
          label={t('SECTION', 'Section')}
          placeholder={t('SELECT_SECTION_TO_CUSTOMIZE', 'Select a section to customize')}
          options={pageChoices}
          value={selectedPage}
          onChange={key => setSelectedPage(key)}
        />
        {/* redesign (OP-16): the content of a section is keyed by the section (and by Discard), so a block that has the same
            name in two sections never keeps the state of the other */}
        {page && (
          <div className='odc-op-theme-section' key={`${selectedPage}-${resetKey}`}>
            {page.hidden?.value_type === 'boolean' && (
              <Checkbox
                checked={!!pageValues?.hidden}
                onCheckedChange={next => handleChange(`${selectedPage}.hidden`, next)}
              >
                {t('HIDDEN', 'Hidden')}
              </Checkbox>
            )}
            <h3 className='odc-op-theme-heading'>{t('PAGE_BLOCKS', 'Page blocks')}</h3>
            {!!pageComponents && Object.keys(pageComponents).map(block => {
              if (block === 'birthday') return null
              const blockObject = pageComponents[block]
              const blockValues = pageValues?.components?.[block]
              const blockPath = [selectedPage, 'components', block].join('.')
              const blockTitle = getTitle(t, block) // J5 row 48: the translated title, see getTitle
              return (
                <section className='odc-op-theme-block' key={block}>
                  <h4 className='odc-op-theme-block-title'>{blockTitle}</h4>
                  {(block === 'image' || block === 'dummy_image') && blockObject?.value_type === 'string' && (
                    <ThemeImage
                      label={blockTitle}
                      valueObject={blockValues}
                      handleAddThemeGallery={handleAddThemeGallery}
                      handleChangeValue={value => handleChange(blockPath, value)}
                    />
                  )}
                  {block === 'slug' && blockObject?.value_type === 'string' && (
                    <ThemeSelect
                      label={blockTitle}
                      placeholder={t('SELECT_ITEM', 'Select a _attribute_').replace('_attribute_', blockTitle)}
                      options={getThemeChoices(t, blockObject?.options)}
                      value={blockValues}
                      onChange={value => handleChange(blockPath, value)}
                    />
                  )}
                  {Object.keys(blockObject || {}).filter(option => option !== 'components' && option !== 'value_type').map(option => (
                    <React.Fragment key={option}>
                      {typeof blockValues?.[option] !== 'undefined' && (
                        <ThemeOption
                          name={option}
                          optionObject={blockObject[option]}
                          valueObject={blockValues[option]}
                          path={[blockPath, option].join('.')}
                          onChange={handleChange}
                          handleAddThemeGallery={handleAddThemeGallery}
                        />
                      )}
                    </React.Fragment>
                  ))}
                  {blockObject?.components && Object.keys(blockObject.components).map(component => (
                    <ThemeComponent
                      key={component}
                      name={component}
                      componentObject={blockObject.components[component]}
                      valueObject={blockValues?.components?.[component]}
                      path={[blockPath, 'components', component].join('.')}
                      onChange={handleChange}
                      handleAddThemeGallery={handleAddThemeGallery}
                    />
                  ))}
                </section>
              )
            })}
          </div>
        )}
      </div>
      {/* redesign (decision 7): a bar of its own, not P/SaveBar (which is gone without changes): «Update» is always there,
          as in `main`; the count and Discard come with the first change, the reason of a failed update stays until the next change. */}
      <div className='odc-op-theme-bar' role='group' aria-label={t('SAVE_CHANGES', 'Save changes')} data-saving={saving ? '' : undefined}>
        <div className='odc-op-theme-bar-text'>
          {dirty && <p className='odc-op-theme-count'>{countText}</p>}
          {updateError && !saving && (
            <p className='odc-op-theme-error' role='alert'>
              <CircleAlert className='odc-icon' aria-hidden='true' />
              <span>{updateError}</span>
            </p>
          )}
        </div>
        <div className='odc-op-theme-bar-actions'>
          {dirty && (
            <Button disabled={saving} onClick={discardFromBar}>{t('DISCARD', 'Discard')}</Button>
          )}
          <Button variant='primary' busy={saving} onClick={update}>{t('UPDATE', 'Update')}</Button>
        </div>
      </div>
    </div>
  )
}

export const SiteTheme = (props) => {
  const siteThemeProps = {
    ...props,
    UIComponent: SiteThemeUI
  }
  return <SiteThemeController {...siteThemeProps} />
}
