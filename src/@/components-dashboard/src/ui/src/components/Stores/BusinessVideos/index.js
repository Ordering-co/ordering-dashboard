import React, { useEffect, useRef, useState } from 'react'
import { useLanguage, BusinessGallery as BusinessGalleryController } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Plus, Trash2, Video as VideoIcon } from '../../Shared/Icon'
import { Button, ConfirmDialog, EmptyState, IconButton, InlineNotice, TextField } from '../../Shared/Product'
import './business-videos.css'

// redesign stores 5.3 (; G2-15, G2-16, G2-17, G2-18): the store's video links on Product. Adding and deleting are
// immediate, as before. The URL field has a label and only takes an http(s) link (D6); «Add» is off while it is empty or saving.
// A failed add says why under the field; a failed delete says why above the list. Delete asks first (P/ConfirmDialog). Every
// notice belongs to the action that caused it, so none re-opens on an unrelated change.

const isHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname
  } catch {
    return false
  }
}

const withCount = (template, values) => Object.entries(values)
  .reduce((result, [key, value]) => result.split(`_${key}_`).join(String(value)), template)

const BusinessVideosUI = (props) => {
  const {
    businessVideos,
    adding,
    deletingId,
    handleAddGalleryItem,
    handleDeleteBusinessGallery
  } = props
  const [, t] = useLanguage()

  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])
  const inputRef = useRef(null)
  const [url, setUrl] = useState('')
  const [fieldError, setFieldError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  const value = url.trim()

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!value || adding) return
    setDeleteError(null)
    if (!isHttpUrl(value)) {
      setFieldError(t('GALLERY_VIDEO_URL_INVALID', 'Enter a link that starts with http:// or https://'))
      inputRef.current?.focus()
      return
    }
    setFieldError(null)
    const result = await handleAddGalleryItem({ video: value })
    if (!mounted.current) return
    if (result?.ok) setUrl('')
    else {
      setFieldError(translateApiMessage(t, result?.error, t('GALLERY_VIDEO_ADD_FAILED', 'The video could not be added.')))
      inputRef.current?.focus()
    }
  }

  const confirmDelete = async () => {
    const id = confirmId
    const result = await handleDeleteBusinessGallery(id)
    if (!mounted.current) return
    setConfirmId(null)
    if (!result?.ok) {
      setDeleteError(translateApiMessage(t, result?.error, t('GALLERY_VIDEO_DELETE_FAILED', 'The video could not be deleted.')))
    }
  }

  const confirmVideo = businessVideos.find(video => video.id === confirmId)

  return (
    <div className='odc-videos'>
      {deleteError && <InlineNotice tone='danger'>{deleteError}</InlineNotice>}

      {businessVideos.length === 0
        ? (
          <EmptyState
            icon={VideoIcon}
            title={t('GALLERY_NO_VIDEOS', 'No videos yet')}
            description={t('GALLERY_NO_VIDEOS_HINT', 'Add a link to a video of the store.')}
          />
          )
        : (
          <ul className='odc-videos-list' aria-label={t('VIDEOS', 'Videos')}>
            {businessVideos.map((video, index) => (
              <li key={video.id} className='odc-videos-row'>
                {/* only an http(s) address is a link: anything else saved elsewhere (javascript:, data:) stays text (review 2) */}
                {isHttpUrl(video.video)
                  ? (
                    <a className='odc-videos-link' href={video.video} target='_blank' rel='noopener noreferrer'>
                      <bdi>{video.video}</bdi>
                    </a>
                    )
                  : <span className='odc-videos-link'><bdi>{video.video}</bdi></span>}
                <IconButton
                  icon={Trash2}
                  label={withCount(t('GALLERY_DELETE_VIDEO_N', 'Delete video _number_'), { number: index + 1 })}
                  variant='ghost'
                  size='sm'
                  disabled={deletingId != null}
                  onClick={() => { setDeleteError(null); setConfirmId(video.id) }}
                />
              </li>
            ))}
          </ul>
          )}

      <form className='odc-videos-add' noValidate onSubmit={handleSubmit}>
        <div className='odc-videos-field'>
          <TextField
            ref={inputRef}
            type='url'
            inputMode='url'
            label={t('VIDEO_URL', 'Video url')}
            hint={t('GALLERY_VIDEO_URL_HINT', 'A link to the video, for example on YouTube or Vimeo.')}
            placeholder='https://'
            value={url}
            error={fieldError || undefined}
            disabled={adding}
            autoComplete='off'
            spellCheck={false}
            onChange={(next) => { setUrl(next ?? ''); setFieldError(null) }}
          />
        </div>
        <Button
          type='submit'
          variant='primary'
          icon={Plus}
          busy={adding}
          disabled={!value}
          className='odc-videos-submit'
        >
          {t('ADD', 'Add')}
        </Button>
      </form>

      <ConfirmDialog
        open={confirmVideo != null}
        title={t('GALLERY_DELETE_VIDEO_TITLE', 'Delete this video?')}
        confirmLabel={t('GALLERY_DELETE_VIDEO_CONFIRM', 'Delete video')} // redesign tanda AB (S-5): verb + object
        cancelLabel={t('CANCEL', 'Cancel')}
        closeLabel={t('CLOSE', 'Close')}
        busy={deletingId != null}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmId(null)}
      >
        {confirmVideo && (
          <div className='odc-videos-confirm'>
            <p><bdi className='odc-videos-confirm-url'>{confirmVideo.video}</bdi></p>
            <p>{t('GALLERY_DELETE_VIDEO_BODY', 'It is removed from the store\'s gallery right away.')}</p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}

export const BusinessVideos = (props) => {
  const businessGalleryProps = {
    ...props,
    isVideoGallery: true,
    UIComponent: BusinessVideosUI
  }
  return <BusinessGalleryController {...businessGalleryProps} />
}
