import React, { useRef, useState } from 'react'

import { useLanguage } from '../../../../../index'
import { usePluginMessages } from '../../../hooks/usePluginMessages'
import { pluginFrameHeight, pluginModalSize } from '../../../../../utils/pluginMessages'
import { LoaderCircle } from '../../Shared/Icon'
import { Dialog } from '../../Shared/Product'
import './pos-store-panel.css'

/**
 * The page of a plugin (its setup or one of its links) in a Product Dialog, as an iframe.
 *
 * main #399 and #400 (docs/PLUGIN_PAGES.md), the caller opens it with `useShowPluginPage(setFrame)`, which asks a plugin
 * with `links.launch` for a one-time URL (no session token in the URL) and fills the placeholders of any other one; `frame` is what
 * that hook sets: `{ open, url, title, fits, frameKey, initialHeight }`.
 *  - It opens at once with «Loading {plugin}…» and the page fades in when it loads.
 *  - A page that fits (`links.launch`) opens small (640px) at its remembered height, then follows the `resize` messages of the page;
 *    any other keeps the large Dialog and its fixed height, as before.
 *  - The page can say its setup finished (a toast and `onReload`) or ask to close (usePluginMessages checks the frame, the origin of
 *    the URL loaded and the store).
 *  - Closing it reads the store again (`onReload`): the plugin reports its result to the API, not to this page.
 * The Dialog is anchored at the top, so a page that grows does not move its title.
 */
export const PluginFrameDialog = ({ frame, businessId, onClose, onReload }) => {
  const [, t] = useLanguage()
  const iframeRef = useRef(null)
  const [loadedUrl, setLoadedUrl] = useState(null)

  const open = !!frame?.open
  const url = frame?.url || null
  const fits = !!frame?.fits
  const title = frame?.title ?? ''

  const close = () => {
    onClose?.()
    onReload?.()
  }

  const pluginFrame = usePluginMessages({
    open,
    iframeRef,
    url,
    businessId: businessId ?? null,
    name: title,
    closeModal: close,
    reload: onReload,
    fits,
    frameKey: frame?.frameKey ?? null
  })
  // A page that fits, or one that asked for a size, takes main's width; any other keeps the large Dialog
  const width = fits || pluginFrame.size ? pluginModalSize({ fits, ...pluginFrame }).width : null
  const height = fits || pluginFrame.height
    ? pluginFrameHeight({ fits, height: pluginFrame.height, initialHeight: frame?.initialHeight })
    : null
  const loaded = Boolean(url) && loadedUrl === url

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) close() }}
      size='lg'
      title={title}
      closeLabel={t('CLOSE', 'Close')}
      className='psp-frame-dialog'
      style={width ? { '--psp-frame-inline-size': width } : undefined}
    >
      <div className='psp-frame-box' style={height ? { '--psp-frame-block-size': height } : undefined}>
        {!loaded && (
          <div className='psp-frame-loading' role='status'>
            <LoaderCircle className='odc-icon psp-frame-spin' aria-hidden='true' />
            <span>{t('PLUGIN_PAGE_LOADING', 'Loading _name_…').replace('_name_', () => title || t('INTEGRATION', 'Integration'))}</span>
          </div>
        )}
        {url && (
          <iframe
            ref={iframeRef}
            className='psp-frame'
            data-loaded={loaded ? '' : undefined}
            title={title}
            src={url}
            onLoad={() => setLoadedUrl(url)}
          />
        )}
      </div>
    </Dialog>
  )
}
