import React from 'react'
import MdcPlayCircle from '@meronex/icons/mdc/MdcPlayCircle'

import { useLanguage } from '../../../../../index'

import { Modal } from '../../Shared'
import { Button } from '../../../styles'

import {
  CategoryName,
  Description,
  VideoContainer,
  Content,
  ButtonsWrapper
} from './styles.js'

export const InfoHelpBox = (props) => {
  const {
    open,
    category,
    handleOnClose
  } = props

  const [, t] = useLanguage()
  const playVideo = () => {
    const vid = document.getElementById('categoryVideo')
    vid.play()
  }

  return (
    <Modal
      width='50%'
      open={open}
      onClose={() => handleOnClose({ open: false, category: null })}
    >
      <Content>
        <CategoryName>
          <div>
            <p>{category?.name}</p>
          </div>
        </CategoryName>
        {category?.description && <Description style={{ paddingTop: 10 }}>{category?.description}</Description>}
        {!!category?.video && (
          <VideoContainer>
            <MdcPlayCircle onClick={playVideo} />
            <video muted id='categoryVideo' className='w-100 custom-video' playsInline controls>
              <source src={category?.video} type='video/mp4' />
              <source src={category?.video} type='video/webm' />
            </video>
          </VideoContainer>
        )}
        <ButtonsWrapper>
          <Button
            style={{ marginRight: 10 }}
            color='primary'
            borderRadius='8px'
            onClick={() => window.open(category?.more_info ?? 'https://help.orderingplus.com/en/collections/9439739-settings', '_blank')}
          >
            {t('MORE_INFO', 'More info')}
          </Button>
          {!!category?.support_url && (
            <Button
              style={{ marginLeft: 10 }}
              color='secundary'
              borderRadius='8px'
              onClick={() => window.open(category?.support_url, '_blank')}
            >
              {t('SUPPORT_URL', 'Tech support')}
            </Button>
          )}
        </ButtonsWrapper>
      </Content>
    </Modal>
  )
}
