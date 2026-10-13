import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { fetchAllPages } from '../../utils/fetchAllPages'

/**
 * Component to manage LanguageManager behavior without UI component
 */
export const LanguageManager = (props) => {
  const {
    UIComponent,
    isShowProductType
  } = props

  const [ordering] = useApi()
  const [, t] = useLanguage()
  const [{ loading, token }] = useSession()
  const [, { showToast }] = useToast()

  const [translationList, setTranslationList] = useState({ loading: false, translations: [], result: { error: null } })
  const [searchValue, setSearchValue] = useState(null)
  const [formState, setFormState] = useState({ loading: false, changes: {}, result: { error: null } })
  const [selectedProductType, setSelectedProductType] = useState('')
  const [productAvailabilityState, setProductAvailabilityState] = useState({ loading: !!isShowProductType, hasFranchiseApp: false, error: null })

  /**
   * Method to update translation text
   * @param {number} id translation id
   * @param {String} key translation key
   * @param {String} text translation text
   */
  const handleChangeText = (id, key, text) => {
    const translations = translationList?.translations.map(translation => {
      if (translation.key === key) {
        return {
          ...translation,
          [isShowProductType ? 'value' : 'text']: text
        }
      }
      return translation
    })

    if (searchValue) {
      setSearchValue(key)
    }

    handleUpdateTranslationList && handleUpdateTranslationList(translations)
    setFormState({
      ...formState,
      changes: {
        id,
        key,
        [isShowProductType ? 'value' : 'text']: text
      }
    })
  }

  const handleSelectChange = (value) => {
    setSelectedProductType(value)
  }

  const handleUpdateTranslationList = (translations) => {
    setTranslationList({ ...translationList, translations })
  }

  /**
   * Method to update translation from API
   */
  const updateTranslation = async () => {
    try {
      setFormState({
        ...formState,
        loading: true
      })
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      let changes = {
        key: formState?.changes?.key,
        [isShowProductType ? 'value' : 'text']: formState?.changes?.text ?? formState?.changes?.value
      }
      if (isShowProductType) {
        const productPrefix = selectedProductType.toUpperCase()
        if (!changes.key.startsWith(`${productPrefix}_`)) {
          changes.key = `${productPrefix}_${changes.key}`
        }
        changes = {
          ...changes,
          version: 'v2',
          product: selectedProductType
        }
      }
      const { content: { error, result } } = await ordering.translations(formState?.changes?.id).save(changes)
      if (!error) {
        setFormState({
          ...formState,
          loading: false,
          changes: {}
        })
        showToast(ToastType.Success, t('WEB_APP_LANG_SAVED', 'Language change saved'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setFormState({
        ...formState,
        loading: false,
        error: [error || error?.toString() || error?.message]
      })
    }
  }

  /**
   * Method to get translation list from API
   */
  const getTranslations = async () => {
    if (loading) return
    try {
      setTranslationList({ ...translationList, loading: true })
      const conditons = []
      let params = {}
      if (isShowProductType) {
        conditons.push({
          attribute: 'product',
          value: selectedProductType
        })
        params = {
          ...params,
          version: 'v2'
        }
      }
      const { content: { error, result } } = await ordering.translations().parameters(params).where(conditons).get()
      if (!error) {
        setTranslationList({
          ...translationList,
          loading: false,
          translations: result
        })
      } else {
        setTranslationList({
          ...translationList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setTranslationList({
        ...translationList,
        loading: false,
        error: err
      })
    }
  }

  useEffect(() => {
    if (!isShowProductType || selectedProductType) {
      getTranslations()
    }
  }, [isShowProductType, selectedProductType])

  useEffect(() => {
    if (!isShowProductType) {
      setProductAvailabilityState({ loading: false, hasFranchiseApp: false, error: null })
      return
    }
    if (loading || !token) return

    let isMounted = true

    const getBuilderApps = async () => {
      try {
        setProductAvailabilityState({ loading: true, hasFranchiseApp: false, error: null })
        const requestOptions = {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          }
        }
        const { error, result } = await fetchAllPages(`${ordering.root}/builder/apps`, requestOptions)
        if (!isMounted) return
        setProductAvailabilityState({
          loading: false,
          hasFranchiseApp: !error && (result?.some(app => app?.base?.code === 'app_franchises_x') ?? false),
          error: error ? result : null
        })
      } catch (error) {
        if (!isMounted) return
        setProductAvailabilityState({
          loading: false,
          hasFranchiseApp: false,
          error: error?.message ?? error
        })
      }
    }

    getBuilderApps()

    return () => {
      isMounted = false
    }
  }, [isShowProductType, loading, token, ordering.root])

  useEffect(() => {
    if (Object.keys(formState?.changes).length > 0) {
      updateTranslation()
    }
  }, [formState?.changes])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          translationList={translationList}
          handleUpdateTranslationList={handleUpdateTranslationList}
          textEditState={formState.changes}
          searchValue={searchValue}
          onSearch={setSearchValue}
          handleChangeText={handleChangeText}
          getTranslations={getTranslations}
          selectedProductType={selectedProductType}
          handleSelectChange={handleSelectChange}
          hasFranchiseApp={productAvailabilityState.hasFranchiseApp}
          productAvailabilityReady={!productAvailabilityState.loading}
        />
      )}
    </>
  )
}

LanguageManager.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
