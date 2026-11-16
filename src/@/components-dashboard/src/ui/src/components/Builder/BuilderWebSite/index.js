import React, { useEffect } from 'react'

import { BuilderSiteSettings as BuilderSiteSettingsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { CircleAlert, Settings } from '../../Shared/Icon'
import { Button, EmptyState, InlineNotice, Skeleton } from '../../Shared/Product'
import { SiteSettingsEditor } from '../ThemeSchemaEditor'
import './builder-site.css'

// redesign B3a: the website's settings tab on Product pieces (P/Skeleton, P/EmptyState, P/Button); same
// controller, states, texts, toast and beforeunload guard (main has no in-app leave guard on this tab).

const BuilderWebSiteSettingsUI = (props) => {
  const { schemaState, reloadSchema, hasEdits, save, hasActiveTheme, onGoToTheme } = props
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const { schema, format } = schemaState

  useEffect(() => {
    if (!hasEdits) return
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasEdits])

  if (schemaState.loading && !schema) {
    return (
      <div className='odc-bs-busy' aria-busy='true'>
        <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
        <Skeleton shape='box' block='calc(var(--od-space-6) + var(--od-space-6))' />
        <Skeleton shape='box' block='calc(var(--od-space-10) * 2.5)' />
      </div>
    )
  }

  if (schemaState.error) {
    return (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        titleAs='h2'
        title={t('BUILDER_SITE_LOAD_ERROR', 'We couldn’t load the website settings')}
        description={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        action={<Button variant='primary' onClick={reloadSchema}>{t('BUILDER_RETRY', 'Try again')}</Button>}
      />
    )
  }

  if (!Array.isArray(schema?.editor?.sections)) {
    return (
      <EmptyState
        icon={Settings}
        titleAs='h2'
        title={t('BUILDER_THEME_SCHEMA_PENDING', 'The editor for this website isn’t ready yet')}
        description={t('BUILDER_THEME_SCHEMA_PENDING_HELP', 'Its theme schema hasn’t moved to the new format. Try again later.')}
      />
    )
  }

  // The settings save on their own, with a toast when they do
  const site = {
    ...props,
    save: async () => {
      const { ok } = await save()
      if (ok) showToast(ToastType.Success, t('BUILDER_THEME_SITE_SAVED', 'Website settings saved'))
      return { ok }
    }
  }

  return (
    <>
      {/* main without an active theme the website reads none of these settings */}
      {hasActiveTheme === false && (
        <InlineNotice
          tone='warning'
          className='odc-bs-no-theme'
          action={onGoToTheme && <Button variant='secondary' onClick={onGoToTheme}>{t('BUILDER_SITE_GO_TO_THEME', 'Go to Theme')}</Button>}
        >
          <strong>{t('BUILDER_SITE_NO_ACTIVE_THEME_TITLE', 'Your website doesn’t use these settings yet')}</strong>{' '}
          {t('BUILDER_SITE_NO_ACTIVE_THEME', 'It has no active theme. Its type, store or franchise and these settings apply once you create a theme and activate it.')}
        </InlineNotice>
      )}
      <SiteSettingsEditor schema={schema} format={format} site={site} />
    </>
  )
}

/** What a Builder website shows whatever its theme: its scope, name, own HTML and code. */
export const BuilderWebSiteSettings = (props) => (
  <BuilderSiteSettingsController {...props} productId={props.product.id} UIComponent={BuilderWebSiteSettingsUI} />
)
