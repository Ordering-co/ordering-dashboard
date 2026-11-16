// Narrow in-memory seams for selection-tree fixtures and their real consumers.
import React from 'react'
import {
  useApi as useBaseApi,
  useLanguage as useBaseLanguage,
  useSession as useBaseSession,
  useUtils as useBaseUtils
} from './language'

const isTreeSurface = () => ['selection-trees', 'tree-consumers'].includes(new URLSearchParams(window.location.search).get('surface'))
const fixtureOrdering = { source: 'selection-tree-fixture' }
const overrides = () => globalThis.__OD_TREE_CONSUMER_CONTROLLERS__ || {}

export const useLanguage = () => useBaseLanguage()
export const useSession = () => useBaseSession()
export const useApi = () => isTreeSurface() ? [fixtureOrdering] : useBaseApi()
export const useUtils = () => {
  const base = useBaseUtils()
  return isTreeSurface()
    ? [{
        optimizeImage: (value, options) => {
          globalThis.__OD_TREE_OPTIMIZE_CALLS__ = [...(globalThis.__OD_TREE_OPTIMIZE_CALLS__ || []), { options, value }]
          return value
        }
      }]
    : base
}

const recordController = (id, props) => {
  const summary = {
    isAllCategoryProducts: props.isAllCategoryProducts,
    isInitialRender: props.isInitialRender,
    isSearchByDescription: props.isSearchByDescription,
    isSearchByName: props.isSearchByName,
    ordering: props.ordering,
    version: props.version
  }
  const receipts = globalThis.__OD_TREE_CONTROLLER_RECEIPTS__ || {}
  const history = receipts[id] || []
  if (JSON.stringify(history.at(-1)) !== JSON.stringify(summary)) {
    globalThis.__OD_TREE_CONTROLLER_RECEIPTS__ = { ...receipts, [id]: [...history, summary] }
  }
}

export const BusinessProductsListing = (props) => {
  const Override = overrides().BusinessProductsListing
  if (Override) return <Override {...props} />
  const { UIComponent, fixtureBusinessState, fixtureControllerId = 'tree', ...forwarded } = props
  if (typeof UIComponent !== 'function') throw new Error('BusinessProductsListing fixture requires UIComponent')
  if (!fixtureBusinessState) throw new Error('BusinessProductsListing fixture requires fixtureBusinessState')
  recordController(fixtureControllerId, forwarded)
  globalThis.__OD_TREE_INITIAL_RENDER_HANDLERS__ = {
    ...(globalThis.__OD_TREE_INITIAL_RENDER_HANDLERS__ || {}),
    [fixtureControllerId]: forwarded.handleUpdateInitialRender
  }
  return <UIComponent {...forwarded} businessState={fixtureBusinessState} />
}
