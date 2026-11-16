import React from 'react'

import { BuilderProductDomain as BuilderProductDomainController, useLanguage } from '../../../../../index'
import { ExternalLink, Globe } from '../../Shared/Icon'
import { getDomainUrl, getStatusLabel, getTypeLabel, getUntitledName } from '../utils'
import { BuilderWebDomains } from './BuilderWebDomains'
import './builder-detail.css'

// redesign B2: the website's General tab with --od-* tokens and Shared/Icon glyphs; «Open website» is a link drawn as a
// Product button (P/Button has no href: product.css styles `.odc-btn` on an anchor too). Same texts, links and new tabs as main.

/** A domain as a link that opens the website in a new tab. */
const DomainAnchor = ({ domain, t }) => (
  <a className='odc-bd-link' href={getDomainUrl(domain)} target='_blank' rel='noopener noreferrer'>
    {domain}
    <ExternalLink className='odc-icon' aria-hidden='true' />
    <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
  </a>
)

/** Puts `_name_` links into a translated text. */
const withLinks = (text, links, t) => Object.entries(links).reduce((parts, [placeholder, domain]) =>
  parts.flatMap(part => typeof part !== 'string'
    ? [part]
    : part.split(placeholder).reduce((pieces, piece, index) => index === 0
      ? [piece]
      : [...pieces, <DomainAnchor key={`${placeholder}-${index}`} domain={domain} t={t} />, piece], [])), [text])

/**
 * The detail of a website: it is only its site, so there are no app
 * tabs, builds or checks. It is online at its temporary domain from the
 * start, whatever its status, and at its own domain once that one is
 * active.
 */
const BuilderWebOverviewUI = (props) => {
  const { product, domainState } = props
  const [, t] = useLanguage()
  const temporary = domainState?.domain?.temporal_domain || product.temporal_domain
  const own = domainState?.domain?.own ?? null
  const ownActive = own?.status === 'active' ? own.name : null
  const main = ownActive || temporary

  return (
    <>
      {main && (
        <section className='odc-bd-online' aria-labelledby='builder-web-online'>
          <span className='odc-bd-online-icon' aria-hidden='true'><Globe className='odc-icon' /></span>
          <div className='odc-bd-online-text'>
            <h2 id='builder-web-online'>{t('BUILDER_WEB_ONLINE', 'Your website is online')}</h2>
            <p>
              {ownActive && temporary
                ? withLinks(t('BUILDER_WEB_ONLINE_OWN', 'It’s at _domain_ and at its temporary address, _temporary_. Stores come in an upcoming update.'), { _domain_: ownActive, _temporary_: temporary }, t)
                : withLinks(t('BUILDER_WEB_ONLINE_TEMPORARY', 'It’s at _domain_, a temporary address, even while it’s a draft. You can add your own domain below. Stores come in an upcoming update.'), { _domain_: main }, t)}
            </p>
          </div>
          <a
            className='odc-btn'
            data-variant='secondary'
            data-size='md'
            href={getDomainUrl(main)}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('BUILDER_OPEN_WEBSITE', 'Open website')}
            <span className='odc-sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
          </a>
        </section>
      )}

      <section className='odc-bd-card' aria-labelledby='builder-web-general'>
        <header className='odc-bd-card-head'>
          <h2 id='builder-web-general'>{t('BUILDER_TAB_GENERAL', 'General')}</h2>
        </header>
        <dl className='odc-bd-details'>
          <div>
            <dt>{t('BUILDER_NAME_IN_ORDERING', 'Name in Ordering')}</dt>
            <dd>{product.name?.trim() ? product.name : <span className='odc-bd-muted'>{getUntitledName('web', t)}</span>}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_TYPE', 'Type')}</dt>
            <dd>{getTypeLabel(product.product_type, t)}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_STATUS', 'Status')}</dt>
            <dd>{getStatusLabel(product.product_status, t)}</dd>
          </div>
        </dl>
      </section>

      <BuilderWebDomains {...props} temporary={temporary} />
    </>
  )
}

export const BuilderWebOverview = (props) => (
  <BuilderProductDomainController {...props} productId={props.product.id} UIComponent={BuilderWebOverviewUI} />
)
