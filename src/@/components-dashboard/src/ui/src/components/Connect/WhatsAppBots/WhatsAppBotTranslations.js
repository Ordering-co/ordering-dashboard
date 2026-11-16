import React, { useState } from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import {
  ErrorBox,
  Hint,
  SectionDescription
} from './styles'
import {
  SummaryCount,
  SummaryHeading,
  SummaryPreview,
  TranslationSummary
} from './WhatsAppBotTranslations.styles'
import { LOCALE_LABELS, WhatsAppTranslationsModal } from './WhatsAppTranslationsModal'

export const WhatsAppBotTranslations = (props) => {
  const {
    translationsState = {},
    reloadBotTranslations,
    brandName,
    brandLogo
  } = props
  const {
    locale = 'en',
    loading = false,
    error = null,
    catalog = {},
    draft = {}
  } = translationsState
  const [, t] = useLanguage()
  const entries = Object.entries(catalog)
  const [open, setOpen] = useState(false)
  const customCount = entries.filter(([, entry]) => entry.isCustom).length
  const welcomeEntry = catalog.chatbot_welcome_default ||
    entries.find(([, entry]) => entry.group === 'greeting')?.[1]
  const welcomeKey = catalog.chatbot_welcome_default
    ? 'chatbot_welcome_default'
    : entries.find(([, entry]) => entry.group === 'greeting')?.[0]
  const welcomeValue = welcomeEntry
    ? (draft[welcomeKey] || welcomeEntry.default)
    : ''
  const [localeKey, localeFallback] = LOCALE_LABELS[locale] || LOCALE_LABELS.en

  return (
    <>
      <TranslationSummary aria-labelledby='whatsapp-bot-translations-title'>
        <SummaryHeading>
          <div>
            <h3 id='whatsapp-bot-translations-title'>
              {t('WHATSAPP_BOT_TRANSLATIONS_SUMMARY_TITLE', 'Customer messages & Translations')}
            </h3>
            <SectionDescription>
              {t('WHATSAPP_BOT_TRANSLATIONS_DESCRIPTION', 'Customize the messages this bot sends during an order.')}
            </SectionDescription>
          </div>
          {!loading && entries.length > 0 && (
            <SummaryCount>
              {t(
                'WHATSAPP_BOT_TRANSLATIONS_CUSTOM_COUNT',
                '_count_ of _total_ customized'
              )
                .replace('_count_', customCount)
                .replace('_total_', entries.length)}
            </SummaryCount>
          )}
        </SummaryHeading>

        {loading && (
          <Hint role='status'>{t('WHATSAPP_BOT_TRANSLATIONS_LOADING', 'Loading translations...')}</Hint>
        )}

        {error && (
          <ErrorBox role='alert'>
            <p>{error.map(code => t(code, code)).join(', ')}</p>
            <Button type='button' color='primary' borderRadius='8px' onClick={reloadBotTranslations}>
              {t('RETRY', 'Retry')}
            </Button>
          </ErrorBox>
        )}

        {!loading && entries.length === 0 && !error && (
          <Hint>{t('WHATSAPP_BOT_TRANSLATIONS_EMPTY', 'No customer messages are available.')}</Hint>
        )}

        {welcomeValue && (
          <SummaryPreview>
            <span>
              {t('WHATSAPP_BOT_TRANSLATIONS_WELCOME_PREVIEW', 'Welcome preview')} · {t(localeKey, localeFallback)}
            </span>
            <p>{welcomeValue}</p>
          </SummaryPreview>
        )}

        <Button
          type='button'
          color='lightPrimary'
          borderRadius='8px'
          disabled={loading || entries.length === 0}
          onClick={() => setOpen(true)}
        >
          {t('WHATSAPP_BOT_TRANSLATIONS_CONFIGURE', 'Configure messages & translations')}
        </Button>
      </TranslationSummary>

      <WhatsAppTranslationsModal
        {...props}
        open={open}
        onClose={() => setOpen(false)}
        brandName={brandName}
        brandLogo={brandLogo}
      />
    </>
  )
}
