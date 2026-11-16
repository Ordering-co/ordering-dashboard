import React from 'react'
import { useLanguage } from '../../../../../index'
import { useTheme } from 'styled-components'
import { CircleCheck } from '../../Shared/Icon'
import { SyncVideo } from '../BusinessSync/SyncVideo'
import '../BusinessSync/business-sync.css'

// redesign stores 3.D: Product classes (business-sync.css); «Send Form» is one link dressed as the primary button.
export const BusinessSyncItsaCheckmate = () => {
  const theme = useTheme()
  const [, t] = useLanguage()

  const points = [
    t('ITSACHECKMATE_MENU_1', '86 items & modifiers'),
    t('ITSACHECKMATE_MENU_2', 'Turn on or off ordering platforms'),
    t('ITSACHECKMATE_MENU_3', 'Manage delivery hours'),
    t('ITSACHECKMATE_MENU_4', 'Add, edit, or delete items ')
  ]

  return (
    <div className='stores-sync-provider'>
      <div className='stores-sync-logo'>
        <img src={theme.images.general.ItsaCheckmateLogo} alt='' />
      </div>
      <div className='stores-sync-about'>
        <div
          className='stores-sync-lead'
          dangerouslySetInnerHTML={{ __html: t('ITSACHECKMATE_SUB_HEADER', 'Take control of all your <strong>Ordering Platform Menus</strong> in one place!') }}
        />
        <ul className='stores-sync-points'>
          {points.map((point, index) => (
            <li key={index}>
              <CircleCheck className='odc-icon' />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className='stores-sync-start'>
        <h2>{t('GET_STARTED_RIGHT_HERE', 'Get started right here')}</h2>
        <p>{t('FILL_UP_THIS_FORM_TO_REQUEST_INFORMATION', 'Fill up this form to request more information')}</p>
        <a
          className='odc-btn'
          data-variant='primary'
          data-size='md'
          href='https://share.hsforms.com/1vuXwaFtfTTeZf362zJgqSg3neff'
          target='_blank'
          rel='noopener noreferrer'
        >
          {t('SEND_FORM', 'Send Form')}
        </a>
      </div>
      <SyncVideo
        title={t('ITSACHECKMATE_VIDEO', 'ItsaCheckmate video')}
        src='https://www.youtube.com/embed/_caZDl4ZFp0?feature=oembed'
      />
    </div>
  )
}
