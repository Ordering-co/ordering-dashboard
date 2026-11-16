// Language seam for the insertion dialogs (InsertLink, InsertImage, InsertVideo) used by RichHtmlEditor.
// The fixture picks the locale from `?locale=`; every other hook is the harness one.
import React from 'react'
import { useLanguage as useBaseLanguage } from './language'

export { useConfig, useUtils } from './language'
export { DragAndDrop } from '../../../src/@/components-dashboard/src/components/DragAndDrop'
export { ExamineClick } from '../../../src/@/components-dashboard/src/components/ExamineClick'

const isEditorSurface = () => new URLSearchParams(window.location.search).get('surface') === 'html-editor'

export const useLanguage = () => {
  const base = useBaseLanguage()
  if (!isEditorSurface()) return base
  const locale = new URLSearchParams(window.location.search).get('locale') || 'en'
  return [{ ...base[0], language: { code: locale } }, base[1]]
}

export const HtmlEditorFixtureBoundary = ({ children }) => React.createElement(new URLSearchParams(window.location.search).get('strict') === 'true' ? React.StrictMode : React.Fragment, null, children)
