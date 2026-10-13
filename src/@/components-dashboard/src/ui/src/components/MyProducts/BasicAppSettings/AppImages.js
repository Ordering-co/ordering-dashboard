import React, { useEffect, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { ImageContainerList, ImageSection, ImageSectionTitle, ImageWrapSection, InnerBlock, InputFormWrapper, TitleWrapper } from './styles'
import { ImageBox } from '../AdvancedSettings/ImageBox'

export const AppImages = (props) => {
  const {
    title,
    generalImages,
    iconsImages,
    notificationsImages,
    splashesAndroid,
    splashesiOS,
    updateImages,
    app
  } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  const [imagesState, setImagesState] = useState({ loading: false, changes: {}, error: null })

  const resourcesImages = {
    arrays: [
      {
        images: generalImages,
        title: t('RESOURCES_GENERAL_IMAGES', 'General')
      },
      {
        images: iconsImages,
        title: t('RESOURCES_ICONS', 'Icons')
      },
      {
        images: notificationsImages,
        title: t('RESOURCES_NOTIFICATIONS', 'Notifications')
      },
      {
        images: splashesAndroid,
        title: t('RESOURCES_ANDROID_SPLASH', 'Android Splash')
      },
      {
        images: splashesiOS,
        title: t('RESOURCES_ICONS_IOS_SPLASH', 'iOS Splash')
      }
    ]
  }

  const handleChange = async ({ id, img }) => {
    try {
      setImagesState({ ...imagesState, loading: true, error: null })
      const body = new FormData()
      body.append('source_file', img)

      const { error, result } = await updateImages({ id, body })
      setImagesState({
        ...imagesState,
        loading: false,
        error: error ? result[0] : null,
        changes: {}
      })
      if (!error) {
        showToast(ToastType.Success, t('CORRECTLY_SAVED_IMAGE', 'Correctly saved image'))
      }
    } catch (err) {
      setImagesState({
        ...imagesState,
        loading: false,
        error: err?.message ?? err
      })
    }
  }

  const applyImagesFilter = (image) => {
    if (app?.base?.code === 'app_franchises_x') {
      const filterTargetPaths = ['empty-active-orders.png', 'not-found.png', 'empty-past-orders.png', 'business_list_banner.jpg', 'curbside.png', 'delivery.png', 'drivethru.png', 'pickup.png', 'eatin.png', 'category-all.png']
      return !filterTargetPaths.some(filePath => image?.target_path?.includes(filePath))
    }
    return true
  }

  useEffect(() => {
    if (imagesState.error) {
      showToast(ToastType.Error, t(imagesState.error.replace(/ /g, '_').toUpperCase(), imagesState.error))
    }
  }, [imagesState.error])

  return (
    <InputFormWrapper>
      <InnerBlock>
        {generalImages?.length && (
          <TitleWrapper>
            <h4>{title ?? t('GENERAL_IMAGES_APP_SETTINGS', 'Images')}</h4>
          </TitleWrapper>
        )}
        {!generalImages?.length && (<h4 style={{ marginTop: 5 }}>{t('RESOURCES', 'Resources')}</h4>)}
        <ImageContainerList>
          {resourcesImages.arrays.map((item, i) => !!item.images?.length && (
            <ImageWrapSection key={i}>
              <ImageSectionTitle>{item.title}</ImageSectionTitle>
              <ImageSection>
                {item.images.filter(applyImagesFilter).map(image => (
                  <ImageBox
                    key={image.id}
                    id={image.id}
                    useAlertToast
                    disableCrop
                    editable={image.editable}
                    title={image.name}
                    ratio={`${image?.file_rules?.width} x ${image?.file_rules?.height} px`}
                    photo={image?.public_url}
                    path={image?.target_path}
                    requireDimentions={image?.file_rules && { width: image?.file_rules?.width, height: image?.file_rules?.height }}
                    isResetImg={!!imagesState.error}
                    fileSize={Math.max(image?.file_rules?.max_size || 0, 3072)}
                    extensionFile={image?.file_rules?.extension}
                    mimeTypeAccept={image?.file_rules?.mimetype}
                    handleClick={() => setImagesState({ ...imagesState, error: null })}
                    handleChangePhoto={(img) => handleChange({ id: image.id, img })}
                  />
                ))}
              </ImageSection>
            </ImageWrapSection>
          ))}
        </ImageContainerList>
      </InnerBlock>
    </InputFormWrapper>
  )
}
