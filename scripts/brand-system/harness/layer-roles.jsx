import React, { useEffect, useState } from 'react'

// (O-7): the legacy open lists read the --od-x-layer-* roles, which the app loads with src/brand/candidates.css
// (src/index.js). Surfaces imported statically by main.jsx cannot import that sheet at module level — it would reach every
// surface and break the isolation contracts — so they load it when they mount and render once it is there.
export const withLayerRoles = (Fixture) => function LayerRolesFixture (props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    import('../../../src/brand/candidates.css').then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [])
  return ready ? <Fixture {...props} /> : null
}
