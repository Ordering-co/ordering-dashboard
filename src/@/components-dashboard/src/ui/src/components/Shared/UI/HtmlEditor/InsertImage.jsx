import React, { useId, useState, useRef, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import {
  useLanguage,
  DragAndDrop,
  ExamineClick
} from '../../../../../../index'
import { Button } from '../../../../styles/Buttons'
import { Alert, Confirm } from '../../Confirm'
import { Image as BiImage, X as XLg } from '../../Icon'
import { Input } from '../../../../styles/Inputs'
import { bytesConverter } from '../../../../utils/bytesConverter'

import {
  InsertImageContainer,
  ImageListContainer,
  WrapperImage,
  WrapperInput,
  NewImage,
  Image,
  ImageChoiceButton,
  SkeletonWrapper,
  UploadImageIconContainer,
  UploadImageIcon,
  CloseButton
} from './insert-image-styles'

export const InsertImage = (props) => {
  const {
    imageListState,
    editorContext,
    onClose,
    handleRestoreEditor,
    insertImageState,
    handleInsertImage,
    handleDeleteImage,
    selectedImageUrl,
    setSelectedImageUrl
  } = props
  const [, t] = useLanguage()
  const [imageUrl, setImageUrl] = useState(null)
  const imageInputRef = useRef(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [confirm, setConfirm] = useState({ open: false, content: null, handleOnAccept: null })
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const urlId = `${dialogId}-url`
  const previewSource = insertImageState?.change?.source

  const handleInsertClick = () => {
    handleRestoreEditor()
    editorContext.invoke('editor.insertImage', imageUrl)
    onClose()
  }

  const handleClickImage = (type) => {
    imageInputRef.current.click()
  }

  const handleFiles = (files) => {
    if (files.length === 1) {
      const type = files[0].type.split('/')[0]
      if (type !== 'image') {
        setAlertState({
          open: true,
          content: [t('ERROR_ONLY_IMAGES', 'Only images can be accepted')]
        })
        return
      }

      if (bytesConverter(files[0]?.size) > 2048) {
        setAlertState({
          open: true,
          content: [t('IMAGE_MAXIMUM_SIZE', 'The maximum image size is 2 megabytes')]
        })
        return
      }

      setConfirm({
        open: true,
        content: t('QUESTION_ADD_GALLERY_IMAGE', 'Are you sure that you want to add this gallery image?'),
        handleOnAccept: () => {
          setConfirm({ ...confirm, open: false })
          handleInsertImage(files[0])
        }
      })
    }
  }

  const onDeleteClick = (imageId) => {
    setConfirm({
      open: true,
      content: t('QUESTION_DELETE_GALLERY_ITEM', 'Are you sure that you want to delete this image?'),
      handleOnAccept: () => {
        setConfirm({ ...confirm, open: false })
        handleDeleteImage(imageId)
      }
    })
  }

  useEffect(() => {
    setImageUrl(selectedImageUrl)
  }, [selectedImageUrl])

  const handleUploadKeyDown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    if (!insertImageState.loading) handleClickImage()
  }

  return (
    <InsertImageContainer role='group' aria-labelledby={titleId}>
      <h1 id={titleId}>{t('INSERT_IMAGE', 'Insert image')}</h1>
      <WrapperInput>
        <label htmlFor={urlId}>{t('IMAGE_URL', 'Image URL')}</label>
        <Input
          id={urlId}
          data-editor-input='image-url'
          value={imageUrl || ''}
          onChange={e => setImageUrl(e.target.value)}
        />
      </WrapperInput>
      <Button
        type='button'
        data-editor-action='insert-image'
        borderRadius='8px'
        color='primary'
        onClick={() => handleInsertClick()}
      >
        {t('INSERT', 'Insert')}
      </Button>
      <NewImage>
        <Image
          role='button'
          tabIndex={insertImageState.loading ? -1 : 0}
          aria-label={t('DRAG_DROP_IMAGE_HERE', 'Put your image here')}
          aria-disabled={Boolean(insertImageState.loading)}
          onClick={() => handleClickImage()}
          onKeyDown={handleUploadKeyDown}
          isImage={previewSource}
        >
          <ExamineClick onFiles={handleFiles} childRef={(e) => { imageInputRef.current = e }} accept='image/png, image/jpeg, image/jpg' disabled={insertImageState.loading}>
            <DragAndDrop onDrop={dataTransfer => handleFiles(dataTransfer.files)} accept='image/png, image/jpeg, image/jpg' disabled={insertImageState.loading}>
              {
                insertImageState.loading
                  ? (<SkeletonWrapper><Skeleton /></SkeletonWrapper>)
                  : previewSource && <img src={previewSource} alt={t('INSERT_IMAGE', 'Insert image')} loading='lazy' />
              }
              <UploadImageIconContainer>
                <UploadImageIcon>
                  <BiImage />
                  <span>{t('DRAG_DROP_IMAGE_HERE', 'Put your image here')}</span>
                </UploadImageIcon>
              </UploadImageIconContainer>
            </DragAndDrop>
          </ExamineClick>
        </Image>
      </NewImage>
      <ImageListContainer>
        {imageListState.images.map(image => (
          <WrapperImage
            key={image.id}
            data-image-id={image.id}
            isSelected={selectedImageUrl === image?.source}
            onClick={() => setSelectedImageUrl(image?.source)}
          >
            <ImageChoiceButton
              type='button'
              data-image-id={image.id}
              aria-label={`${t('INSERT_IMAGE', 'Insert image')}: ${image.id}`}
            >
              <img src={image?.source} alt='' />
            </ImageChoiceButton>
            <CloseButton
              type='button'
              data-image-id={image.id}
              aria-label={`${t('DELETE', 'Delete')} ${t('INSERT_IMAGE', 'Insert image')}: ${image.id}`}
              onClick={() => onDeleteClick(image.id)}
            >
              <XLg aria-hidden='true' />
            </CloseButton>
          </WrapperImage>
        ))}
      </ImageListContainer>
      <Alert
        title={t('WEB_APPNAME', 'ORDERING')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
      <Confirm
        title={t('WEB_APPNAME', 'Ordering')}
        content={confirm.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={confirm.open}
        onClose={() => setConfirm({ ...confirm, open: false })}
        onCancel={() => setConfirm({ ...confirm, open: false })}
        onAccept={confirm.handleOnAccept}
        closeOnBackdrop={false}
      />
    </InsertImageContainer>
  )
}
