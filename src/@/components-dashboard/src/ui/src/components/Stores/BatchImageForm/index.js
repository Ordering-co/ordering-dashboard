import React, { useState, useEffect, useRef } from 'react'
import BsCardImage from '@meronex/icons/bs/BsCardImage'
import {
  DragAndDrop,
  useLanguage,
  BatchImageForm as BatchImageFormController
} from '../../../../../index'
import { bytesConverter } from '../../../utils'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Alert } from '../../Shared'
import { Button } from '../../../styles'
import {
  Container,
  Title,
  UploadConditions,
  ConditionTitle,
  Conditions,
  BatchUploadForm,
  FormContainer,
  ImageIssue,
  BatchImages,
  SkeletonWrapper,
  UploadImageIconContainer,
  UploadImageIcon,
  ImageInput,
  Action,
  IssueBoard,
  UploadedImages
} from './styles'

// bugs E D16c: what the API answered when a product could not be updated, as messages the Alert can show. The
// answer is a list of texts, a text, or an Error; with no text in it, the generic error.
const getApiErrorMessages = (t, result) => {
  const items = Array.isArray(result) ? result : [typeof result?.message === 'string' ? result.message : result]
  const messages = items.map(item => translateApiMessage(t, item, '')).filter(Boolean)
  return messages.length > 0 ? messages : [t('ERROR_UNKNOWN', 'An error has occurred')]
}

