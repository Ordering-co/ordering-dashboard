import React, { useEffect, useState } from 'react'
import { useLanguage, PageForm as PageFormController } from '../../../../../index'

import { AlertDialog, Button, Skeleton, Switch, TextArea, TextField } from '../../Shared/Product'
import { RichHtmlEditor } from '../../Shared/RichHtmlEditor'
import { ImageBox } from '../../MyProducts/AdvancedSettings/ImageBox'

import { WrapperEditor } from './styles'
import './page-form.css'

// What a page with no content holds (the editor of before gave it; the API refuses an empty body).
const EMPTY_BODY = '<p><br></p>'

const PageFormUI = (props) => {
  const {
    pageState,
    formState,
    handleChangeFormState,
    handleSavePage,
    handleCancel,
    isAddMode,
    handleAddPage,
    allowAutoUpload
  } = props

  const [, t] = useLanguage()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  // The body shown in the editor: the page's, and what is typed. The editor says '' for an empty document; the form state keeps
  // EMPTY_BODY (what Summernote used to give), so an emptied page is still saved (the API asks for min:1) and an unedited one is not marked.
  const [body, setBody] = useState(pageState.page?.body ?? '')

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
    setBody(pageState.page?.body ?? '')
  }, [pageState.page?.body])

  const handleChangeBody = (html) => {
    setBody(html)
    handleChangeFormState('body', html === '' ? EMPTY_BODY : html)
  }

  // The fields stay uncontrolled (as in main); a new key per page id puts the loaded values in them when the page arrives after mount.
  const fieldsKey = pageState.page?.id ?? 'new'

  return (
    <>
      <div className='odc-root odc-pf'>
        <div className='odc-pf-head'>
          <h2 className='odc-pf-title'>
            {isAddMode
              ? t('ADD_PAGE', 'Add page')
              : pageState.loading
                ? <Skeleton size='40%' />
                : formState.changes?.name ?? pageState.page?.name ?? ''}
          </h2>
          {!isAddMode && (
            pageState.loading
              ? <Skeleton size='var(--od-x-switch-width)' />
              : (
                <Switch
                  defaultChecked={pageState.page?.enabled}
                  label={t('ENABLE', 'Enable')}
                  onCheckedChange={enabled => handleChangeFormState('enabled', enabled)}
                />
                )
          )}
        </div>
        <div className='odc-pf-row' key={fieldsKey}>
          <TextField
            label={t('NAME', 'Name')}
            defaultValue={formState.changes?.name ?? pageState.page?.name ?? ''}
            onChange={value => handleChangeFormState('name', value)}
            placeholder={t('NAME', 'Name')}
          />
          <TextField
            label={t('SLUG', 'Slug')}
            defaultValue={formState.changes?.slug ?? pageState.page?.slug ?? ''}
            onChange={value => handleChangeFormState('slug', value.replace(/\s/g, ''))}
            onKeyDown={e => { if (e.key === ' ') e.preventDefault() }}
            placeholder={t('SLUG', 'Slug')}
          />
        </div>
        <div className='odc-pf-row' data-add={isAddMode ? '' : undefined} key={`seo-${fieldsKey}`}>
          <div className='odc-pf-seo'>
            <TextField
              label={t('SEO_TITLE', 'SEO Title')}
              defaultValue={formState.changes?.seo_title ?? pageState.page?.seo_title ?? ''}
              onChange={value => handleChangeFormState('seo_title', value)}
              placeholder={t('SEO_TITLE', 'SEO Title')}
              maxLength={255}
            />
            <TextArea
              label={t('SEO_DESCRIPTION', 'SEO Description')}
              rows={5}
              defaultValue={formState.changes?.seo_description ?? pageState.page?.seo_description ?? ''}
              onChange={value => handleChangeFormState('seo_description', value)}
              placeholder={t('SEO_DESCRIPTION', 'SEO Description')}
              maxLength={1000}
            />
          </div>
          {!isAddMode && (
            <div className='odc-pf-image'>
              <span className='odc-pf-label'>{t('SEO_IMAGE', 'SEO Image')}</span>
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
          )}
        </div>
        <WrapperEditor>
          <RichHtmlEditor
            label={t('CONTENT', 'Content')}
            placeholder={t('START_NEW_PAGE', 'Start writing your page…')}
            value={body === EMPTY_BODY ? '' : body}
            onChange={handleChangeBody}
          />
        </WrapperEditor>
        <div className='odc-pf-actions'>
          <Button
            variant='primary'
            disabled={Object.keys(formState.changes ?? {}).length === 0}
            onClick={() => isAddMode ? handleAddPage() : handleSavePage()}
          >
            {t('ACCEPT', 'Accept')}
          </Button>
          <Button onClick={() => handleCancel()}>
            {t('CANCEL', 'Cancel')}
          </Button>
        </div>
      </div>
      <AlertDialog
        open={alertState.open}
        title={t('BUSINESS', 'Business')}
        content={alertState.content}
        confirmLabel={t('ACCEPT', 'Accept')}
        closeLabel={t('CLOSE', 'Close')}
        onClose={() => setAlertState({ open: false, content: [] })}
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
