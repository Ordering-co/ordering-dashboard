import React, { useState } from 'react'
import { useLanguage, useSite } from '../../../../../index'
import { useTheme } from 'styled-components'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { useProjectState } from '../../../contexts/ProjectContext'
import { Button, CopyButton, InlineNotice, RadioGroup, Skeleton } from '../../Shared/Product'
import { HTACCESS, PAYPAL_SCRIPT, widgetBot, widgetInline, widgetPopup } from './snippets'
import './widgets.css'

// redesign stores 5.15a (; G5-04, G5-05): the website widgets of a store, each snippet copyable.
// - Every snippet is a read-only code block (selectable, focusable, mono) with a P/CopyButton named by what it copies; main had
//   them in disabled inputs, with no copy control.
// - The store address comes from `useStoreWebsiteUrl` (the one source, also the QR's). While it loads, a skeleton; without
//   an address (no website, no slug) the two scripts that carry it are not painted empty: a notice says why, and there is nothing
//   to copy.
// - «Modal style» is a P/RadioGroup of its two options (one click instead of opening a select).
// - «Learn how to do it» opens the widget guide on docs.ordering.co (#481), the same for every project.

const CodeBlock = ({ id, label, code, rows, copyName, words }) => (
  <div className='odc-widgets-step'>
    <label htmlFor={id} className='odc-widgets-label'>{label}</label>
    <textarea
      id={id}
      className='odc-widgets-code'
      value={code}
      rows={rows}
      readOnly
      spellCheck={false}
      autoComplete='off'
      dir='ltr'
      onFocus={event => event.target.select()}
    />
    <CopyButton
      text={code}
      label={copyName}
      copyLabel={words.copyLabel}
      copiedLabel={words.copiedLabel}
      failedLabel={words.failedLabel}
    />
  </div>
)

export const BusinessWidgets = (props) => {
  const { business } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [{ loading: sitesLoading }] = useSite()
  const [projectStatus] = useProjectState()
  const storeUrl = useStoreWebsiteUrl(business?.slug)
  // the address waits for the sites and for the project's plan (which says whether it has a website)
  const addressLoading = !storeUrl && (sitesLoading || !!projectStatus?.loading)

  const [selectedType, setSelectedType] = useState('modal')

  const modalTypes = [
    { value: 'modal', label: t('TYPE_MODAL_POPUP', 'Button with modal style') },
    { value: 'chat', label: t('TYPE_MODAL_CHAT', 'Chat style integration') }
  ]
  const words = {
    copyLabel: t('COPY_BUTTON', 'Copy'),
    copiedLabel: t('COPIED', 'Copied'),
    failedLabel: t('COPY_FAILED_SELECT', 'Couldn\'t copy. Select the text and copy it.')
  }

  const addressMissing = addressLoading
    ? <Skeleton />
    : (
      <InlineNotice tone='info'>
        {t('STORE_WIDGETS_NO_ADDRESS', 'This store has no website address yet, so its widget code can\'t be made. It appears here once the store\'s website is ready.')}
      </InlineNotice>
      )
  const insertInDiv = t('INSERT_ON_DIV_DISPLAY', 'Insert in the div where you want to display it.')
  const insertAtEnd = t('INSERT_ON_END_BODY', 'Insert at the end of the body tag')
  const paypalOnly = t('IF_USED_PAYPALEXPRESS', 'Use only if Paypal Express is used')

  return (
    <div className='odc-widgets'>
      <section className='odc-widgets-block' aria-labelledby='odc-widgets-popup'>
        <h2 id='odc-widgets-popup' className='odc-widgets-heading'>{t('INTEGRATION_WEBSITE', 'Integration on your website')}: {t('POPUP', 'Popup')}</h2>
        <RadioGroup
          label={t('TYPE_MODAL', 'Modal style')}
          options={modalTypes}
          value={selectedType}
          onValueChange={setSelectedType}
        />
        <CodeBlock
          id='odc-widgets-popup-button'
          label={`1* ${insertInDiv}`}
          code={`<button onclick="toggleOrderingWidget()">${t('Online_Ordering', 'Online Ordering')}</button>`}
          rows={2}
          copyName={t('COPY_WIDGET_BUTTON_CODE', 'Copy button code')}
          words={words}
        />
        <CodeBlock
          id='odc-widgets-popup-paypal'
          label={`2* ${insertAtEnd} (${paypalOnly})`}
          code={PAYPAL_SCRIPT}
          rows={2}
          copyName={t('COPY_PAYPAL_SCRIPT', 'Copy PayPal script')}
          words={words}
        />
        {storeUrl
          ? (
            <CodeBlock
              id='odc-widgets-popup-script'
              label={`3* ${insertAtEnd}`}
              code={selectedType === 'modal' ? widgetPopup(storeUrl) : widgetBot(storeUrl, theme.colors.primary)}
              rows={5}
              copyName={selectedType === 'modal' ? t('COPY_POPUP_SCRIPT', 'Copy popup script') : t('COPY_CHAT_SCRIPT', 'Copy chat script')}
              words={words}
            />
            )
          : (
            <div className='odc-widgets-step'>
              <span className='odc-widgets-label'>{`3* ${insertAtEnd}`}</span>
              {addressMissing}
            </div>
            )}
      </section>

      <section className='odc-widgets-block' aria-labelledby='odc-widgets-inline'>
        <h2 id='odc-widgets-inline' className='odc-widgets-heading'>{t('INTEGRATION_WEBSITE', 'Integration on your website')}: {t('INLINE', 'Inline')}</h2>
        <CodeBlock
          id='odc-widgets-inline-paypal'
          label={`1* ${insertAtEnd} (${paypalOnly})`}
          code={PAYPAL_SCRIPT}
          rows={2}
          copyName={t('COPY_PAYPAL_SCRIPT', 'Copy PayPal script')}
          words={words}
        />
        {storeUrl
          ? (
            <CodeBlock
              id='odc-widgets-inline-script'
              label={`2* ${insertInDiv}`}
              code={widgetInline(storeUrl)}
              rows={5}
              copyName={t('COPY_INLINE_SCRIPT', 'Copy inline script')}
              words={words}
            />
            )
          : (
            <div className='odc-widgets-step'>
              <span className='odc-widgets-label'>{`2* ${insertInDiv}`}</span>
              {addressMissing}
            </div>
            )}
        <CodeBlock
          id='odc-widgets-inline-htaccess'
          label='3* .htaccess'
          code={HTACCESS}
          rows={2}
          copyName={t('COPY_HTACCESS_RULES', 'Copy .htaccess rules')}
          words={words}
        />
      </section>

      <div className='odc-widgets-help'>
        <Button
          onClick={() => window.open('https://docs.ordering.co/docs/products/dashboard/my-products/ordering-website-2/widget/', '_blank', 'noopener,noreferrer')}
        >
          {t('LEARN_HOW_TO_DO_IT', 'Learn how to do it')}
        </Button>
      </div>
    </div>
  )
}
