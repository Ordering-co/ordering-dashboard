import React from 'react'

import { useLanguage } from '../../../../../index'
import { Info, TriangleAlert } from '../../Shared/Icon'
import { Button, InlineNotice } from '../../Shared/Product'
import '../BuilderWebSite/builder-site.css'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { GroupCard } from './SchemaGroup'
import { PathList } from './PathList'
import { editorOf, formatText, isClamped, isNode, storedErrorsOf } from './schemaNodes'

/** A section the product keeps (`store: "site"`), not a theme: the website's settings. */
export const isSiteSection = (section) => section?.store === 'site'

const isSitePath = (path) => String(path || '').split('.')[0] === 'site'

/** A group with only what the website's settings save (`site.…`): a theme's value there would never be saved. */
const siteOnly = (group) => ({
  ...group,
  paths: (group.paths || []).filter(isSitePath),
  toggle: group.toggle && isSitePath(group.toggle.path) ? group.toggle : undefined
})

const withScopeControl = (schema) => {
  const node = schema?.site?.mode
  if (!isNode(node)) return schema
  const editor = { ...editorOf(node), control: 'scope' }
  return { ...schema, site: { ...schema.site, mode: { ...node, $extensions: { ...node.$extensions, 'co.ordering.editor': editor } } } }
}

const SITE_ERRORS = {
  'business_id.exists': (t) => t('BUILDER_THEME_SITE_STORE_GONE', 'That store doesn’t exist anymore. Choose another one.'),
  'franchise_id.exists': (t) => t('BUILDER_THEME_SITE_FRANCHISE_GONE', 'That franchise doesn’t exist anymore. Choose another one.'),
  'scope.incomplete': (t) => t('BUILDER_THEME_SITE_SCOPE_INCOMPLETE', 'Choose the store or the franchise this website shows, or make it a marketplace.'),
  'scope.both': (t) => t('BUILDER_THEME_SITE_SCOPE_BOTH', 'A website shows one store or one franchise, not both.'),
  'settings.invalid': (t) => t('BUILDER_THEME_SITE_INVALID', 'Some settings aren’t valid. Check the ones marked.')
}

/**
 * The website's settings (the schema's `site` sections): its scope, name,
 * own HTML and code, whatever theme is active. `site` is BuilderSiteSettings'
 * props; they save on their own, with the Save here. What the product saved
 * that this version of the schema no longer takes (`settings_invalid`) is
 * marked: saving drops it, or keeps a number out of its range at the
 * closest limit, where it reads. What converting them to this version lost
 * (`settings_upgrade_dropped`) is listed.
 */
export const SiteSettingsEditor = ({ schema, format, site }) => {
  const [, t] = useLanguage()
  const sections = (schema?.editor?.sections || []).filter(isSiteSection)
  const ctx = {
    schema: withScopeControl(schema),
    format,
    t,
    current: site.current,
    edits: site.edits,
    fieldErrors: site.fieldErrors || {},
    storedErrors: storedErrorsOf(site.product?.settings_invalid, site.edits),
    setValue: site.setValue,
    siteScope: {
      scope: site.scope,
      setScope: site.setScope,
      setScopeMode: site.setScopeMode,
      scopeOptions: site.scopeOptions,
      scopeSelection: site.scopeSelection,
      scopeIncomplete: site.scopeIncomplete,
      loadScopeOptions: site.loadScopeOptions,
      reloadScopeSelection: site.reloadScopeSelection
    }
  }
  const errors = (site.errorCodes || []).map(code => SITE_ERRORS[code] ? SITE_ERRORS[code](t) : t('BUILDER_THEME_SITE_SAVE_ERROR', 'We couldn’t save the website settings. Try again.'))
  // A number out of its range reads at the closest limit; anything else is dropped
  const clamped = Object.values(ctx.storedErrors).filter(isClamped).length
  const dropped = Object.keys(ctx.storedErrors).length - clamped
  const lost = Array.isArray(site.product?.settings_upgrade_dropped) ? site.product.settings_upgrade_dropped : []
  // redesign B3a: the notice and the notices of what the API dropped are P/InlineNotice (the first one not live,
  // as before), Discard and Save P/Button; the error lines keep role=alert and the dropped and clamped lines role=status
  return (
    <div className='odc-bs-page'>
      {/* The notice is a card of its own: no card around it */}
      {/* main the notice with Discard and Save stays on top while the settings scroll */}
      <InlineNotice
        tone='info'
        icon={Info}
        live={false}
        className='odc-bs-savebar'
        action={
          <span className='odc-bs-actions'>
            <Button disabled={!site.hasEdits || site.saving} onClick={site.discard}>{t('DISCARD', 'Discard')}</Button>
            <Button variant='primary' disabled={!site.hasEdits || site.saving} onClick={site.save}>{site.saving ? t('BUILDER_THEME_SAVING', 'Saving…') : t('SAVE', 'Save')}</Button>
          </span>
        }
      >
        {t('BUILDER_THEME_SITE_SAVED_APART', 'These settings are the website’s: they apply whatever theme is active, and save on their own.')}
      </InlineNotice>
      {[...new Set(errors)].map(error => <p key={error} role='alert' className='odc-bs-line' data-tone='danger'>{error}</p>)}
      {lost.length > 0 && (
        <InlineNotice tone='warning' icon={TriangleAlert}>
          <div>
            <p className='odc-bs-notice-text'>{t('BUILDER_THEME_SITE_UPGRADE_DROPPED', 'Converting the settings to this version of the website dropped these, which take their default:')}</p>
            <PathList t={t} schema={schema} items={lost.map(path => ({ path }))} />
          </div>
        </InlineNotice>
      )}
      {dropped > 0 && (
        <p role='status' className='odc-bs-line' data-tone='danger'>
          {dropped === 1
            ? t('BUILDER_THEME_SITE_ONE_DROPPED', '1 saved setting isn’t valid in this version of the website: it’s dropped when you save. It’s marked below.')
            : t('BUILDER_THEME_SITE_N_DROPPED', '_count_ saved settings aren’t valid in this version of the website: they’re dropped when you save. They’re marked below.').replace('_count_', dropped)}
        </p>
      )}
      {clamped > 0 && (
        <p role='status' className='odc-bs-line'>
          {clamped === 1
            ? t('BUILDER_THEME_SITE_ONE_CLAMPED', '1 saved setting is outside the range this version of the website takes: it was set to the closest limit, and it’s saved like that when you save. It’s marked below.')
            : t('BUILDER_THEME_SITE_N_CLAMPED', '_count_ saved settings are outside the range this version of the website takes: they were set to the closest limit, and they’re saved like that when you save. They’re marked below.').replace('_count_', clamped)}
        </p>
      )}
      <EditorErrorBoundary t={t}>
        {sections.map(section => (
          <React.Fragment key={section.key}>
            {sections.length > 1 && <h2 className='odc-bs-section'>{formatText(t, section.label, { fallback: section.key })}</h2>}
            {(section.groups || []).map(group => <GroupCard key={group.key} ctx={ctx} group={siteOnly(group)} />)}
          </React.Fragment>
        ))}
      </EditorErrorBoundary>
    </div>
  )
}
