import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useLanguage } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { Minus, Plus, TriangleAlert } from '../../Shared/Icon'
import { EmptyState, IconButton, Skeleton } from '../../Shared/Product'
import './labels.css'

const SCROLL_PADDING = 16
const VIEWER_BOTTOM_GAP = 40
const VIEWER_MIN_HEIGHT = 320
const ZOOM_STEP = 0.25
const ZOOM_MIN = 0.5
const ZOOM_MAX = 4

let pdfjsPromise = null
const loadPdfjs = () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

// redesign SC-B4: the viewer keeps its logic (pdf.js, the zoom, the note, the slot of actions) and changes its dress: P/IconButton for the
// zoom, the percentage as a figure (decision 11), P/Skeleton while it loads and P/EmptyState when it fails. Its styles are in labels.css.
export const PdfPreview = (props) => {
  const { blob, note, actions, loading, error, zoom = 1, onZoomChange = () => {} } = props
  const [, t] = useLanguage()
  const scrollRef = useRef(null)
  const containerRef = useRef(null)
  const [doc, setDoc] = useState(null)
  const [viewerHeight, setViewerHeight] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [state, setState] = useState({ loading: true, error: null })

  useLayoutEffect(() => {
    const measure = () => {
      const scroll = scrollRef.current
      if (!scroll) return
      const top = scroll.getBoundingClientRect().top
      setViewerHeight(Math.max(VIEWER_MIN_HEIGHT, Math.floor(window.innerHeight - top - VIEWER_BOTTOM_GAP)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    setDoc(null)
    if (!blob) {
      containerRef.current?.replaceChildren()
      setState({ loading: false, error: null })
      return
    }
    let cancelled = false
    let loadingTask = null
    setState({ loading: true, error: null })
    ;(async () => {
      try {
        const pdfjs = await loadPdfjs()
        const data = await blob.arrayBuffer()
        loadingTask = pdfjs.getDocument({ data })
        const loaded = await loadingTask.promise
        if (cancelled) return
        setDoc(loaded)
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err?.message || true })
      }
    })()
    return () => {
      cancelled = true
      loadingTask?.destroy()
    }
  }, [blob])

  useEffect(() => {
    if (!doc || !viewerHeight) return
    let cancelled = false
    const scroll = scrollRef.current
    const container = containerRef.current
    setState({ loading: true, error: null })
    container.replaceChildren()
    ;(async () => {
      try {
        const firstPage = await doc.getPage(1)
        if (cancelled) return
        const baseViewport = firstPage.getViewport({ scale: 1 })
        const containerWidth = (container.clientWidth || baseViewport.width) - 2
        const heightBudget = (scroll.clientHeight || 0) - SCROLL_PADDING
        const widthByHeight = heightBudget > 0 ? Math.floor(heightBudget * baseViewport.width / baseViewport.height) : containerWidth
        const width = Math.floor(Math.min(containerWidth, widthByHeight) * zoom)
        const dpr = window.devicePixelRatio || 1
        for (let i = 1; i <= doc.numPages; i++) {
          const pdfPage = i === 1 ? firstPage : await doc.getPage(i)
          if (cancelled) return
          const scale = width / pdfPage.getViewport({ scale: 1 }).width
          const viewport = pdfPage.getViewport({ scale: scale * dpr })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${width}px`
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
          if (cancelled) return
          container.appendChild(canvas)
          if (i === 1) setState({ loading: false, error: null })
        }
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err?.message || true })
      }
    })()
    return () => { cancelled = true }
  }, [doc, zoom, viewerHeight])

  const changeZoom = (delta) => onZoomChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + delta) * 100) / 100)))

  const busy = Boolean(loading || state.loading)
  const failure = error || state.error
  // a message of the API (or of pdf.js) is shown as it came; with none, the hint of every failed load
  const failureText = typeof failure === 'string' ? failure : null

  return (
    <div className='odc-root odc-school-labels-preview'>
      <div className='odc-school-labels-bar' data-elevated={scrolled ? '' : undefined}>
        {note && <p className='odc-school-labels-note'>{note}</p>}
        <div className='odc-school-labels-zoom'>
          <IconButton
            icon={Minus}
            label={t('ZOOM_OUT', 'Zoom out')}
            disabled={!doc || zoom <= ZOOM_MIN}
            onClick={() => changeZoom(-ZOOM_STEP)}
          />
          <span className='odc-figure odc-school-labels-zoom-value' dir='ltr'>{Math.round(zoom * 100)}%</span>
          <IconButton
            icon={Plus}
            label={t('ZOOM_IN', 'Zoom in')}
            disabled={!doc || zoom >= ZOOM_MAX}
            onClick={() => changeZoom(ZOOM_STEP)}
          />
        </div>
        <div className='odc-school-labels-actions'>
          {actions}
        </div>
      </div>
      <div
        ref={scrollRef}
        className='odc-school-labels-scroll'
        style={viewerHeight ? { height: `${viewerHeight}px` } : undefined}
        aria-busy={busy || undefined}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      >
        {busy && (
          <div className='odc-school-labels-state'>
            <span className='odc-sr-only'>{t('LOADING', 'Loading')}</span>
            <Skeleton size='40%' />
          </div>
        )}
        {failure && (
          <EmptyState
            tone='error'
            icon={TriangleAlert}
            title={t('SCHOOL_LOAD_FAILED', 'This could not be loaded')}
            description={translateApiMessage(t, failureText, t('SCHOOL_LOAD_FAILED_HINT', 'Check your connection and try again.'))}
          />
        )}
        <div ref={containerRef} className='odc-school-labels-pages' onContextMenu={(e) => e.preventDefault()} />
      </div>
    </div>
  )
}

PdfPreview.propTypes = {
  blob: PropTypes.object,
  note: PropTypes.string,
  actions: PropTypes.node,
  loading: PropTypes.bool,
  error: PropTypes.string,
  zoom: PropTypes.number,
  onZoomChange: PropTypes.func
}
