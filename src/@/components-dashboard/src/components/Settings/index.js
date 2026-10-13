import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { CONFIG_CATEGORIES_VERSION } from '../../utils'
import { filterSettingsConfigs, isSettingsCategoryHidden } from '../../utils/settingsIa'

/**
 * Component to manage Settings page behavior without UI component
 */
export const Settings = (props) => {
  const {
    UIComponent,
    settingsType,
    hasNotParentId,
    defaultCategoryList,
    subSettingId,
    selectedSettingState,
    handleUpdateAllSettings
  } = props

  const [{ token, loading }] = useSession()
  const [ordering] = useApi()
  const [categoryList, setCategoryList] = useState({ categories: defaultCategoryList ?? [], loading: false, error: null })
  const [subCategoryList, setSubCategoryList] = useState({ categories: [], loading: false, error: null })
  const [isUpdateConfig, setIsUpdateConfig] = useState(false)
  const [parentId, setParentId] = useState(null)

  /**
   * Method to update the category
   */
  const handleUpdateCategoryList = (categories) => {
    setCategoryList({ ...categoryList, categories })
    handleUpdateAllSettings && handleUpdateAllSettings(categories)
    setIsUpdateConfig(true)
  }

  /**
   * Method to get parent categoryid
   */
  const getParentCategory = async () => {
    if (loading) return
    try {
      setCategoryList({ ...categoryList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const filterConditons = []
      filterConditons.push({ attribute: 'key', value: settingsType })

      const functionFetch = `${ordering.root}/config_categories?version=${CONFIG_CATEGORIES_VERSION}&where=${JSON.stringify(filterConditons)}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      if (hasNotParentId) {
        setCategoryList({
          ...categoryList,
          loading: false,
          categories: result,
          error: null
        })
        return
      }
      if (!error && result.length > 0) {
        setParentId(result[0].id)
      } else {
        setCategoryList({
          ...categoryList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setCategoryList({
        ...categoryList,
        loading: false,
        error: err
      })
    }
  }

  /**
   * Method to get Configration List
   */
  const getCategories = async () => {
    if (loading) return
    try {
      setCategoryList({ ...categoryList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const filterConditons = []
      filterConditons.push({ attribute: 'parent_category_id', value: parseInt(parentId) })

      const functionFetch = `${ordering.root}/config_categories?version=${CONFIG_CATEGORIES_VERSION}&orderBy=rank&where=${JSON.stringify(filterConditons)}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      if (!error) {
        const _result = result
          .filter(setting => !isSettingsCategoryHidden(setting))
          .map(setting => ({
            ...setting,
            configs: filterSettingsConfigs(setting.configs)
          }))
        setCategoryList({
          ...categoryList,
          loading: false,
          categories: _result
        })
      } else {
        setCategoryList({
          ...categoryList,
          loading: true,
          error: result
        })
      }
    } catch (err) {
      setCategoryList({
        ...categoryList,
        loading: false,
        error: err
      })
    }
  }

  const getSubCategories = async (parentId) => {
    if (subCategoryList.loading) return
    try {
      setSubCategoryList({ ...subCategoryList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const filterConditons = []
      filterConditons.push({ attribute: 'parent_category_id', value: parseInt(parentId) })

      const functionFetch = `${ordering.root}/config_categories?version=${CONFIG_CATEGORIES_VERSION}&orderBy=rank&where=${JSON.stringify(filterConditons)}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      if (!error) {
        const rankCategories = (result || [])
          .filter(setting => !isSettingsCategoryHidden(setting))
          .map(setting => ({ ...setting, configs: filterSettingsConfigs(setting.configs) }))
          .sort((a, b) => (a?.rank && b?.rank) ? a.rank - b.rank : 0)
        setSubCategoryList({
          ...subCategoryList,
          loading: false,
          categories: rankCategories
        })
      } else {
        setSubCategoryList({
          ...subCategoryList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setSubCategoryList({
        ...subCategoryList,
        loading: false,
        error: err
      })
    }
  }

  useEffect(() => {
    if (defaultCategoryList || selectedSettingState) return
    getParentCategory()
  }, [settingsType])

  useEffect(() => {
    if (parentId) getCategories(parentId)
  }, [parentId])

  useEffect(() => {
    if (!defaultCategoryList || defaultCategoryList?.length === 0) return
    setCategoryList({ ...categoryList, categories: defaultCategoryList })
  }, [defaultCategoryList])

  useEffect(() => {
    setSubCategoryList({ ...subCategoryList, categories: [] })
    if (!subSettingId) return
    getSubCategories(subSettingId)
  }, [subSettingId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          isUpdateConfig={isUpdateConfig}
          handChangeConfig={setIsUpdateConfig}
          categoryList={categoryList}
          subCategoryList={subCategoryList}
          handleUpdateCategoryList={handleUpdateCategoryList}
        />
      )}
    </>
  )
}

Settings.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Number to idenity setting group
   */
  settingsType: PropTypes.string
}
