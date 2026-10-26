import React, { forwardRef, useState } from 'react'
import { useLanguage } from '../../../../../index'
import { pluginFrameHeight } from '../../../../../utils/pluginMessages'
import { Box, Loading, Spinner, Frame } from './styles'

/**
 * The plugin page inside a plugin modal (docs/PLUGIN_PAGES.md). It shows
 * "Loading {name}…" while the launch gives the URL and the page loads, then
 * fades the page in. Its height follows the page (usePluginMessages); before
 * the page reports one, a page that fits starts at its remembered or compact
 * height and any other keeps the fixed height.
 */
export const PluginPageFrame = forwardRef(({ url, name, height, fits, initialHeight }, ref) => {
  const [, t] = useLanguage()
  const [loadedUrl, setLoadedUrl] = useState(null)
  const loaded = Boolean(url) && loadedUrl === url

  return (
    <Box style={{ height: pluginFrameHeight({ fits, height, initialHeight }) }}>
      {!loaded && (
        <Loading role='status'>
          <Spinner />
          <span>{t('PLUGIN_PAGE_LOADING', 'Loading _name_…').replace('_name_', name || t('INTEGRATION', 'Integration'))}</span>
        </Loading>
      )}
      {url && (
        <Frame
          ref={ref}
          src={url}
          title={name || undefined}
          $loaded={loaded}
          onLoad={() => setLoadedUrl(url)}
        />
      )}
    </Box>
  )
})

PluginPageFrame.displayName = 'PluginPageFrame'
