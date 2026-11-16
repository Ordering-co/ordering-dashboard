import React, { useId } from 'react'
import { useApi, useLanguage } from '../../../../index'
import { useInfoShare } from '../../contexts/InfoShareContext'
import { CatalogCard, IconButton, PageHeader, ProjectCode } from '../Shared/Product'
import { CircleHelp, ExternalLink, Menu as MenuIcon, MessageSquare } from '../Shared/Icon'
import './support.css'

// redesign SU-A (decisions D1–D5): /support on Product. A page header, a note that the team will ask for the project
// code (with the code and a Copy button when the project is known) and two cards, sales and technical support, each with one
// secondary link that opens in a new tab. The two destinations and their order are main's. It makes no request.

export const Support = () => {
  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const newTabId = useId()
  const project = ordering?.project
  // (#481): both destinations are Ordering.co pages, the same for every project (they used to hang off the project's subdomain)
  const options = [
    {
      key: 'sales',
      icon: MessageSquare,
      title: t('SUPPORT_SALES_TITLE', 'Sales team'),
      description: t('SUPPORT_SALES_DESCRIPTION', 'Pricing, plans, custom work and budgets.'),
      label: t('SUPPORT_CONTACT_SALES', 'Contact sales'),
      href: 'https://www.ordering.co/contact/'
    },
    {
      key: 'tech',
      icon: CircleHelp,
      title: t('SUPPORT_TECH_TITLE', 'Technical support'),
      description: t('SUPPORT_TECH_DESCRIPTION', "Setup, products, features, or something that isn't working."),
      label: t('SUPPORT_OPEN_HELP_CENTER', 'Open help center'),
      href: 'https://docs.ordering.co/'
    }
  ]

  return (
    <div className='odc-root odc-su-frame'>
      <PageHeader
        leading={isCollapse && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)} />}
        title={t('SUPPORT', 'Support')}
        description={t('SUPPORT_PAGE_DESCRIPTION', 'Get help with your Ordering project, or talk to our sales team.')}
      />

      <ProjectCode
        note={t('SUPPORT_PROJECT_NOTE', 'Our team will ask for your project code.')}
        project={project}
        codeLabel={t('PROJECT_CODE', 'Project code')}
        copy={{
          label: t('COPY_PROJECT_CODE', 'Copy project code'),
          copyLabel: t('COPY_BUTTON', 'Copy'),
          copiedLabel: t('COPIED', 'Copied'),
          failedLabel: t('CUSTOMERS_COPY_FAILED', "We couldn't copy. Select the text and copy it.")
        }}
      />

      <span id={newTabId} hidden>{t('OPENS_IN_NEW_TAB', 'opens in a new tab')}</span>

      <ul className='odc-su-grid' aria-label={t('SUPPORT', 'Support')}>
        {options.map(({ key, icon: Icon, title, description, label, href }) => (
          <CatalogCard
            key={key}
            data-option={key}
            media={<Icon className='odc-icon' aria-hidden='true' />}
            title={title}
            description={description}
            footer={href && (
              <a
                className='odc-btn'
                data-variant='secondary'
                data-size='md'
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                aria-describedby={newTabId}
              >
                <span>{label}</span>
                <ExternalLink className='odc-icon odc-icon-flip' aria-hidden='true' />
              </a>
            )}
          />
        ))}
      </ul>
    </div>
  )
}
