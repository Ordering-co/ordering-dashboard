import React, { useState } from 'react'
import { useTheme } from 'styled-components'
import { useLanguage, useSite } from '../../../../../index'
import { useStoreWebsiteUrl } from '../../../hooks/useWebsiteUrl'
import { useProjectState } from '../../../contexts/ProjectContext'
import { EDITOR_PANEL_WIDE_FROM } from '../../../../../utils/editorPanel'
import { Button, SectionSplit } from '../../Shared/Product'
import { BusinessSalesFacebook } from '../BusinessSalesFacebook'
import { BusinessSalesTiktok } from '../BusinessSalesTiktok'
import { BusinessSalesInstagram } from '../BusinessSalesInstagram'
import { BusinessSalesGoogle } from '../BusinessSalesGoogle'
import './sales-channels.css'

// redesign stores 5.15b (; decision 5, G5-10, G5-11, G5-12, G5-13): the sales channel guides of a store.
// - Nothing here connects to a third party (main's «Connect» opened a modal of placeholder text, then the guide): each card says what the
//   guide gets you and its button says «How to connect». The line under the title says it plainly.
// - The guide opens on P/SectionSplit, as the QR codes (5.15a): beside the list from 1000px of window (`EDITOR_PANEL_WIDE_FROM`,
//   where main opened its column) and in its place below that, with «‹ Back» (main opened an 80% modal with two X, and handed the
//   guides a slug they never read, so they showed a placeholder address). No width animation by element id.
// - The address is the store's one address, `useStoreWebsiteUrl` (widgets, QR, Overview), at every width and in every tab. While
//   it loads, a skeleton; without one, a notice in the step that needs it (main disabled the four buttons without a word).
// - The Facebook «Post» tab stays out (decision 8, ).

const CHANNEL_KEYS = ['facebook', 'tiktok', 'instagram', 'google_my_business']

const GUIDES = {
  facebook: BusinessSalesFacebook,
  tiktok: BusinessSalesTiktok,
  instagram: BusinessSalesInstagram,
  google_my_business: BusinessSalesGoogle
}

export const BusinessSalesChannel = (props) => {
  const { setIsExtendExtraOpen, business } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const [{ loading: sitesLoading }] = useSite()
  const [projectStatus] = useProjectState()
  const [selectedKey, setSelectedKey] = useState(null)

  const storeUrl = useStoreWebsiteUrl(business?.slug)
  // the address waits for the sites and for the project's plan (which says whether it has a website)
  const link = { url: storeUrl, loading: !storeUrl && (sitesLoading || !!projectStatus?.loading) }

  const channels = {
    facebook: {
      name: t('FACEBOOK', 'Facebook'),
      icon: theme.images.icons.facebook,
      description: t('SALES_CHANNEL_FACEBOOK_SUMMARY', 'Add a “Start order” button to your Facebook page that opens this store\'s ordering page.')
    },
    tiktok: {
      name: t('SALES_CHANNEL_TIKTOK', 'TikTok'),
      icon: theme.images.icons.tiktok,
      description: t('SALES_CHANNEL_TIKTOK_SUMMARY', 'Create a product catalog in TikTok Ads Manager so you can show this store\'s products on TikTok.')
    },
    instagram: {
      name: t('INSTAGRAM', 'Instagram'),
      icon: theme.images.icons.instagram,
      description: t('SALES_CHANNEL_INSTAGRAM_SUMMARY', 'Put this store\'s ordering link on your Instagram profile, as a link or as an “Order food” action button.')
    },
    google_my_business: {
      name: t('SALES_CHANNEL_GOOGLE', 'Google Business Profile'),
      icon: theme.images.icons.businessGoogle,
      description: t('SALES_CHANNEL_GOOGLE_SUMMARY', 'Add this store\'s ordering link to your Google Business Profile (formerly Google My Business), so people can order from Search and Maps.')
    }
  }

  const selected = selectedKey ? { key: selectedKey, ...channels[selectedKey] } : null
  const Guide = selected ? GUIDES[selected.key] : null

  const list = (
    <div className='odc-sales-pane'>
      <div className='odc-sales-intro'>
        <h1 className='odc-sales-title'>{t('SALES_CHANNELS_TITLE', 'Sales channels')}</h1>
        <p className='odc-sales-lead'>
          {t('SALES_CHANNELS_INTRO', 'Step-by-step guides to add this store\'s ordering link to your social and business profiles. Nothing is connected automatically: each guide shows where to paste the link.')}
        </p>
      </div>
      <ul className='odc-sales-cards' aria-label={t('SALES_CHANNELS_TITLE', 'Sales channels')}>
        {CHANNEL_KEYS.map(key => {
          const channel = channels[key]
          const active = key === selectedKey
          return (
            <li key={key} className='odc-sales-card' data-section-split-key={key} aria-current={active ? 'true' : undefined}>
              <div className='odc-sales-card-head'>
                <img className='odc-sales-card-icon' src={channel.icon} alt='' />
                <h2 className='odc-sales-card-name'>{channel.name}</h2>
              </div>
              <p className='odc-sales-card-text'>{channel.description}</p>
              <Button
                variant='secondary'
                aria-label={t('SALES_CHANNEL_HOW_TO_CONNECT_NAMED', 'How to connect _channel_').replace('_channel_', channel.name)}
                onClick={() => setSelectedKey(key)}
              >
                {t('SALES_CHANNEL_HOW_TO_CONNECT', 'How to connect')}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className='odc-root odc-sales'>
      <SectionSplit
        revealDetail // redesign bugs F row 6 (D5 of 5.18): stacked, the detail opens at its header
        splitFrom={EDITOR_PANEL_WIDE_FROM}
        open={!!selected}
        detailKey={selected?.key}
        onClose={() => setSelectedKey(null)}
        onExtendChange={value => setIsExtendExtraOpen?.(value)}
        detailTitle={selected?.name ?? ''}
        closeLabel={t('CLOSE', 'Close')}
        backLabel={t('BACK', 'Back')}
        list={list}
        detail={Guide ? <Guide key={selected.key} link={link} /> : null}
      />
    </div>
  )
}
