import React, { useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { ExclamationCircle, Gear } from 'react-bootstrap-icons'

import { BuilderSiteSettings as BuilderSiteSettingsController, ToastType, useLanguage, useToast } from '../../../../../index'
import { Button } from '../../../styles'
import { BuilderMessage } from '../BuilderShared'
import { SiteSettingsEditor } from '../ThemeSchemaEditor'

const BuilderWebSiteSettingsUI = (props) => {
  const { schemaState, reloadSchema, hasEdits, save } = props
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
      <div aria-busy='true'>
        <Skeleton height={56} />
        <Skeleton height={320} style={{ marginTop: 16 }} />
      </div>
    )
  }

  if (schemaState.error) {
    return (
      <BuilderMessage
        role='alert'
        tone='error'
        icon={<ExclamationCircle aria-hidden='true' />}
        title={t('BUILDER_SITE_LOAD_ERROR', 'We couldn’t load the website settings')}
        text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
      >
        <Button color='primary' borderRadius='8px' onClick={reloadSchema}>{t('BUILDER_RETRY', 'Try again')}</Button>
      </BuilderMessage>
    )
  }

  if (!Array.isArray(schema?.editor?.sections)) {
    return (
      <BuilderMessage
        icon={<Gear aria-hidden='true' />}
        title={t('BUILDER_THEME_SCHEMA_PENDING', 'The editor for this website isn’t ready yet')}
        text={t('BUILDER_THEME_SCHEMA_PENDING_HELP', 'Its theme schema hasn’t moved to the new format. Try again later.')}
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

  return <SiteSettingsEditor schema={schema} format={format} site={site} />
}

/** What a Builder website shows whatever its theme: its scope, name, own HTML and code. */
export const BuilderWebSiteSettings = (props) => (
  <BuilderSiteSettingsController {...props} productId={props.product.id} UIComponent={BuilderWebSiteSettingsUI} />
)
