// redesign fix-qa E9: a minimal `window.google.maps` for the synthetic app. Our sessions block Google (a third party),
// so the real map never renders there and its box was never measured. This fake draws what the real one draws that
// matters for layout: the map element gets a full-size child (the "canvas"), and nothing is loaded from the network.
// It also pre-registers the script tags the Google wrapper waits for, so it takes the "already loaded" branch.
export async function installFakeGoogleMaps (context) {
  await context.addInitScript(() => {
    const listeners = new Map()
    const addListener = (target, name, handler) => {
      const list = listeners.get(target) ?? []
      list.push([name, handler])
      listeners.set(target, list)
      return { remove: () => {} }
    }
    const event = {
      addListener,
      addListenerOnce: addListener,
      removeListener: () => {},
      clearListeners: target => listeners.delete(target),
      clearInstanceListeners: target => listeners.delete(target),
      trigger: (target, name, ...args) => (listeners.get(target) ?? []).filter(([n]) => n === name).forEach(([, fn]) => fn(...args))
    }

    class LatLng {
      constructor (lat, lng) {
        const point = typeof lat === 'object' && lat !== null ? lat : { lat, lng }
        // A LatLng or a literal: the real class takes both.
        this._lat = Number(typeof point.lat === 'function' ? point.lat() : point.lat)
        this._lng = Number(typeof point.lng === 'function' ? point.lng() : point.lng)
      }

      lat () { return this._lat }
      lng () { return this._lng }
      toJSON () { return { lat: this._lat, lng: this._lng } }
    }

    class LatLngBounds {
      constructor () { this.points = [] }
      extend (point) { this.points.push(new LatLng(point)); return this }
      union (other) { this.points.push(...(other?.points ?? [])); return this }
      getNorthEast () { return new LatLng(Math.max(...this.points.map(p => p.lat()), 0), Math.max(...this.points.map(p => p.lng()), 0)) }
      getSouthWest () { return new LatLng(Math.min(...this.points.map(p => p.lat()), 0), Math.min(...this.points.map(p => p.lng()), 0)) }
      getCenter () { return new LatLng(0, 0) }
    }

    class MVCObject {
      addListener (name, handler) { return addListener(this, name, handler) }
      set (key, value) { this[`_${key}`] = value }
      get (key) { return this[`_${key}`] }
    }

    class OverlayView extends MVCObject {
      setMap (map) {
        this.map = map
        if (map) {
          this.onAdd?.()
          this.draw?.()
        } else {
          this.onRemove?.()
        }
      }

      getMap () { return this.map }
      getPanes () {
        if (!this.pane && this.map?.element) {
          this.pane = document.createElement('div')
          this.pane.style.cssText = 'position:absolute;inset:0;pointer-events:none'
          this.map.element.appendChild(this.pane)
        }
        const pane = this.pane ?? document.createElement('div')
        return { overlayMouseTarget: pane, overlayLayer: pane, floatPane: pane, markerLayer: pane, mapPane: pane }
      }

      getProjection () {
        return {
          fromLatLngToDivPixel: () => ({ x: 0, y: 0 }),
          fromLatLngToContainerPixel: () => ({ x: 0, y: 0 }),
          fromContainerPixelToLatLng: () => new LatLng(0, 0),
          fromDivPixelToLatLng: () => new LatLng(0, 0)
        }
      }
    }

    class GoogleMap extends MVCObject {
      constructor (element, options = {}) {
        super()
        this.element = element
        this.options = options
        this.centerPoint = new LatLng(options.center ?? { lat: 0, lng: 0 })
        this.zoom = options.zoom ?? 10
        // What Google does to its container: it must be positioned and clips its tiles.
        if (getComputedStyle(element).position === 'static') element.style.position = 'relative'
        element.style.overflow = 'hidden'
        const canvas = document.createElement('div')
        canvas.setAttribute('data-testid', 'fake-google-map')
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#e5e3df;' +
          'background-image:linear-gradient(#c9d6c3 1px,transparent 1px),linear-gradient(90deg,#c9d6c3 1px,transparent 1px);background-size:32px 32px;' +
          'font:12px sans-serif;color:#555;display:flex;align-items:center;justify-content:center;white-space:nowrap'
        canvas.textContent = 'fake google.maps'
        element.appendChild(canvas)
      }

      setOptions (options) { Object.assign(this.options, options) }
      getCenter () { return this.centerPoint }
      setCenter (point) { this.centerPoint = new LatLng(point) }
      panTo (point) { this.centerPoint = new LatLng(point) }
      getZoom () { return this.zoom }
      setZoom (zoom) { this.zoom = zoom }
      fitBounds () {}
      getBounds () { return new LatLngBounds() }
      getMapTypeId () { return this.options.mapTypeId ?? 'roadmap' }
      getDiv () { return this.element }
      getProjection () { return new OverlayView().getProjection() }
    }

    class Marker extends MVCObject {
      constructor (options = {}) {
        super()
        this.position = options.position
        this.map = options.map
      }

      setPosition (position) { this.position = position }
      getPosition () { return this.position }
      setMap (map) { this.map = map }
      setDraggable () {}
      setIcon () {}
      setOpacity () {}
    }

    class Shape extends MVCObject {
      constructor (options = {}) { super(); this.options = options }
      setMap () {}
      getBounds () { return new LatLngBounds() }
      getPath () { return { getArray: () => [] } }
    }

    class Autocomplete extends MVCObject {
      constructor (input) { super(); this.input = input }
      setComponentRestrictions () {}
      setFields () {}
      setOptions () {}
      getPlace () { return {} }
    }

    class Geocoder {
      geocode (_request, callback) { callback?.([], 'ZERO_RESULTS') }
    }

    window.google = {
      maps: {
        version: '3.99.0',
        Map: GoogleMap,
        LatLng,
        LatLngBounds,
        MVCObject,
        OverlayView,
        Marker,
        Circle: Shape,
        Polygon: Shape,
        Polyline: Shape,
        Size: class Size { constructor (width, height) { this.width = width; this.height = height } },
        Point: class Point { constructor (x, y) { this.x = x; this.y = y } },
        Geocoder,
        event,
        ControlPosition: {},
        MapTypeControlStyle: {},
        places: { Autocomplete, PlacesServiceStatus: { OK: 'OK' }, PlacesService: class PlacesService { getDetails () {} } },
        geometry: { spherical: { computeDistanceBetween: () => 0 } }
      }
    }

    // The Google wrapper waits for these tags; with them present it takes the "already loaded" branch.
    const markLoaded = () => {
      for (const id of ['__googleMapsScriptId', 'google-maps-cluster', 'google-maps-heatmap']) {
        if (document.getElementById(id)) continue
        const marker = document.createElement('script')
        marker.id = id
        document.body.appendChild(marker)
      }
    }
    if (document.body) markLoaded()
    else document.addEventListener('DOMContentLoaded', markLoaded)
  })
}
