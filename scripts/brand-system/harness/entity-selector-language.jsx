// Narrow in-memory seams for entity-selector fixtures and their real consumers.
import React from 'react'
import translations from '../../../i18n/translations.json'
import { useLanguage as useBaseLanguage, useSession as useBaseSession, useUtils as useBaseUtils } from './language'

const controllerOverrides = () => globalThis.__OD_ENTITY_CONSUMER_CONTROLLERS__ || {}
const isEntitySurface = () => ['entity-selectors', 'entity-consumers'].includes(new URLSearchParams(window.location.search).get('surface'))
const requireUI = (name, UIComponent) => {
  if (typeof UIComponent !== 'function') throw new Error(`${name} fixture requires UIComponent`)
}
const capture = (name, id, value, callback) => {
  globalThis.__OD_ENTITY_CONTROLLER_RECEIPTS__ = {
    ...(globalThis.__OD_ENTITY_CONTROLLER_RECEIPTS__ || {}),
    [id || name]: value
  }
  callback?.(value)
}

export const useLanguage = () => {
  const base = useBaseLanguage()
  const locale = new URLSearchParams(window.location.search).get('locale') || 'en'
  const dictionary = React.useMemo(() => Object.fromEntries(
    Object.entries(translations).map(([key, values]) => [key, values[locale]])
  ), [locale])
  const translate = React.useCallback((key, fallback) => dictionary[key] || fallback || key, [dictionary])
  return isEntitySurface() ? [{ dictionary, loading: false }, translate] : base
}

export const useSession = () => {
  const base = useBaseSession()
  const level = Number(new URLSearchParams(window.location.search).get('fixtureUserLevel') ?? 0)
  return isEntitySurface() ? [{ auth: true, loading: false, user: { id: 900, level, name: 'Avery Admin' } }] : base
}

export const useUtils = () => {
  const base = useBaseUtils()
  return isEntitySurface()
    ? [{
        optimizeImage: (value, options) => {
          globalThis.__OD_ENTITY_OPTIMIZE_CALLS__ = [...(globalThis.__OD_ENTITY_OPTIMIZE_CALLS__ || []), { options, value }]
          return value
        }
      }]
    : base
}

export const CityList = (props) => {
  const Override = controllerOverrides().CityList
  if (Override) return <Override {...props} />
  const { UIComponent, fixtureCitiesList, fixtureControllerId, onFixtureControllerCapture, ...forwarded } = props
  requireUI('CityList', UIComponent)
  if (!fixtureCitiesList) throw new Error('CityList fixture requires fixtureCitiesList')
  const summary = {
    defaultValue: forwarded.defaultValue,
    filterValues: forwarded.filterValues,
    isAddMode: forwarded.isAddMode,
    isDefault: forwarded.isDefault,
    optionInnerMaxHeight: forwarded.optionInnerMaxHeight,
    position: forwarded.position
  }
  React.useEffect(() => capture('CityList', fixtureControllerId, summary, onFixtureControllerCapture), [])
  return <UIComponent {...forwarded} citiesList={fixtureCitiesList} />
}

export const PointsWalletLevels = (props) => {
  const Override = controllerOverrides().PointsWalletLevels
  if (Override) return <Override {...props} />
  const { UIComponent, fixtureLevelList, fixtureControllerId, onFixtureControllerCapture, ...forwarded } = props
  requireUI('PointsWalletLevels', UIComponent)
  if (!fixtureLevelList) throw new Error('PointsWalletLevels fixture requires fixtureLevelList')
  const summary = {
    isAddMode: forwarded.isAddMode,
    isDisabled: forwarded.isDisabled,
    selectedLoyaltyLevelIds: forwarded.selectedLoyaltyLevelIds
  }
  React.useEffect(() => capture('PointsWalletLevels', fixtureControllerId, summary, onFixtureControllerCapture), [])
  return <UIComponent {...forwarded} levelList={fixtureLevelList} />
}

export const UsersList = (props) => {
  const Override = controllerOverrides().UsersList
  if (Override) return <Override {...props} />
  const { UIComponent, fixtureControllerId, onFixtureControllerCapture, ...forwarded } = props
  requireUI('UsersList', UIComponent)
  if (!forwarded.usersList || !forwarded.paginationProps || !forwarded.getUsers || !forwarded.onSearch) {
    throw new Error('UsersList fixture requires usersList, paginationProps, getUsers, and onSearch')
  }
  const summary = {
    defaultUserTypesSelected: forwarded.defaultUserTypesSelected,
    isSearchByUserEmail: forwarded.isSearchByUserEmail,
    isSearchByUserName: forwarded.isSearchByUserName,
    isSearchByUserPhone: forwarded.isSearchByUserPhone,
    propsToFetch: forwarded.propsToFetch
  }
  React.useEffect(() => capture('UsersList', fixtureControllerId, summary, onFixtureControllerCapture), [])
  return <UIComponent {...forwarded} />
}
