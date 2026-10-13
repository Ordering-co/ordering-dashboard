import React, { useState, useEffect } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage banner behavior without UI component
 */
export const BannerDetails = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch,
    banner,
    sitesState,
    defaultPosition,
    handleSuccessUpdate,
    handleSuccessAdd,
    handleSuccessDelete
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [bannerState, setBannerState] = useState({ banner, loading: false, error: null })
  const [isAddMode, setIsAddMode] = useState(false)

  const [bannerItemsState, setBannerItemsState] = useState({ loading: false, items: [], images: [], videos: [], error: null })
  const [changesState, setChangesState] = useState({ changes: {}, itemId: null, loading: false, error: null })
  const [selectedSitesIds, setSelectedSitesIds] = useState([])
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], result: { error: null } })
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [businessSearchValue, setBusinessSearchValue] = useState('')

  /**
   * Method to change the option state
   */
  const handleChangeItem = (changes, id) => {
    setChangesState(prevState => ({
      ...prevState,
      changes: {
        ...prevState?.changes,
        ...changes
      },
      ...(id && { itemId: id })
    }))
  }

  /**
   * Method to change the sites
   */
  const handleSelectSite = (checked, siteId) => {
    let sites = []
    if (changesState.changes?.sites) {
      sites = [...changesState.changes?.sites]
    } else {
      if (banner?.sites) {
        sites = banner?.sites?.reduce((ids, site) => [...ids, site.id], [])
      }
    }
    if (checked) {
      sites.push(siteId)
    } else {
      sites = sites.filter(id => id !== siteId)
    }
    setSelectedSitesIds(sites)
    setChangesState({
      ...changesState,
      changes: {
        ...changesState.changes,
        sites
      }
    })
  }

  const handleSelectAllSites = (isAll) => {
    const sitesIds = sitesState.sites?.reduce((ids, site) => [...ids, site.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...sitesIds]
    } else {
      filteredIds = []
    }
    setSelectedSitesIds(filteredIds)
    setChangesState({
      ...changesState,
      changes: {
        ...changesState.changes,
        sites: filteredIds
      }
    })
  }

  /**
   * Method to add new banner item from API
   * @param {Object} params
   */
  const handleAddBannerItem = async (params, isReturn = false) => {
    try {
      setChangesState(prevState => ({ ...prevState, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(params)
      }
      const response = await fetch(`${ordering.root}/banners/${banner.id}/items`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({ ...changesState, loading: false, changes: {} })
        showToast(ToastType.Success, t('BANNER_ITEM_ADDED', 'Banner item added'))
        const items = [...bannerItemsState.items, content.result]
        if (content.result?.type === 'image') {
          setBannerItemsState({
            ...bannerItemsState,
            items,
            images: [...bannerItemsState.images, content.result]
          })
        }
        if (content.result?.type === 'video') {
          setBannerItemsState({
            ...bannerItemsState,
            items,
            videos: [...bannerItemsState.videos, content.result]
          })
        }
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
      } else {
        setChangesState({ ...changesState, loading: false, error: content.result })
      }
      if (isReturn) return content
    } catch (err) {
      setChangesState({ ...changesState, loading: false, error: [err.message] })
      if (isReturn) {
        return { error: true, result: err }
      }
    }
  }

  /**
   * Method to delete the banner item from API
   * @param {Object} params
   */
  const handleDeleteBannerItem = async (itemId) => {
    try {
      setChangesState(prevState => ({ ...prevState, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/banners/${banner.id}/items/${itemId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({ ...changesState, loading: false, changes: {} })
        showToast(ToastType.Success, t('BANNER_ITEM_DELETED', 'Banner item deleted'))
        const items = bannerItemsState.items.filter(item => item.id !== itemId)
        if (content.result?.type === 'image') {
          setBannerItemsState({
            ...bannerItemsState,
            items,
            images: bannerItemsState.images.filter(item => item.id !== itemId)
          })
        }
        if (content.result?.type === 'video') {
          setBannerItemsState({
            ...bannerItemsState,
            items,
            videos: bannerItemsState.videos.filter(item => item.id !== itemId)
          })
        }
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
      } else {
        setChangesState({ ...changesState, loading: false, error: content.result })
      }
    } catch (err) {
      setChangesState({ ...changesState, loading: false, error: [err.message] })
    }
  }

  /**
   * Medthod to update the banner item from API
   */
  const handleUpdateBannerItem = async (payload, itemId, isReturn = false) => {
    try {
      setChangesState(prevState => ({ ...prevState, loading: true }))
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }
      const response = await fetch(`${ordering.root}/banners/${banner.id}/items/${itemId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setChangesState({ ...changesState, loading: false, changes: {} })
        const items = bannerItemsState.items.filter(item => {
          if (item.id === content.result.id) {
            Object.assign(item, content.result)
          }
          return true
        })
        if (content.result?.type === 'image') {
          const images = bannerItemsState.images.filter(item => {
            if (item.id === content.result.id) {
              Object.assign(item, content.result)
            }
            return true
          })
          setBannerItemsState({
            ...bannerItemsState,
            items,
            images
          })
        }
        if (content.result?.type === 'video') {
          const videos = bannerItemsState.videos.filter(item => {
            if (item.id === content.result.id) {
              Object.assign(item, content.result)
            }
            return true
          })
          setBannerItemsState({
            ...bannerItemsState,
            items,
            videos
          })
        }
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
        showToast(ToastType.Success, t('BANNER_ITEM_SAVED', 'Banner item saved'))
      } else {
        setChangesState({ ...changesState, loading: false, error: content.result })
      }
      if (isReturn) return content
    } catch (err) {
      setChangesState({ ...changesState, loading: false, error: [err.message] })
      if (isReturn) {
        return { error: true, result: err }
      }
    }
  }

  /**
   * Method to update the banner from API
   */
  const handleUpdateClick = async (payload) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = payload ? { ...payload } : { ...changesState?.changes }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/banners/${banner.id ?? bannerState.banner?.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setBannerState({
          ...bannerState,
          banner: content.result
        })
        setActionState({ loading: false, error: null })
        if (handleSuccessUpdate) {
          handleSuccessUpdate(content.result)
        }
        setChangesState({
          ...changesState,
          changes: {}
        })
        showToast(ToastType.Success, t('BANNER_SAVED', 'Banner saved'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to update the banner from API
   */
  const handleAddBanner = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = {
        ...changesState?.changes,
        position: defaultPosition
      }
      if (defaultPosition === 'web_business_page' || defaultPosition === 'app_business_page') {
        if (selectedBusinessIds.length) {
          changes.businesses = selectedBusinessIds
        }
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/banners`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setActionState({ loading: false, error: null })
        handleSuccessAdd && handleSuccessAdd({ ...content.result, enabled: true })
        props.onClose && props.onClose()
        showToast(ToastType.Success, t('BANNER_ADDED', 'Banner added'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to delete the banner from API
   */
  const handleDeleteBanner = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const response = await fetch(`${ordering.root}/banners/${banner.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setActionState({ loading: false, error: null })
        handleSuccessDelete && handleSuccessDelete(banner.id)
        props.onClose && props.onClose()
        showToast(ToastType.Success, t('BANNER_DELETED', 'Banner deleted'))
      } else {
        setActionState({
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
    }
  }

  const BUSINESSES_PAGE_SIZE = 10

  /**
   * Method to get business list from API
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   * @param {string} search business name search
   */
  const getBusinessList = async (page = 1, pageSize = BUSINESSES_PAGE_SIZE, search = '') => {
    try {
      setBusinessList(prev => ({ ...prev, loading: true }))

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE

      const conditions = [{ attribute: 'enabled', value: true }]
      if (search && String(search).trim()) {
        conditions.push({
          attribute: 'name',
          value: { condition: 'ilike', value: encodeURI(`%${String(search).trim()}%`) }
        })
      }
      const where = { conditions, conector: 'AND' }

      let content = null
      if (user?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }
        const params = (propsToFetch || []).join(',')
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}&where=${JSON.stringify(where)}`,
          requestOptions
        )
        content = await response.json()
      } else {
        const fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch).where(where)
        const response = await fetchEndpoint.get({ query: { page: safePage, page_size: safePageSize } })
        content = response.content
      }
      const { error, result, pagination } = content || {}
      if (!error) {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          businesses: result || [],
          pagination,
          error: null
        }))
      } else {
        setBusinessList(prev => ({
          ...prev,
          loading: false,
          error: result
        }))
      }
    } catch (error) {
      setBusinessList(prev => ({
        ...prev,
        loading: false,
        error: [error || error?.toString() || error?.message]
      }))
    }
  }

  const handleChangeBusinessPage = (page) => {
    getBusinessList(page, businessList?.pagination?.page_size || BUSINESSES_PAGE_SIZE, businessSearchValue)
  }

  const searchBusinesses = (val) => {
    const normalized = val == null ? '' : String(val).trim()
    setBusinessSearchValue(normalized)
    getBusinessList(1, BUSINESSES_PAGE_SIZE, normalized)
  }

  const handleSelectBusiness = (businessId, checked) => {
    const businessIds = [...selectedBusinessIds]
    let filteredIds = []
    if (checked) {
      filteredIds = [...businessIds, businessId]
    } else {
      filteredIds = businessIds.filter(id => id !== businessId)
    }
    setSelectedBusinessIds(filteredIds)
    setChangesState({
      ...changesState,
      business: JSON.stringify(filteredIds)
    })
  }

  const handleSelectAllBusiness = (isAll) => {
    const businessIds = businessList?.businesses?.reduce((ids, business) => [...ids, business.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...businessIds]
    } else {
      filteredIds = []
    }
    setSelectedBusinessIds(filteredIds)
    setChangesState({
      ...changesState,
      business: JSON.stringify(filteredIds)
    })
  }

  const handleSuccessBannerItemAdd = (newItem) => {
    const items = [...bannerItemsState.items, newItem]
    if (newItem?.type === 'image') {
      setBannerItemsState({
        ...bannerItemsState,
        items,
        images: [...bannerItemsState.images, newItem]
      })
    }
    if (newItem?.type === 'video') {
      setBannerItemsState({
        ...bannerItemsState,
        items,
        videos: [...bannerItemsState.videos, newItem]
      })
    }
    const updatedBanner = { ...banner, items }
    handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
  }

  useEffect(() => {
    if (Object.keys(banner).length === 0) {
      setIsAddMode(true)
      setChangesState({
        ...changesState,
        changes: {}
      })
      setSelectedSitesIds([])
      setBannerItemsState({
        ...bannerItemsState,
        loading: false,
        items: [],
        images: [],
        videos: []
      })
    } else {
      setIsAddMode(false)
      setChangesState({
        ...changesState,
        changes: {}
      })
      const images = banner?.items.filter(item => item.type === 'image')
      const videos = banner?.items.filter(item => item.type === 'video')
      setBannerItemsState({
        ...bannerItemsState,
        loading: false,
        items: banner.items,
        images,
        videos
      })
      const sitesIds = banner?.sites?.reduce((ids, site) => [...ids, site.id], [])
      setSelectedSitesIds(sitesIds || [])
      setBannerState({ ...bannerState, banner })

      const businessIds = banner?.business?.reduce((ids, business) => [...ids, business.id], [])
      setSelectedBusinessIds(businessIds)
    }
  }, [banner])

  useEffect(() => {
    getBusinessList()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          bannerState={bannerState}
          bannerItemsState={bannerItemsState}
          changesState={changesState}
          actionState={actionState}
          isAddMode={isAddMode}
          handleChangeItem={handleChangeItem}
          handleAddBannerItem={handleAddBannerItem}
          handleUpdateBannerItem={handleUpdateBannerItem}
          selectedSitesIds={selectedSitesIds}
          handleSelectSite={handleSelectSite}
          handleSelectAllSites={handleSelectAllSites}
          handleUpdateClick={handleUpdateClick}
          handleAddBanner={handleAddBanner}
          handleDeleteBanner={handleDeleteBanner}
          handleDeleteBannerItem={handleDeleteBannerItem}
          handleSuccessBannerItemAdd={handleSuccessBannerItemAdd}
          businessList={businessList}
          selectedBusinessIds={selectedBusinessIds}
          handleSelectBusiness={handleSelectBusiness}
          handleSelectAllBusiness={handleSelectAllBusiness}
          handleChangeBusinessPage={handleChangeBusinessPage}
          searchBusinesses={searchBusinesses}
        />
      )}
    </>
  )
}

BannerDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Array of business props to fetch
   */
  propsToFetch: PropTypes.arrayOf(string)
}

const defaultProps = {
  propsToFetch: ['id', 'name', 'logo', 'slug']
}
