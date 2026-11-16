import React from 'react'
import { useLanguage } from '../../../../../index'
import { useTheme } from 'styled-components'
import { SyncVideo } from '../BusinessSync/SyncVideo'
import '../BusinessSync/business-sync.css'

// redesign stores 3.D: Product classes (business-sync.css); «Send Form» is one link dressed as the primary button.
export const BusinessSyncBasic = () => {
  const theme = useTheme()
  const [, t] = useLanguage()

  return (
    <div className='stores-sync-provider'>
      <div className='stores-sync-logo'>
        <img src={theme.images.general.deliverect} alt='' />
      </div>
      <div className='stores-sync-about'>
        <p>{t('SYNC_DEC_FIRST', 'The easiest way to manage all your online orders.')}</p>
        <p dangerouslySetInnerHTML={{ __html: t('SYNC_DEC_SECOND', 'Deliverect integrates all your <span>online orders</span> to your <span>existing POS</span> or our <span>Delivery Manager app.</span> Restaurants large and small rely on Deliverect to reduce failures and order mistakes while speeding up order preparation.') }} />
      </div>
      <div className='stores-sync-start'>
        <h2>{t('GET_STARTED_RIGHT_HERE', 'Get started right here')}</h2>
        <p>{t('FILL_UP_THIS_FORM_TO_REQUEST_INFORMATION', 'Fill up this form to request more information')}</p>
        <a
          className='odc-btn'
          data-variant='primary'
          data-size='md'
          href='https://share.hsforms.com/1uGzNQ71IS2KXCAFC0mTBCg3neff'
          target='_blank'
          rel='noopener noreferrer'
        >
          {t('SEND_FORM', 'Send Form')}
        </a>
      </div>
      <SyncVideo
        title={t('DELIVERECT_VIDEO', 'Deliverect video')}
        src='https://www.youtube.com/embed/_v8nPmW_E-0?playlist=_v8nPmW_E-0&loop=1'
      />
    </div>
  )
}
