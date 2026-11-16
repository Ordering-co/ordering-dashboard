import React, { useState } from 'react'
import { SettingsImage } from '../../../src/@/components-dashboard/src/ui/src/components/Settings/SettingsImage'

export const MediaConsumersFixture = () => {
  const [saved, setSaved] = useState(null)
  return (
    <main style={{ padding: 20, maxWidth: 700 }} data-testid='media-settings-consumer'>
      <h1>Ordering.co settings image consumer</h1>
      <SettingsImage
        config={{ id: 701, name: 'Customer image', value: null }}
        saveConfig={(id, value) => {
          globalThis.__OD_MEDIA_CONSUMER_SAVES__ = [...(globalThis.__OD_MEDIA_CONSUMER_SAVES__ || []), { id, value }]
          setSaved({ id, value })
        }}
      />
      <output data-testid='media-settings-saved'>{JSON.stringify(saved)}</output>
    </main>
  )
}
