import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'

export const WrapperGoogleMaps = (Child) => {
  const WrapperComponent = (props) => {
    const {
      apiKey
    } = props

    if (!apiKey) {
      console.warn('Prop `apiKey` is required to use Google Maps components.')
    }

    const [googleReady, setGoogleReady] = useState(false)

    useEffect(() => {
      if (!apiKey) {
        return
      }

      let checker = null

      if (!window.document.getElementById('google-maps-cluster')) {
        const js1 = window.document.createElement('script')
        js1.id = 'google-maps-cluster'
        js1.async = true
        js1.defer = true
        js1.src = 'https://unpkg.com/@google/markerclustererplus@4.0.1/dist/markerclustererplus.min.js'
        window.document.body.appendChild(js1)
      }

      if (!window.document.getElementById('google-maps-heatmap')) {
        const heatmapScript = window.document.createElement('script')
        heatmapScript.id = 'google-maps-heatmap'
        heatmapScript.async = true
        heatmapScript.defer = true
        heatmapScript.src = 'https://unpkg.com/heatmap.js@2.0.5/build/heatmap.min.js'
        window.document.body.appendChild(heatmapScript)
      }

      const checkGoogleMapsLoaded = () => {
        return typeof window.google !== 'undefined' &&
               typeof window.google.maps !== 'undefined' &&
               typeof window.google.maps.Map !== 'undefined'
      }

      if (window.document.getElementById('__googleMapsScriptId') && window.document.getElementById('google-maps-cluster')) {
        if (checkGoogleMapsLoaded()) {
          setGoogleReady(true)
        } else {
          checker = setInterval(() => {
            if (checkGoogleMapsLoaded()) {
              setGoogleReady(true)
              clearInterval(checker)
            }
          }, 100)
        }
        return
      }

      window.googleAsyncInit = () => {
        if (checkGoogleMapsLoaded()) {
          setGoogleReady(true)
        } else {
          checker = setInterval(() => {
            if (checkGoogleMapsLoaded()) {
              setGoogleReady(true)
              clearInterval(checker)
            }
          }, 100)
        }
      }

      const js = window.document.createElement('script')
      js.id = '__googleMapsScriptId'
      js.async = true
      js.defer = true
      js.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=googleAsyncInit&loading=async`

      window.document.body.appendChild(js)
      return () => {
        if (checker) {
          clearInterval(checker)
        }
      }
    }, [apiKey])

    return (
      <Child {...props} googleReady={googleReady} />
    )
  }

  WrapperComponent.displayName = `WrapperGoogleMaps(${Child.displayName || Child.name || 'Component'})`

  return WrapperComponent
}

WrapperGoogleMaps.propTypes = {
  /**
   * You Google Maps api key
   * @see apiKey What is Api Key ? https://developers.google.com/maps/gmp-get-started
   */
  apiKey: PropTypes.string.isRequired
}
