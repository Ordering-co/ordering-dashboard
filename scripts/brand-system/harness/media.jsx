import React, { useRef, useState } from 'react'
import { useTheme } from 'styled-components'

import { Image } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/Image'
import { ImageCrop } from '../../../src/@/components-dashboard/src/ui/src/components/Shared/ImageCrop'

const validSvg = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iODAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iODAiIHJ4PSIxMiIgZmlsbD0iIzI2NkRGMCIvPjwvc3ZnPg=='
const invalidImage = 'data:image/png;base64,broken-image-data'
const makePhoto = type => {
  const canvas = document.createElement('canvas')
  canvas.width = 2400
  canvas.height = 1600
  const context = canvas.getContext('2d')
  context.fillStyle = '#266DF0'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#FFFFFF'
  context.fillRect(200, 200, 800, 600)
  return canvas.toDataURL(type, 0.92)
}
const photos = {
  jpeg: makePhoto('image/jpeg'),
  png: makePhoto('image/png'),
  webp: makePhoto('image/webp')
}

const Section = ({ children, label, testId }) => (
  <section aria-label={label} data-testid={testId} className='media-fixture-section'>
    <h2>{label}</h2>
    {children}
  </section>
)

const ImageCases = () => {
  const validRef = useRef()
  const fallbackRef = useRef()
  const removedRef = useRef()
  const reactFallbackRef = useRef()
  const [replacementSource, setReplacementSource] = useState(invalidImage)
  const [refs, setRefs] = useState({})
  const readRefs = () => setRefs({
    fallback: fallbackRef.current?.tagName,
    reactFallback: reactFallbackRef.current?.tagName,
    removed: removedRef.current?.tagName,
    valid: validRef.current?.tagName
  })
  return (
    <Section label='Image fallback contracts' testId='image-cases'>
      <div className='media-fixture-grid'>
        <div data-testid='image-valid'><Image ref={validRef} src={validSvg} className='fixture-image' style={{ width: 120 }} /></div>
        <div data-testid='image-react-fallback-no-src'><Image fallback={<span>Fallback without source</span>} /></div>
        <div data-testid='image-string-fallback'><Image ref={fallbackRef} src={invalidImage} fallback={validSvg} className='fixture-image' /></div>
        <div data-testid='image-string-remove'><Image ref={removedRef} src={invalidImage} fallback={invalidImage} className='fixture-removed' /></div>
        <div data-testid='image-react-fallback'><Image ref={reactFallbackRef} src={invalidImage} fallback={<span>React fallback after error</span>} className='fixture-react-fallback' /></div>
        <div data-testid='image-string-no-src'><Image fallback='literal-fallback-value' /></div>
        <div data-testid='image-error-reset'><Image src={replacementSource} fallback={<span>Error state remains</span>} /></div>
      </div>
      <div className='media-fixture-controls'>
        <button data-fixture-control type='button' onClick={() => setReplacementSource(validSvg)}>Supply valid source after error</button>
        <button data-fixture-control type='button' onClick={readRefs}>Read image refs</button>
      </div>
      <output data-testid='image-ref-state'>{JSON.stringify(refs)}</output>
    </Section>
  )
}

const CropCase = ({ aspectRatio, kind, photo, showAspectRatioBox, themeId, useCloudinaryUrl, record }) => (
  <div data-testid={`crop-${kind}`} className='media-fixture-cell'>
    <h3>{kind}</h3>
    <ImageCrop
      photo={photo}
      aspectRatio={aspectRatio}
      showAspectRatioBox={showAspectRatioBox}
      useCloudinaryUrl={useCloudinaryUrl}
      themeId={themeId}
      handleChangePhoto={value => record(kind, 'change', value)}
      onClose={() => record(kind, 'close')}
    />
  </div>
)

const CropCases = () => {
  const [events, setEvents] = useState([])
  const record = (kind, action, value) => {
    globalThis.__OD_MEDIA_RESULTS__ = { ...(globalThis.__OD_MEDIA_RESULTS__ || {}), ...(value ? { [kind]: value } : {}) }
    setEvents(current => [...current, {
      action,
      kind,
      ...(value ? { length: value.length, prefix: value.slice(0, 32) } : {})
    }])
  }
  return (
    <Section label='Real CropperJS contracts' testId='crop-cases'>
      <div className='media-fixture-grid crop-grid'>
        <CropCase kind='local-jpeg' photo={photos.jpeg} aspectRatio={4 / 3} showAspectRatioBox record={record} />
        <CropCase kind='local-webp' photo={photos.webp} record={record} />
        <CropCase kind='local-png' photo={photos.png} record={record} />
        <CropCase kind='cloud-success' photo={photos.jpeg} useCloudinaryUrl themeId={1} record={record} />
        <CropCase kind='cloud-error' photo={photos.png} useCloudinaryUrl themeId={2} record={record} />
      </div>
      <output data-testid='crop-events'>{JSON.stringify(events)}</output>
    </Section>
  )
}

export const MediaFixture = () => {
  const theme = useTheme()
  return (
    <main data-testid='media-fixture' className='media-fixture' style={{ background: theme.ordering?.semantic?.background, color: theme.ordering?.semantic?.text?.default }}>
      <style>{`
        .media-fixture { box-sizing: border-box; display: grid; gap: 20px; min-width: 0; padding: 24px; width: 100%; }
        .media-fixture * { box-sizing: border-box; }
        .media-fixture > h1, .media-fixture-section > h2, .media-fixture-cell > h3 { margin: 0; }
        .media-fixture-section { border: 1px solid currentColor; border-radius: 8px; display: grid; gap: 16px; min-width: 0; padding: 16px; }
        .media-fixture-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); min-width: 0; }
        .media-fixture-cell { border: 1px dashed currentColor; min-width: 0; padding: 12px; }
        .media-fixture-controls { display: flex; flex-wrap: wrap; gap: 8px; }
        .media-fixture .fixture-image { display: block; max-width: 100%; }
        .media-fixture output { display: block; max-width: 100%; min-width: 0; overflow-wrap: anywhere; word-break: break-word; }
        .media-fixture [data-fixture-control] { min-height: 44px; max-width: 100%; white-space: normal; }
        @media (max-width: 420px) { .media-fixture { gap: 12px; padding: 12px; } .media-fixture-section { padding: 12px; } }
      `}</style>
      <h1>Ordering.co image and crop fixtures</h1>
      <ImageCases />
      <CropCases />
    </main>
  )
}
