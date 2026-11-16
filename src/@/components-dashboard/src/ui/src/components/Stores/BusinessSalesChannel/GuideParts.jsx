import React from 'react'
import { useLanguage } from '../../../../../index'
import { CopyButton, InlineNotice, Skeleton } from '../../Shared/Product'

// redesign stores 5.15b (; G5-04, G5-11, G5-12, G5-14): the parts every sales channel guide is made of, so the four
// guides read the same. Text only (no HTML from translations); the screenshots are main's.

/** The numbered steps of a guide: an ordered list, each step with its «Step n» heading, one level under the guide's title (the
 * SectionSplit's h3; review 5.15b R2). */
export const GuideSteps = ({ children }) => <ol className='odc-sales-steps'>{children}</ol>

export const GuideStep = ({ number, text, images = [], children }) => {
  const [, t] = useLanguage()
  return (
    <li className='odc-sales-step'>
      <h4 className='odc-sales-step-title'>{t('STEP', 'Step')} {number}</h4>
      <p className='odc-sales-step-text'>{text}</p>
      {children}
      {images.length > 0 && (
        <div className='odc-sales-step-images' data-count={images.length}>
          {images.map(src => <img key={src} className='odc-sales-step-image' src={src} alt='' loading='lazy' />)}
        </div>
      )}
    </li>
  )
}

/** Paragraph(s) above the steps. */
export const GuideIntro = ({ children }) => <p className='odc-sales-guide-intro'>{children}</p>

/** A link to the third party's site, in a new tab, said in its accessible name. */
export const GuideExternalLink = ({ href, children }) => {
  const [, t] = useLanguage()
  return (
    <p className='odc-sales-guide-link'>
      <a
        href={href}
        target='_blank'
        rel='noopener noreferrer'
        aria-label={`${children} (${t('OPENS_IN_NEW_TAB', 'opens in a new tab')})`}
      >
        {children}
      </a>
    </p>
  )
}

/**
 * The store's ordering link with «Copy link» (G5-04): the real address at every width (G5-11, G5-12). While it loads, a skeleton;
 * without one (no website, no slug) a notice says why, with nothing to copy.
 * `link` is `{ url, loading }` from BusinessSalesChannel.
 */
export const StoreLink = ({ link }) => {
  const [, t] = useLanguage()
  if (!link?.url) {
    return (
      <div className='odc-sales-link'>
        {link?.loading
          ? <Skeleton />
          : (
            <InlineNotice tone='info'>
              {t('SALES_CHANNEL_NO_ADDRESS', 'This store has no website address yet, so there is no link to paste. It appears here once the store\'s website is ready.')}
            </InlineNotice>
            )}
      </div>
    )
  }
  return (
    <div className='odc-sales-link'>
      <span className='odc-sales-link-label'>{t('SALES_CHANNEL_STORE_LINK', 'Your store\'s ordering link')}</span>
      <code className='odc-sales-link-url' dir='ltr'>{link.url}</code>
      <CopyButton
        text={link.url}
        label={t('COPY_STORE_LINK', 'Copy link')}
        copyLabel={t('COPY_STORE_LINK', 'Copy link')}
        copiedLabel={t('COPIED', 'Copied')}
        failedLabel={t('COPY_FAILED_SELECT', 'Couldn\'t copy. Select the text and copy it.')}
      />
    </div>
  )
}
