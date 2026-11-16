import React from 'react'
import { useApi, useLanguage } from '~components'
import { parseJsonObject } from '../../../../../../utils/safeJsonParse'

const FRAME_STYLE = { width: '100%', height: '400px' }

// the guide address comes from the API, so it is only drawn when it is an https address on the same origin as the plugin
// root. Anything else (another host, javascript:) draws nothing, and so does a path with quotes, angle brackets or spaces, which a real guide never has.
const UNSAFE_PATH_CHARS = /[\s"'<>`\\]/

const getGuideSrc = (root, path) => {
  if (UNSAFE_PATH_CHARS.test(path)) return null
  try {
    const rootUrl = new URL(root)
    const guideUrl = new URL(`${root}${path}`)
    if (rootUrl.protocol !== 'https:' || guideUrl.protocol !== 'https:' || guideUrl.origin !== rootUrl.origin) return null
    return guideUrl.href
  } catch (error) {
    return null
  }
}

export const hasSetupGuide = (plugin) => Boolean(parseJsonObject(plugin?.links)?.info_setup && plugin?.root)

export const DoordashContent = ({ plugin }) => {
  const [ordering] = useApi()
  const [, t] = useLanguage()

  const links = parseJsonObject(plugin?.links)
  const infoSetup = links?.info_setup?.replace('@{project_code}', ordering.project)
  const pluginRoot = plugin?.root
  const src = infoSetup && pluginRoot ? getGuideSrc(pluginRoot, infoSetup) : null

  if (!src) return null

  return <iframe src={src} title={t('DELIVERY_SERVICES_SETUP_GUIDE', 'Setup guide')} style={FRAME_STYLE} />
}
