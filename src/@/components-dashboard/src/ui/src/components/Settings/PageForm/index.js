import React, { useEffect, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'

import $ from 'jquery'
import ReactSummernote from 'react-summernote'
import 'react-summernote/dist/react-summernote.css'
import 'bootstrap/js/dist/modal'
import 'bootstrap/js/dist/dropdown'
import 'bootstrap/js/dist/tooltip'
import 'bootstrap/dist/css/bootstrap.css'

import { useLanguage, PageForm as PageFormController } from '../../../../../index'

import { Button, Input, TextArea, Switch } from '../../../styles'
import { Alert, Modal } from '../../Shared'
import { ImageBox } from '../../MyProducts/AdvancedSettings/ImageBox'
import { InsertLink } from '../InsertLink'
import { InsertVideo } from '../InsertVideo'
import { InsertImage } from '../InsertImage'

import {
  PageContainer,
  Header,
  InputGroup,
  InputWrapper,
  WrapperEditor,
  ButtonGroupWrapper,
  WrapperImage
} from './styles'

const PageFormUI = (props) => {
  const {
    pageState,
    formState,
    imageListState,
    insertImageState,
    handleInsertImage,
    handleDeleteImage,
    handleChangeFormState,
    handleSavePage,
    selectedImageUrl,
    setSelectedImageUrl,
    handleCancel,
    isAddMode,
    handleAddPage,
    allowAutoUpload
  } = props

  const [, t] = useLanguage()
  const [openModal, setOpenModal] = useState(null)
  const [editorContext, setEditorContext] = useState(null)
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [pageContent, setPageContent] = useState(null)

  const insertLink = (context) => {
    const ui = $.summernote.ui
    const button = ui.button({
      contents: '<i class="note-icon-link"/>',
      tooltip: 'link',
      class: 'note-btn',
      click: () => {
        setEditorContext(context)
        context.invoke('editor.saveRange')
        setOpenModal('link')
      }
    })
    return button.render()
  }

  const handleRestoreEditor = () => editorContext.invoke('restoreRange')

  const insertImage = (context) => {
    const ui = $.summernote.ui
    const button = ui.button({
      contents: '<i class="note-icon-picture"/>',
      tooltip: 'picture',
      class: 'note-btn',
      click: () => {
        setEditorContext(context)
        context.invoke('editor.saveRange')
        setOpenModal('image')
      }
    })
    return button.render()
  }

  const insertVideo = (context) => {
    const ui = $.summernote.ui
    const button = ui.button({
      contents: '<i class="note-icon-video"/>',
      tooltip: 'video',
      class: 'note-btn',
      click: () => {
        setEditorContext(context)
        context.invoke('editor.saveRange')
        setOpenModal('video')
      }
    })
    return button.render()
  }

  const handleCloseModal = () => {
    setOpenModal(false)
    setEditorContext(null)
  }

  const handleImageChange = async ({ id, img }) => {
    const body = new FormData()
    body.append(id, img)
    handleSavePage(body)
  }

  useEffect(() => {
    if (!formState?.error) return
    setAlertState({
      open: true,
      content: formState?.error
    })
  }, [formState?.error])

  useEffect(() => {
    if (!pageContent) return
    handleChangeFormState('body', pageContent)
  }, [pageContent])

  return (
    <>
      <PageContainer>
        <Header>
          <h1>
            {isAddMode
              ? (
                  t('ADD_PAGE', 'Add page')
                )
              : (
              <>
                {
                  pageState.loading
                    ? <Skeleton width={100} />
                    : formState.changes?.name ?? pageState.page?.name ?? ''
                }
              </>
                )}
          </h1>
          {!isAddMode && (
            <>
              {pageState.loading
                ? (
                <Skeleton width={30} />
                  )
                : (
                <Switch
                  defaultChecked={pageState.page?.enabled}
                  onChange={enabled => handleChangeFormState('enabled', enabled)}
                />
                  )}
            </>
          )}
        </Header>
        <InputGroup>
          <InputWrapper>
            <label>
              {t('NAME', 'Name')}
            </label>
            <Input
              defaultValue={pageState.page?.name}
              onChange={e => handleChangeFormState('name', e.target.value)}
              placeholder={t('NAME', 'Name')}
            />
          </InputWrapper>
          <InputWrapper>
            <label>
              {t('SLUG', 'Slug')}
            </label>
            <Input
              defaultValue={formState.changes?.slug ?? pageState.page?.slug ?? ''}
              onChange={e => handleChangeFormState('slug', e.target.value.replace(/\s/g, ''))}
              placeholder={t('Slug', 'Slug')}
              onKeyPress={e => {
                if (e.which === 32) { e.preventDefault() }
              }}
            />
          </InputWrapper>
        </InputGroup>
        <InputGroup isAddMode={isAddMode}>
          <div className='seo-container'>
            <InputWrapper isFullWidth>
              <label>
                {t('SEO_TITLE', 'SEO Title')}
              </label>
              <Input
                defaultValue={pageState.page?.seo_title}
                onChange={e => handleChangeFormState('seo_title', e.target.value)}
                placeholder={t('SEO_TITLE', 'SEO Title')}
                maxLength={255}
              />
            </InputWrapper>
            <InputWrapper isFullWidth>
              <label>
                {t('SEO_DESCRIPTION', 'SEO Description')}
              </label>
              <TextArea
                defaultValue={formState.changes?.seo_description ?? pageState.page?.seo_description ?? ''}
                onChange={e => handleChangeFormState('seo_description', e.target.value)}
                placeholder={t('SEO_DESCRIPTION', 'SEO Description')}
                maxLength={1000}
              />
            </InputWrapper>
          </div>
          {!isAddMode && (
            <WrapperImage>
              <div>
                <div>
                  <label>{t('SEO_IMAGE', 'SEO Image')}</label>
                  <ImageBox
                    id={'seo_image'}
                    useAlertToast
                    disableCrop
                    editable
                    ratio={'1500 x 1500 px'}
                    photo={pageState.page?.seo_image}
                    path={'seo_image_file'}
                    requireDimentions={{ width: 1500, height: 1500 }}
                    fileSize={1024}
                    extensionFile={'png, jpg'}
                    handleChangePhoto={(img) => allowAutoUpload ? handleImageChange({ id: 'seo_image_file', img }) : handleChangeFormState('seo_image_file', img)}
                  />
                </div>
              </div>
            </WrapperImage>
          )}
        </InputGroup>
        <WrapperEditor>
          <ReactSummernote
            value={pageState.page?.body}
            placeholder={t('START_NEW_PAGE')}
            options={{
              height: 350,
              fontNames: ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New'],
              toolbar: [
                ['style', ['style']],
                ['font', ['bold', 'italic', 'underline', 'clear']],
                ['fontsize', ['fontsize']],
                ['color', ['color']],
                ['para', ['ul', 'paragraph']],
                ['table', ['table']],
                ['insert', ['insertLink', 'insertImage', 'insertVideo']],
                ['codeview', ['codeview']]
              ],
              buttons: {
                insertLink,
                insertImage,
                insertVideo
              }
            }}
            onChange={content => setPageContent(content)}
          />
        </WrapperEditor>
        <ButtonGroupWrapper>
          <Button
            borderRadius='8px'
            color='primary'
            disabled={Object.keys(formState.changes).length === 0}
            onClick={() => isAddMode ? handleAddPage() : handleSavePage()}
          >
            {t('ACCEPT', 'Accept')}
          </Button>
          <Button
            borderRadius='8px'
            color='secundaryDark'
            onClick={() => handleCancel()}
          >
            {t('CANCEL', 'Cancel')}
          </Button>
        </ButtonGroupWrapper>
      </PageContainer>
      {openModal === 'link' && (
        <Modal
          width='60%'
          open={openModal === 'link'}
          onClose={() => setOpenModal(null)}
        >
          <InsertLink
            editorContext={editorContext}
            handleRestoreEditor={handleRestoreEditor}
            onClose={() => handleCloseModal()}
          />
        </Modal>
      )}
      {openModal === 'video' && (
        <Modal
          width='60%'
          open={openModal === 'video'}
          onClose={() => setOpenModal(null)}
        >
          <InsertVideo
            editorContext={editorContext}
            handleRestoreEditor={handleRestoreEditor}
            onClose={() => handleCloseModal()}
          />
        </Modal>
      )}
      {openModal === 'image' && (
        <Modal
          width='60%'
          open={openModal === 'image'}
          onClose={() => setOpenModal(null)}
        >
          <InsertImage
            imageListState={imageListState}
            editorContext={editorContext}
            handleRestoreEditor={handleRestoreEditor}
            onClose={() => handleCloseModal()}
            insertImageState={insertImageState}
            handleInsertImage={handleInsertImage}
            handleDeleteImage={handleDeleteImage}
            selectedImageUrl={selectedImageUrl}
            setSelectedImageUrl={setSelectedImageUrl}
          />
        </Modal>
      )}
      <Alert
        title={t('BUSINESS', 'Business')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => setAlertState({ open: false, content: [] })}
        onAccept={() => setAlertState({ open: false, content: [] })}
        closeOnBackdrop={false}
      />
    </>
  )
}

export const PageForm = (props) => {
  const pageFormProps = {
    ...props,
    UIComponent: PageFormUI
  }
  return <PageFormController {...pageFormProps} />
}
