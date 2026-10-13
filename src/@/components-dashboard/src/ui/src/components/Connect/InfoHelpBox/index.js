import React from 'react'
import MdcPlayCircle from '@meronex/icons/mdc/MdcPlayCircle'

import { useLanguage } from '../../../../../index'

import { Modal } from '../../Shared'
import { Button } from '../../../styles'
import {
  DataName,
  Description,
  VideoContainer,
  Content,
  ButtonsWrapper
} from './styles.js'

export const InfoHelpBox = (props) => {
  const {
    open,
    data,
    handleOnClose
  } = props

  const [, t] = useLanguage()
  const playVideo = () => {
    const vid = document.getElementById('dataVideo')
    vid.play()
  }

  const getYouTubeEmbedUrl = (url) => {
    const videoId = url.split('v=')[1]?.split('&')[0]
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`
  }

  return (
    <Modal
      width='50%'
      open={open}
      onClose={() => handleOnClose({ open: false, data: null })}
    >
      <Content>
        <DataName>
          <div>
            <p>{data?.name}</p>
          </div>
        </DataName>
        {data?.description && <Description>{data?.description}</Description>}
        {!data?.description && <Description>{t('HOW_IT_WORKS', 'How it works?')}</Description>}
        {!!data?.video && (
          <VideoContainer>
            {data.video.includes('youtube.com')
              ? (
                  <iframe
                    id="dataVideo"
                    className="w-100 custom-video"
                    width="100%"
                    height="300px"
                    src={getYouTubeEmbedUrl(data.video)}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )
              : (
                  <>
                    <MdcPlayCircle onClick={playVideo} />
                    <video muted id='dataVideo' className='w-100 custom-video' playsInline controls>
                      <source src={data?.video} type='video/mp4' />
                      <source src={data?.video} type='video/webm' />
                    </video>
                  </>
                )}
          </VideoContainer>
        )}
        {(data?.more_info || data?.support_url) && (
          <ButtonsWrapper>
            <Button
              style={{ marginRight: 10 }}
              color='primary'
              borderRadius='8px'
              onClick={() => window.open(data?.more_info ?? 'https://help.orderingplus.com/en/collections/9439739-settings', '_blank')}
            >
              {t('MORE_INFO', 'More info')}
            </Button>
            {!!data?.support_url && (
              <Button
                style={{ marginLeft: 10 }}
                color='secundary'
                borderRadius='8px'
                onClick={() => window.open(data?.support_url, '_blank')}
              >
                {t('SUPPORT_URL', 'Tech support')}
              </Button>
            )}
          </ButtonsWrapper>
        )}
      </Content>
    </Modal>
  )
}
