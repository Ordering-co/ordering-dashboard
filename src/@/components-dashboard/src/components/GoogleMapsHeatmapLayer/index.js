/**
 * Drop-in replacement for google.maps.visualization.HeatmapLayer (removed in Maps JS API 3.65).
 * Uses heatmap.js rendered as a Google Maps OverlayView.
 */
export class GoogleMapsHeatmapLayer {
  constructor (options = {}) {
    this._data = options.data || []
    this._radius = options.radius || 20
    this._map = options.map || null
    this._overlay = null

    if (this._map) {
      this.setMap(this._map)
    }
  }

  getMap () {
    return this._map
  }

  setMap (map) {
    if (this._overlay) {
      this._overlay.setMap(null)
      this._overlay = null
    }

    this._map = map

    if (map && window.google?.maps?.OverlayView && window.h337) {
      this._overlay = createHeatmapOverlay({
        data: this._data,
        radius: this._radius
      })
      this._overlay.setMap(map)
    }
  }

  setData (data) {
    this._data = data
    if (this._overlay) {
      this._overlay.data = data
      if (this._map) {
        this._overlay.draw()
      }
    }
  }
}

const createHeatmapOverlay = ({ data, radius }) => {
  class HeatmapOverlay extends window.google.maps.OverlayView {
    constructor (options) {
      super()
      this.data = options.data || []
      this.radius = options.radius || 20
      this.heatmap = null
      this.container = null
    }

    onAdd () {
      this.container = document.createElement('div')
      this.container.style.position = 'absolute'
      this.container.style.pointerEvents = 'none'
      this.getPanes().overlayLayer.appendChild(this.container)
    }

    draw () {
      const projection = this.getProjection()
      if (!projection || !this.container) return

      const map = this.getMap()
      const bounds = map?.getBounds()
      if (!bounds) return

      const northEast = bounds.getNorthEast()
      const southWest = bounds.getSouthWest()
      const topLeft = projection.fromLatLngToDivPixel(
        new window.google.maps.LatLng(northEast.lat(), southWest.lng())
      )
      const bottomRight = projection.fromLatLngToDivPixel(
        new window.google.maps.LatLng(southWest.lat(), northEast.lng())
      )

      const width = Math.max(0, bottomRight.x - topLeft.x)
      const height = Math.max(0, bottomRight.y - topLeft.y)

      if (width === 0 || height === 0) return

      this.container.style.left = `${topLeft.x}px`
      this.container.style.top = `${topLeft.y}px`
      this.container.style.width = `${width}px`
      this.container.style.height = `${height}px`

      if (!this.heatmap) {
        this.heatmap = window.h337.create({
          container: this.container,
          radius: this.radius,
          maxOpacity: 0.7,
          minOpacity: 0,
          blur: 0.85,
          gradient: {
            0.0: 'blue',
            0.5: 'lime',
            0.7: 'yellow',
            1.0: 'red'
          }
        })
      } else {
        this.heatmap.configure({ width, height, radius: this.radius })
      }

      const heatmapData = []
      this.data.forEach((latLng) => {
        const point = projection.fromLatLngToDivPixel(latLng)
        if (!point) return
        heatmapData.push({
          x: Math.floor(point.x - topLeft.x),
          y: Math.floor(point.y - topLeft.y),
          value: 1
        })
      })

      this.heatmap.setData({
        max: 1,
        data: heatmapData
      })
    }

    onRemove () {
      if (this.container?.parentNode) {
        this.container.parentNode.removeChild(this.container)
      }
      this.heatmap = null
      this.container = null
    }
  }

  return new HeatmapOverlay({ data, radius })
}