const BatchImageFormUI = (props) => {
  const {
    onClose,
    formState,
    handleUploadImages,
    cleanFormState,
    products,
    updateProduct
  } = props
  const [, t] = useLanguage()
  const inputRef = useRef(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [productIds, setProductIds] = useState([])
  const [invalidImages, setInvalidImages] = useState([])

  const uploadConditions = [
    t('BATCH_IMAGE_UPLOAD_CONDITION_1', 'The images must have a valid PNG or JPG format.'),
    t('BATCH_IMAGE_UPLOAD_CONDITION_2', 'The name of the image must be the product ID.'),
    t('BATCH_IMAGE_UPLOAD_CONDITION_3', 'You can see the product ID in the spreadsheet mode.'),
    t('BATCH_IMAGE_UPLOAD_CONDITION_4', 'Don’t close or refresh the page.')
  ]

  const handleClick = (e) => {
    inputRef.current.click()
  }

  const validImages = (files) => {
    const invalidfileNames = []
    const validfiles = []
    if (files && files.length > 0) {
      Object.values(files).forEach(f => {
        const type = f.type.split('/')[0]
        if (type !== 'image') {
          setAlertState({
            open: true,
            content: [t('ERROR_ONLY_IMAGES', 'Only images can be accepted')]
          })
          invalidfileNames.push(f?.name)
          return
        }
        if (bytesConverter(f.size) > 2048) {
          setAlertState({
            open: true,
            content: [t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')]
          })
          invalidfileNames.push(f?.name)
          return
        }
        const nameWithoutExtension = f?.name.split('.')[0]
        if (productIds.indexOf(parseInt(nameWithoutExtension)) > -1) {
          validfiles.push(f)
        } else {
          invalidfileNames.push(f?.name)
        }
      })
    }
    setInvalidImages(invalidfileNames)
    return validfiles
  }

  const handleFiles = (files) => {
    const readyFiles = validImages(files)
    handleUploadImages(readyFiles)
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
    cleanFormState && cleanFormState({ result: { error: false } })
  }

  const handleImageChange = (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleFiles(e.target.files)
  }

  // bugs E D16a: this read the global `event` (window.event), which throws where the browser does not set it. Save sits
  // inside the form and would submit it, so it takes the click's own event to stop that.
  const handleSubmit = (e) => {
    e?.preventDefault()
    if (formState?.photos.length > 0 && updateProduct) {
      updateProduct()
    }
  }

  const handleZoneKeyDown = (e) => {
    // The hidden file input lives inside the zone; only a key pressed on the zone itself opens the picker.
    if (e.target !== e.currentTarget) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  // bugs E D16c: the controller keeps a failed update in formState.result but nothing showed it. It goes to the same
  // Alert as the local validations.
  useEffect(() => {
    if (formState?.result?.error) {
      setAlertState({
        open: true,
        content: getApiErrorMessages(t, formState.result.result)
      })
    }
  }, [formState?.result])

  useEffect(() => {
    if (products && products.length > 0) {
      const _productIds = []
      products.map(p => {
        _productIds.push(p?.id)
      })
      setProductIds(_productIds)
    }
  }, [products])

  useEffect(() => {
    if (formState?.endPoint) {
      onClose()
    }
  }, [formState])

  return (
    <>
      <Container>
        <Title>
          <h2>{t('BATCH_UPLOADE_FORM_TITLE', 'Upload images in batch')}</h2>
        </Title>
        <UploadConditions>
          <ConditionTitle><b>{t('BATCH_UPLOAD_CONDITION_TITLE', 'Here you can upload multiple product images.')}</b></ConditionTitle>
          <Conditions>
            {uploadConditions && uploadConditions.length > 0 && uploadConditions.map((list, i) => (
              <li key={i}>{list}</li>
            ))}
          </Conditions>
        </UploadConditions>
        <FormContainer>
          <BatchUploadForm>
            <ImageInput>
              {/* bugs E D21: the drop zone was a clickable div, out of the tab order. It stays the same div (it holds the
                  hidden file input and the drag-and-drop area, which a native <button> cannot) and is now a named button that Enter
                  or Space open; no new style (the browser's focus ring), so the governed styles do not change. */}
              <BatchImages
                role='button'
                tabIndex={0}
                aria-label={t('UPLOAD_IMAGES_BATCH', 'Upload images in batch')}
                aria-disabled={formState.loading || undefined}
                onClick={handleClick}
                onKeyDown={handleZoneKeyDown}
              >
                <input
                  type='file'
                  multiple
                  name='imagesArray'
                  ref={(e) => {
                    inputRef.current = e
                  }}
                  onChange={(e) => handleImageChange(e)}
                  onClick={e => e.stopPropagation()}
                  accept='image/png, image/jpeg, image/jpg'
                  disabled={formState.loading}
                  id='batch-images'
                  style={{ display: 'none' }}
                />
                <DragAndDrop onDrop={dataTransfer => handleFiles(dataTransfer.files)} accept='image/png, image/jpeg, image/jpg' disabled={formState.loading} className='multiple-image-uploader'>
                  {
                    formState.loading
                      ? (
                        <SkeletonWrapper>
                          <div className='loader-wrapper'>
                            <div className='loader' />
                          </div>
                          <p>{t('UPLODING', 'Uploading')}{'...'}</p>
                        </SkeletonWrapper>
                        )
                      : (
                        <UploadedImages>
                          {formState?.photos && formState?.photos.length > 0 && formState?.photos.map(photo => (
                            <img key={photo?.name} src={photo?.base64} alt='' loading='lazy' />
                          ))}
                        </UploadedImages>
                        )
                  }
                  <UploadImageIconContainer>
                    <UploadImageIcon>
                      {!formState.loading && formState?.photos.length === 0 && (
                        <>
                          <BsCardImage />
                          <p>{t('DRAG_AND_DROP', 'Drag and drop')}</p>
                        </>
                      )}
                    </UploadImageIcon>
                  </UploadImageIconContainer>
                </DragAndDrop>
              </BatchImages>
            </ImageInput>
            <Action>
              <Button
                borderRadius='8px'
                color='primary'
                disabled={formState?.photos.length === 0 || formState?.loading}
                onClick={(e) => handleSubmit(e)}
              >
                {t('SAVE', 'Save')}
              </Button>
            </Action>
          </BatchUploadForm>
          <ImageIssue>
            {/* bugs E D16b: this heading was English-only */}
            <p><b>{t('BATCH_IMAGES_ISSUES', 'Issues with images:')}</b></p>
            {invalidImages.length > 0
              ? (
              <IssueBoard>
                <ul>
                  {invalidImages.map((invalidImage, i) => (
                    <li key={i}>{invalidImage}</li>
                  ))}
                </ul>
              </IssueBoard>
                )
              : (
              <IssueBoard emptyboard />
                )}
          </ImageIssue>
        </FormContainer>
        <Alert
          title={t('UPLOAD_IMAGES_BATCH', 'Upload images in batch')}
          content={alertState.content}
          acceptText={t('ACCEPT', 'Accept')}
          open={alertState.open}
          onClose={() => closeAlert()}
          onAccept={() => closeAlert()}
          closeOnBackdrop={false}
        />
      </Container>
    </>
  )
}

export const BatchImageForm = (props) => {
  const batchImageFormProps = {
    ...props,
    UIComponent: BatchImageFormUI
  }
  return (
    <BatchImageFormController {...batchImageFormProps} />
  )
}
