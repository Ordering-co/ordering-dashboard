import React from 'react'
import { useApi } from '~components'
import { parseJsonObject } from '../../../../../../utils/safeJsonParse'

export const DoordashContent = ({ plugin }) => {
  const [ordering] = useApi()

  const links = parseJsonObject(plugin?.links)
  const infoSetup = links?.info_setup?.replace('@{project_code}', ordering.project)
  const pluginRoot = plugin?.root

  return (
    <>
      {Boolean(infoSetup && pluginRoot) && <div dangerouslySetInnerHTML={{ __html: `<iframe src="${pluginRoot}${infoSetup}" style="width: 100%; height: 400px;" />` }} />}
    </>
  )
}
