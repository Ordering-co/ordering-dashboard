import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import {
  buildSettingsCategoriesFetchUrl,
  buildSettingsCategoryLists
} from '../../utils/settingsCategoryTree'
import { getSettingsCategoryKeysToFetch, getSettingsStandaloneCategoryKeys } from '../../utils/settingsAccess'

const emptyCategoryLists = () => ({
  ...Object.fromEntries(getSettingsCategoryKeysToFetch().map(({ key }) => [key, []])),
  ...Object.fromEntries(getSettingsStandaloneCategoryKeys().map(key => [key, []]))
})

/**
 * Component to manage AllSettings page behavior without UI component.
 * Fetches the full config_categories catalog once and builds the hub trees
 * on the client (no plan gating, no per-folder walk).
 */
export const AllSettings = (props) => {
  const { UIComponent } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  const [categoryList, setCategoryList] = useState({
    ...emptyCategoryLists(),
    loading: true,
    error: null
  })

  useEffect(() => {
    if (loading || !token || !ordering?.root) return undefined
    let cancelled = false

    const loadCategoryLists = async () => {
      try {
        const response = await fetch(buildSettingsCategoriesFetchUrl(ordering.root), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        })
        const { error, result } = await response.json()
        if (cancelled) return
        if (error) {
          setCategoryList({
            ...emptyCategoryLists(),
            loading: false,
            error: result
          })
          return
        }

        const lists = buildSettingsCategoryLists({
          categories: result || [],
          parentKeys: getSettingsCategoryKeysToFetch()
            .filter(key => key.enabled)
            .map(key => key.key),
          standaloneKeys: getSettingsStandaloneCategoryKeys()
        })
        setCategoryList({
          ...lists,
          loading: false,
          error: null
        })
      } catch (err) {
        if (!cancelled) {
          setCategoryList({
            ...emptyCategoryLists(),
            loading: false,
            error: err
          })
        }
      }
    }

    loadCategoryLists()
    return () => {
      cancelled = true
    }
  }, [loading, token, ordering?.root])

  const { loading: loadingCategories, error: categoriesError } = categoryList
  // Keep the same reference between renders: the hub is memoized on it and
  // a fresh object on every render would rebuild the hub (and reset the
  // open form) before the config dictionary has actually refreshed.
  const categoryLists = useMemo(() => {
    const { loading, error, ...lists } = categoryList
    return lists
  }, [categoryList])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          basicCategoryList={categoryList.key_basic}
          proCategoryList={categoryList.key_pro}
          enterpriseCategoryList={categoryList.key_enterprise}
          pluginsCategoryList={categoryList.key_plugin}
          addonCategoryList={categoryList.key_addon}
          categoryLists={categoryLists}
          loadingCategories={loadingCategories}
          categoriesError={categoriesError}
        />
      )}
    </>
  )
}

AllSettings.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
