import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, IconButton, PageHeader } from '../../Shared/Product'
import { formatCount } from './campaignData'
import { Menu as MenuIcon, Plus, RefreshCw } from '../../Shared/Icon'
import './campaigns-page.css'

// redesign CA-B3 (decisions 1 and 2): the page header of the campaigns list: title and count, «Refresh» (secondary, always visible, as in
// main), «New campaign» (the one primary action) and, for level 0 only, the help line with the link to customer support.
//
// @param {number}   [props.count]        Campaigns in the list; the count is not drawn while it is unknown.
// @param {Function} props.onNew          `() => void`: opens the panel to create a campaign.
// @param {Function} props.onRefresh      `() => void`: reloads the page the list is on.
// @param {boolean}  [props.refreshing]   The reload is running: «Refresh» keeps its words, shows the spinner and answers no second click.
// @param {string}   [props.supportUrl]   The host passes it only for level 0, as today's header did; without it there is no description.
// @param {Function} [props.onOpenMenu]   Given while the sidebar is collapsed: the menu button goes before the title (today's `isCollapse`).
//
// The words of «Refresh» and «New campaign» are clipped, not removed, when the header is narrow (campaigns-page.css): the accessible name
// stays, and every button carries its `title`.
export const CampaignsHeader = ({ count, onNew, onRefresh, refreshing = false, supportUrl, onOpenMenu }) => {
  const [languageState, t] = useLanguage()
  const known = count != null && count !== '' && Number.isFinite(Number(count))
  // redesign CA-R1 (live check): the count is written in the number format of the person's language; the plural uses the number
  const shown = known ? formatCount(count, languageState?.language?.code) : null
  const countLabel = Number(count) === 1
    ? t('CAMPAIGNS_COUNT_ONE', '1 campaign')
    : t('CAMPAIGNS_COUNT_OTHER', '_count_ campaigns').replace('_count_', () => shown ?? String(count))

  return (
    <PageHeader
      className='odc-campaign-head'
      leading={onOpenMenu && <IconButton icon={MenuIcon} label={t('OPEN_MENU', 'Open menu')} onClick={onOpenMenu} />}
      title={t('CAMPAIGNS_TITLE', 'Campaigns')}
      count={known ? shown : undefined}
      countLabel={known ? countLabel : undefined}
      description={supportUrl
        ? (
          <>
            {t('MARKETING_INFO', 'Create campaigns to reach your customer with news, offers and new products. Need help with the set-up? Contact our team here:')}
            {' '}
            <a className='odc-campaign-support' href={supportUrl} target='_blank' rel='noopener noreferrer'>
              {t('CUSTOMER_SUPPORT', 'Customer support')}
            </a>
          </>
          )
        : undefined}
      actions={(
        <Button
          className='odc-campaign-refresh'
          icon={RefreshCw}
          busy={refreshing}
          title={t('REFRESH', 'Refresh')}
          onClick={onRefresh}
        >
          {t('REFRESH', 'Refresh')}
        </Button>
      )}
      primaryAction={(
        <Button variant='primary' icon={Plus} title={t('CAMPAIGNS_NEW', 'New campaign')} onClick={onNew}>
          <span data-collapse-label=''>{t('CAMPAIGNS_NEW', 'New campaign')}</span>
        </Button>
      )}
    />
  )
}
