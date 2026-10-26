import { useCallback, useRef } from 'react'
import { useApi, useLanguage, useSession, useToast, ToastType } from '../../../index'
import { getDashboardOrigin } from '../../../utils/pluginMessages'
import {
  fillPluginPlaceholders,
  getPluginPagePath,
  hasPluginLaunch,
  requestPluginLaunch,
  resolvePluginUrl
} from '../../../utils/pluginPages'
import { rememberedPluginFrameHeight } from '../../../utils/pluginMessages'

/**
 * Opens a plugin's own pages (utils/pluginPages.js, docs/PLUGIN_PAGES.md).
 * Returns `openPluginPage(plugin, page, { businessId, driverCompanyId })`,
 * which resolves to the URL to load, or to null after telling the user why
 * the page cannot open:
 * - with `links.launch`: asks the plugin for a one-time URL (POST with the
 *   session in the header) and uses the one it returns;
 * - without it: the page's path, joined to the plugin root, with its
 *   placeholders filled in, as before.
 * `page` is `setup` or the key of one of the plugin's links. A second call
 * while a launch is still waiting is ignored.
 */
export const usePluginPage = () => {
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [languageState, t] = useLanguage()
  const [, { showToast }] = useToast()
  const launching = useRef(false)

  return useCallback(async (plugin, page, { businessId = null, driverCompanyId = null } = {}) => {
    const pluginName = plugin?.name || t('INTEGRATION', 'Integration')
    const variables = {
      project_code: ordering.project,
      access_token: token,
      business_id: businessId,
      language_code: languageState?.language?.code,
      dashboard_origin: getDashboardOrigin()
    }

    if (!hasPluginLaunch(plugin)) {
      const url = resolvePluginUrl(getPluginPagePath(plugin, page), plugin?.root)
      if (!url) {
        showToast(ToastType.Error, page === 'setup'
          ? t('INTEGRATION_SETUP_NOT_AVAILABLE', 'This integration has no setup page. Contact support to finish the connection.')
          : t('PLUGIN_PAGE_NOT_AVAILABLE', '_name_ has no page for this.').replace('_name_', pluginName))
        return null
      }
      return fillPluginPlaceholders(url, variables)
    }

    if (launching.current) return null
    launching.current = true
    try {
      const launch = await requestPluginLaunch({
        plugin,
        page,
        token,
        variables,
        body: {
          business_id: businessId,
          ...(driverCompanyId !== null && { driver_company_id: driverCompanyId }),
          dashboard_origin: window.location.origin
        }
      })
      if (launch.url) return launch.url

      if (launch.error === 'timeout') {
        showToast(ToastType.Error, t('PLUGIN_PAGE_OPEN_TIMEOUT', '_name_ took too long to open this page. Try again in a moment.').replace('_name_', pluginName))
      } else {
        showToast(ToastType.Error, launch.message
          ? t('PLUGIN_PAGE_OPEN_FAILED_REASON', '_name_ could not open this page: _reason_').replace('_name_', pluginName).replace('_reason_', launch.message)
          : t('PLUGIN_PAGE_OPEN_FAILED', '_name_ could not open this page. Try again in a moment.').replace('_name_', pluginName))
      }
      return null
    } finally {
      launching.current = false
    }
  }, [ordering.project, token, languageState?.language?.code, t, showToast])
}

/**
 * Shows a plugin page in a plugin modal, given the modal's state setter
 * ({ open, title, url, fits, frameKey, initialHeight }). The modal opens right
 * away with a loading state (PluginPageFrame) and the iframe fades in when the
 * page loads. A plugin with links.launch opens compact (`fits`), at the height
 * its page reported last time; it closes again when the launch fails
 * (openPluginPage says why). Any other plugin opens at the size plugin modals
 * always had.
 * @param {function} setPluginSelected
 * @returns {function(object, string, object=): Promise<boolean>} show(plugin, page, options)
 */
export const useShowPluginPage = (setPluginSelected) => {
  const openPluginPage = usePluginPage()

  return useCallback(async (plugin, page, options) => {
    const fits = hasPluginLaunch(plugin)
    const frameKey = `${plugin?.key || plugin?.id}:${page}`
    const modal = { title: plugin?.name, fits, frameKey, initialHeight: rememberedPluginFrameHeight(frameKey) }

    // A plugin without a launch has its URL at once: the modal opens with it,
    // so a page that does not exist only shows its toast.
    if (fits) setPluginSelected({ ...modal, open: true, url: null })

    const url = await openPluginPage(plugin, page, options)
    if (!url) {
      if (fits) setPluginSelected(prev => ({ ...prev, open: false }))
      return false
    }

    setPluginSelected({ ...modal, open: true, url })
    return true
  }, [openPluginPage, setPluginSelected])
}
