import React from 'react'
import { BoxArrowUpRight, Globe } from 'react-bootstrap-icons'

import { BuilderProductDomain as BuilderProductDomainController, useLanguage } from '../../../../../index'
import { getDomainUrl, getStatusLabel, getTypeLabel, getUntitledName } from '../utils'
import { Card, DetailsList, DomainLink, MutedText, WebOnlineCard } from '../styles'
import { BuilderWebDomains } from './BuilderWebDomains'

/** A domain as a link that opens the website in a new tab. */
const DomainAnchor = ({ domain, t }) => (
  <DomainLink href={getDomainUrl(domain)} target='_blank' rel='noopener noreferrer'>
    {domain}
    <BoxArrowUpRight aria-hidden='true' />
    <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
  </DomainLink>
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
        <WebOnlineCard aria-labelledby='builder-web-online'>
          <span aria-hidden='true'><Globe /></span>
          <div>
            <h2 id='builder-web-online'>{t('BUILDER_WEB_ONLINE', 'Your website is online')}</h2>
            <p>
              {ownActive && temporary
                ? withLinks(t('BUILDER_WEB_ONLINE_OWN', 'It’s at _domain_ and at its temporary address, _temporary_. Theme and stores come in an upcoming update.'), { _domain_: ownActive, _temporary_: temporary }, t)
                : withLinks(t('BUILDER_WEB_ONLINE_TEMPORARY', 'It’s at _domain_, a temporary address, even while it’s a draft. You can add your own domain below. Theme and stores come in an upcoming update.'), { _domain_: main }, t)}
            </p>
          </div>
          <a
            className='btn btn-outline-primary'
            style={{ borderRadius: 8 }}
            href={getDomainUrl(main)}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('BUILDER_OPEN_WEBSITE', 'Open website')}
            <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
          </a>
        </WebOnlineCard>
      )}

      <Card aria-labelledby='builder-web-general'>
        <header>
          <h2 id='builder-web-general'>{t('BUILDER_TAB_GENERAL', 'General')}</h2>
        </header>
        <DetailsList>
          <div>
            <dt>{t('BUILDER_NAME_IN_ORDERING', 'Name in Ordering')}</dt>
            <dd>{product.name?.trim() ? product.name : <MutedText>{getUntitledName('web', t)}</MutedText>}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_TYPE', 'Type')}</dt>
            <dd>{getTypeLabel(product.product_type, t)}</dd>
          </div>
          <div>
            <dt>{t('BUILDER_STATUS', 'Status')}</dt>
            <dd>{getStatusLabel(product.product_status, t)}</dd>
          </div>
        </DetailsList>
      </Card>

      <BuilderWebDomains {...props} temporary={temporary} />
    </>
  )
}

export const BuilderWebOverview = (props) => (
  <BuilderProductDomainController {...props} productId={props.product.id} UIComponent={BuilderWebOverviewUI} />
)
