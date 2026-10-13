import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { ZoomIn, ZoomOut } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles'
import { SpinnerLoader } from '../../Shared'
import { PreviewScroll, PreviewPages, PreviewHint, PreviewHeader, PreviewNote, PreviewActions, PreviewZoom } from './styles'

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

export const PdfPreview = (props) => {
  const { blob, note, actions, loading, error, zoom, onZoomChange } = props
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
        if (!cancelled) setState({ loading: false, error: err?.message || 'Preview failed' })
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
        if (!cancelled) setState({ loading: false, error: err?.message || 'Preview failed' })
      }
    })()
    return () => { cancelled = true }
  }, [doc, zoom, viewerHeight])

  const changeZoom = (delta) => onZoomChange(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoom + delta) * 100) / 100)))

  return (
    <>
      <PreviewHeader $elevated={scrolled}>
        {note && <PreviewNote>{note}</PreviewNote>}
        <PreviewZoom>
          <IconButton color='black' disabled={!doc || zoom <= ZOOM_MIN} onClick={() => changeZoom(-ZOOM_STEP)}>
            <ZoomOut />
          </IconButton>
          <span>{Math.round(zoom * 100)}%</span>
          <IconButton color='black' disabled={!doc || zoom >= ZOOM_MAX} onClick={() => changeZoom(ZOOM_STEP)}>
            <ZoomIn />
          </IconButton>
        </PreviewZoom>
        <PreviewActions>
          {actions}
        </PreviewActions>
      </PreviewHeader>
      <PreviewScroll
        ref={scrollRef}
        style={viewerHeight ? { height: `${viewerHeight}px` } : undefined}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
      >
        {(loading || state.loading) && <SpinnerLoader />}
        {(error || state.error) && <PreviewHint>{error || state.error}</PreviewHint>}
        <PreviewPages ref={containerRef} onContextMenu={(e) => e.preventDefault()} />
      </PreviewScroll>
    </>
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

PdfPreview.defaultProps = {
  zoom: 1,
  onZoomChange: () => {}
}
