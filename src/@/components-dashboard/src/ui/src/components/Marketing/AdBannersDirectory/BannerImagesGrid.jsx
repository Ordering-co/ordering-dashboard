import React, { useEffect, useId, useRef, useState } from 'react'

import { useLanguage, useUtils } from '../../../../../index'
import { Plus } from '../../Shared/Icon'
import { BannerImageDialog } from './BannerImageDialog'
import './banner-panel.css'

// redesign AB-B3 (decision 2, decision 3A; defects M-AB15, M-AB16): the images of a banner as a grid of tiles. Each tile is a native
// <button> named «Edit image N of <banner>» (today a div with an onClick) with the thumbnail in the ratio of the position and a caption
// that says what the image links to, which today is only seen by opening it. A last tile adds one. A tile opens the image dialog (AB-B4)
// with that image (`null` = add); closing it returns the focus to the tile that opened it.
// Props: `banner`, `images` (the controller's `bannerItemsState.images`: videos stay hidden, as today), `position` (D/bannerPositions
// object), and the controller's `handleDeleteBannerItem`, `handleUpdateBannerItem`, `handleSuccessBannerItemAdd`.

const ADD_KEY = 'add'

// The path (with its query) of a stored link, whether the API stored an absolute url or a path
const pathOf = (url) => {
  if (typeof url !== 'string' || !url.trim()) return ''
  try {
    const parsed = new URL(url, 'https://link.invalid')
    return `${parsed.pathname}${parsed.search}`
  } catch (error) {
    return url
  }
}

const Thumbnail = ({ src }) => {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  return failed || !src
    ? <span className='odc-banners-thumb' data-failed='' />
    : <img className='odc-banners-thumb' src={src} alt='' loading='lazy' onError={() => setFailed(true)} />
}

export const BannerImagesGrid = ({
  banner,
  images,
  position,
  handleDeleteBannerItem,
  handleUpdateBannerItem,
  handleSuccessBannerItemAdd
}) => {
  const [, t] = useLanguage()
  const [{ optimizeImage } = {}] = useUtils() || []
  const captionBase = useId()
  const [dialog, setDialog] = useState({ open: false, image: null, key: ADD_KEY })
  const tiles = useRef({}) // key (image id or 'add') → the tile's button
  const restoreFocus = useRef(false)

  const list = Array.isArray(images) ? images : []
  const bannerName = banner?.name ?? ''
  const ratio = position?.aspectRatio ?? 1
  const shape = ratio > 1 ? 'wide' : 'square'

  const openDialog = (image) => {
    setDialog({ open: true, image, key: image ? image.id : ADD_KEY })
  }

  const closeDialog = () => {
    restoreFocus.current = true
    setDialog(current => ({ ...current, open: false }))
  }

  // Back to the tile that opened the dialog; to «Add image» when that image is gone (it was deleted)
  useEffect(() => {
    if (dialog.open || !restoreFocus.current) return
    restoreFocus.current = false
    const opener = tiles.current[dialog.key]
    const target = opener && opener.isConnected ? opener : tiles.current[ADD_KEY]
    target?.focus()
  }, [dialog])

  const caption = (action) => {
    if (!action) return null
    const type = action.type
    if (type === 'business') return { label: t('BUSINESS', 'Business'), path: pathOf(action.url) }
    if (type === 'product') return { label: t('PRODUCT', 'Product'), path: pathOf(action.url) }
    return { label: t('AD_BANNERS_LINK_OTHER', 'Link kept as it is'), path: '' }
  }

  return (
    <div className='odc-root odc-banners-images-block'>
      <div className='odc-banners-images' data-shape={shape} style={{ '--odc-banners-ratio': ratio }}>
        {list.map((image, index) => {
          const info = caption(image.action)
          const captionId = `${captionBase}-${image.id}`
          return (
            <button
              key={image.id}
              type='button'
              ref={node => { tiles.current[image.id] = node }}
              className='odc-banners-tile'
              aria-label={t('AD_BANNERS_EDIT_IMAGE', 'Edit image _number_ of _name_').replace('_number_', () => String(index + 1)).replace('_name_', () => bannerName)}
              aria-describedby={info ? captionId : undefined}
              onClick={() => openDialog(image)}
            >
              <Thumbnail src={optimizeImage ? optimizeImage(image.url, 'h_130,c_limit') : image.url} />
              {info && (
                <span id={captionId} className='odc-banners-tile-caption'>
                  <span>{info.label}</span>
                  {info.path && <span className='odc-mono odc-banners-tile-path'>{info.path}</span>}
                </span>
              )}
            </button>
          )
        })}
        <button
          type='button'
          ref={node => { tiles.current[ADD_KEY] = node }}
          className='odc-banners-tile odc-banners-tile-add'
          onClick={() => openDialog(null)}
        >
          <Plus className='odc-icon' aria-hidden='true' />
          <span>{t('AD_BANNERS_ADD_IMAGE', 'Add image')}</span>
        </button>
      </div>

      {list.length === 0 && (
        <p className='odc-banners-muted'>{t('AD_BANNERS_IMAGES_EMPTY', 'No images yet. Customers see nothing until you add one.')}</p>
      )}

      <BannerImageDialog
        open={dialog.open}
        image={dialog.image}
        bannerId={banner?.id}
        bannerName={banner?.name} // redesign AB-B5: the dialog's delete text names the banner
        position={position}
        onClose={closeDialog}
        handleDeleteBannerItem={handleDeleteBannerItem}
        handleUpdateBannerItem={handleUpdateBannerItem}
        handleSuccessBannerItemAdd={handleSuccessBannerItemAdd}
      />
    </div>
  )
}
