import { useEffect, useRef, useState } from 'react'
import { useLanguage, useToast, ToastType } from '../../../index'
import {
  PLUGIN_FRAME_RESIZE_WAIT_MS,
  PLUGIN_MESSAGE_EVENTS,
  clampPluginFrameHeight,
  getUrlOrigin,
  readPluginMessage,
  rememberPluginFrameHeight
} from '../../../utils/pluginMessages'

/**
 * Handles the messages of the plugin page open in a modal's iframe
 * (utils/pluginMessages.js, docs/PLUGIN_PAGES.md) while the modal is open:
 * - setup_finished: reads the store again and says it connected, or shows
 *   why it failed. The modal stays open unless the message asks to close
 *   (`close: true`): the page decides whether it still has something to show;
 * - close: closes the modal, like its X (which also reads the store again);
 * - resize: the page's content height (within bounds, and remembered under
 *   `frameKey` for the next open) and, once, the width it asks for (`size`).
 *   Returned so the modal fits the page; null until the page sends one.
 * Only messages from that iframe, from the origin of the URL it loaded and,
 * when they name a store, about `businessId` count. The toast is all the
 * message decides: the integration's state is read from the API.
 * @param {{
 *   open: boolean,
 *   iframeRef: { current: HTMLIFrameElement|null },
 *   url: string|null,
 *   businessId: number|string|null,
 *   name: string|null,
 *   closeModal: function(),
 *   reload: function(),
 *   fits?: boolean,
 *   frameKey?: string|null
 * }} options
 * @returns {{ height: number|null, size: string|null }} what the page reported
 */
export const usePluginMessages = ({ open, iframeRef, url, businessId, name, closeModal, reload, fits = false, frameKey = null }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()

  // The latest values, so the listener only follows the window it serves.
  const current = useRef({})
  current.current = { name, closeModal, reload, t, showToast, frameKey }
  const [frameHeight, setFrameHeight] = useState(null)
  const [frameSize, setFrameSize] = useState(null)

  // Every window starts at its initial size until its page reports one. A
  // window takes the size it asks for once, so its width moves at most once.
  useEffect(() => {
    setFrameHeight(null)
    if (!open) setFrameSize(null)
  }, [open, url])

  // A page opened to fit (links.launch) that never reports its height gets
  // the maximum, so it is not cramped.
  useEffect(() => {
    const frame = iframeRef.current
    if (!open || !fits || !url || !frame) return
    let timer = null
    const onLoad = () => {
      timer = setTimeout(() => {
        setFrameHeight(height => height ?? clampPluginFrameHeight(Infinity))
      }, PLUGIN_FRAME_RESIZE_WAIT_MS)
    }
    frame.addEventListener('load', onLoad)
    return () => {
      frame.removeEventListener('load', onLoad)
      clearTimeout(timer)
    }
  }, [open, url, fits])

  useEffect(() => {
    const origin = getUrlOrigin(url)
    if (!open || !origin) return

    const handleMessage = (event) => {
      const message = readPluginMessage(event, {
        source: iframeRef.current?.contentWindow ?? null,
        origin,
        businessId
      })
      if (!message) return

      if (message.event === PLUGIN_MESSAGE_EVENTS.RESIZE) {
        const height = clampPluginFrameHeight(message.height)
        setFrameHeight(height)
        if (message.size) setFrameSize(size => size ?? message.size)
        rememberPluginFrameHeight(current.current.frameKey, height)
        return
      }

      const { name, closeModal, reload, t, showToast } = current.current
      const pluginName = name || t('INTEGRATION', 'Integration')

      if (message.close) {
        closeModal()
      } else {
        reload && reload()
      }
      if (message.event !== PLUGIN_MESSAGE_EVENTS.SETUP_FINISHED) return
      if (message.status === 'success') {
        showToast(ToastType.Success, t('INTEGRATION_PLUGIN_SETUP_CONNECTED', '_name_ connected.').replace('_name_', pluginName))
      } else {
        showToast(ToastType.Error, message.message ||
          t('INTEGRATION_PLUGIN_SETUP_FAILED', '_name_ could not finish its setup.').replace('_name_', pluginName))
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [open, url, businessId])

  return { height: frameHeight, size: frameSize }
}
