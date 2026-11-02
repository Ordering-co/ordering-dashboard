import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { NoticeRow } from '../BuilderWebTheme/styles'
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* The notice is a card of its own: no card around it */}
      <NoticeRow style={{ alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 8px 20px', position: 'sticky', top: 0, zIndex: 2 }}>
        <span style={{ flex: '1 1 260px' }}>{t('BUILDER_THEME_SITE_SAVED_APART', 'These settings are the website’s: they apply whatever theme is active, and save on their own.')}</span>
        <span style={{ display: 'flex', gap: 8, flex: 'none' }}>
          <Button type='button' color='secundary' borderRadius='8px' disabled={!site.hasEdits || site.saving} onClick={site.discard}>{t('DISCARD', 'Discard')}</Button>
          <Button type='button' color='primary' borderRadius='8px' disabled={!site.hasEdits || site.saving} onClick={site.save}>{site.saving ? t('BUILDER_THEME_SAVING', 'Saving…') : t('SAVE', 'Save')}</Button>
        </span>
      </NoticeRow>
      {[...new Set(errors)].map(error => <p key={error} role='alert' style={{ margin: 0, color: '#B0213D', fontSize: 13 }}>{error}</p>)}
      {lost.length > 0 && (
        <NoticeRow role='status'>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <p style={{ margin: 0 }}>{t('BUILDER_THEME_SITE_UPGRADE_DROPPED', 'Converting the settings to this version of the website dropped these, which take their default:')}</p>
            <PathList t={t} schema={schema} items={lost.map(path => ({ path }))} />
          </div>
        </NoticeRow>
      )}
      {dropped > 0 && (
        <p role='status' style={{ margin: 0, color: '#B0213D', fontSize: 13 }}>
          {dropped === 1
            ? t('BUILDER_THEME_SITE_ONE_DROPPED', '1 saved setting isn’t valid in this version of the website: it’s dropped when you save. It’s marked below.')
            : t('BUILDER_THEME_SITE_N_DROPPED', '_count_ saved settings aren’t valid in this version of the website: they’re dropped when you save. They’re marked below.').replace('_count_', dropped)}
        </p>
      )}
      {clamped > 0 && (
        <p role='status' style={{ margin: 0, fontSize: 13 }}>
          {clamped === 1
            ? t('BUILDER_THEME_SITE_ONE_CLAMPED', '1 saved setting is outside the range this version of the website takes: it was set to the closest limit, and it’s saved like that when you save. It’s marked below.')
            : t('BUILDER_THEME_SITE_N_CLAMPED', '_count_ saved settings are outside the range this version of the website takes: they were set to the closest limit, and they’re saved like that when you save. They’re marked below.').replace('_count_', clamped)}
        </p>
      )}
      <EditorErrorBoundary t={t}>
        {sections.map(section => (
          <React.Fragment key={section.key}>
            {sections.length > 1 && <h2 style={{ margin: '8px 0 0', fontSize: 18 }}>{formatText(t, section.label, { fallback: section.key })}</h2>}
            {(section.groups || []).map(group => <GroupCard key={group.key} ctx={ctx} group={siteOnly(group)} />)}
          </React.Fragment>
        ))}
      </EditorErrorBoundary>
    </div>
  )
}
