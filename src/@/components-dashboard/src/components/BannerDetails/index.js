import React, { useState, useEffect, useRef } from 'react'
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
  // redesign (row 49, M-AB23): handlers that run twice before a render (two uploads in flight, two quick
  // ticks) read the latest value from these refs, not the closure of the render that created them
  const bannerItemsRef = useRef(bannerItemsState)
  const selectedSitesRef = useRef([])
  const selectedBusinessRef = useRef([])
  // redesign (row 41): each «Select all businesses» read takes a ticket; a new search takes the next one, so an answer
  // that was for the old search arrives stale and is not applied
  const selectEveryTicketRef = useRef(0)
  const [changesState, setChangesState] = useState({ changes: {}, itemId: null, loading: false, error: null })
  const [selectedSitesIds, setSelectedSitesIds] = useState([])
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], result: { error: null } })
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [businessSearchValue, setBusinessSearchValue] = useState('')

  const commitItems = (update) => {
    const next = typeof update === 'function' ? update(bannerItemsRef.current) : update
    bannerItemsRef.current = next
    setBannerItemsState(next)
    return next
  }
  const commitSites = (ids) => {
    selectedSitesRef.current = ids
    setSelectedSitesIds(ids)
  }
  const commitBusinesses = (ids) => {
    selectedBusinessRef.current = ids
    setSelectedBusinessIds(ids)
  }

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
    // redesign (row 49, M-AB23): start from the latest selection (it mirrors changes.sites, or the banner's sites)
    let sites = [...selectedSitesRef.current]
    if (checked) {
      if (!sites.includes(siteId)) sites.push(siteId)
    } else {
      sites = sites.filter(id => id !== siteId)
    }
    commitSites(sites)
    setChangesState(prevState => ({
      ...prevState,
      changes: {
        ...prevState.changes,
        sites
      }
    }))
  }

  const handleSelectAllSites = (isAll) => {
    const sitesIds = sitesState.sites?.reduce((ids, site) => [...ids, site.id], [])
    let filteredIds = []
    if (isAll) {
      filteredIds = [...sitesIds]
    } else {
      filteredIds = []
    }
    commitSites(filteredIds)
    setChangesState(prevState => ({
      ...prevState,
      changes: {
        ...prevState.changes,
        sites: filteredIds
      }
    }))
  }

  // redesign (row 49, M-AB23): append over the latest items, so a second upload that resolves before the first
  // render does not drop the first one (nor send up a banner without it)
  const addItemToState = (newItem) => {
    const isMedia = newItem?.type === 'image' || newItem?.type === 'video'
    const append = (prev) => ({
      ...prev,
      items: [...prev.items, newItem],
      ...(newItem?.type === 'image' && { images: [...prev.images, newItem] }),
      ...(newItem?.type === 'video' && { videos: [...prev.videos, newItem] })
    })
    // an item of another type is sent up with the banner but never entered the lists (as before)
    return isMedia ? commitItems(append) : append(bannerItemsRef.current)
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
        setChangesState(prevState => ({ ...prevState, loading: false, changes: {} }))
        showToast(ToastType.Success, t('BANNER_ITEM_ADDED', 'Banner item added'))
        const { items } = addItemToState(content.result)
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
      } else {
        setChangesState(prevState => ({ ...prevState, loading: false, error: content.result }))
      }
      if (isReturn) return content
    } catch (err) {
      setChangesState(prevState => ({ ...prevState, loading: false, error: [err.message] }))
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
        setChangesState(prevState => ({ ...prevState, loading: false, changes: {} }))
        showToast(ToastType.Success, t('BANNER_ITEM_DELETED', 'Banner item deleted'))
        // redesign AB-B1 (M-AB13): remove by id whatever type the API echoes
        const { items } = commitItems(prev => ({
          ...prev,
          items: prev.items.filter(item => item.id !== itemId),
          images: prev.images.filter(item => item.id !== itemId),
          videos: prev.videos.filter(item => item.id !== itemId)
        }))
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
        return { ok: true, error: null, result: content.result }
      }
      setChangesState(prevState => ({ ...prevState, loading: false, error: content.result }))
      return { ok: false, error: content.result }
    } catch (err) {
      setChangesState(prevState => ({ ...prevState, loading: false, error: [err.message] }))
      return { ok: false, error: [err.message] }
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
        setChangesState(prevState => ({ ...prevState, loading: false, changes: {} }))
        const mergeResult = (item) => item.id === content.result.id ? { ...item, ...content.result } : item
        const { items } = commitItems(prev => ({
          ...prev,
          items: prev.items.map(mergeResult),
          ...(content.result?.type === 'image' && { images: prev.images.map(mergeResult) }),
          ...(content.result?.type === 'video' && { videos: prev.videos.map(mergeResult) })
        }))
        const updatedBanner = { ...banner, items }
        handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
        showToast(ToastType.Success, t('BANNER_ITEM_SAVED', 'Banner item saved'))
      } else {
        setChangesState(prevState => ({ ...prevState, loading: false, error: content.result }))
      }
      if (isReturn) return content
    } catch (err) {
      setChangesState(prevState => ({ ...prevState, loading: false, error: [err.message] }))
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
        const saved = withSentBusinesses(content.result, changes.businesses)
        setBannerState(prevState => ({
          ...prevState,
          banner: saved
        }))
        setActionState({ loading: false, error: null })
        if (handleSuccessUpdate) {
          handleSuccessUpdate(saved)
        }
        setChangesState(prevState => ({
          ...prevState,
          changes: {}
        }))
        showToast(ToastType.Success, t('BANNER_SAVED', 'Banner saved'))
        // redesign AB-B1 (M-AB13)
        return { ok: true, error: null, result: saved }
      }
      setActionState({
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
      return { ok: false, error: err.message }
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
        handleSuccessAdd && handleSuccessAdd({ ...withSentBusinesses(content.result, changes.businesses), enabled: true })
        props.onClose && props.onClose()
        showToast(ToastType.Success, t('BANNER_ADDED', 'Banner added'))
        // redesign AB-B1 (M-AB13)
        return { ok: true, error: null, result: content.result }
      }
      setActionState({
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
      return { ok: false, error: err.message }
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
        // redesign AB-B1 (M-AB13)
        return { ok: true, error: null, result: content.result }
      }
      setActionState({
        loading: false,
        error: content.result
      })
      return { ok: false, error: content.result }
    } catch (err) {
      setActionState({
        loading: false,
        error: err.message
      })
      return { ok: false, error: err.message }
    }
  }

  const BUSINESSES_PAGE_SIZE = 10

  // redesign (row 49, M-AB20): `encodeURI` left & and # raw and the level 0 URL carried the JSON as is.
  // The level 0 URL encodes the whole `where` once (raw text inside); the SDK builds `where=<json>` without encoding,
  // so there the text is encoded once inside the JSON.
  // redesign (row 41): out of `getBusinessList`, so «Select all businesses» reads the same enabled + search set
  const buildBusinessWhere = (search, encodeText) => {
    const trimmed = search && String(search).trim() ? String(search).trim() : ''
    const conditions = [{ attribute: 'enabled', value: true }]
    if (trimmed) {
      const text = `%${trimmed}%`
      conditions.push({
        attribute: 'name',
        value: { condition: 'ilike', value: encodeText ? encodeURIComponent(text) : text }
      })
    }
    return { conditions, conector: 'AND' }
  }

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

      const buildWhere = (encodeText) => buildBusinessWhere(search, encodeText)

      let content = null
      if (user?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }
        const params = (propsToFetch || []).join(',')
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}&where=${encodeURIComponent(JSON.stringify(buildWhere(false)))}`,
          requestOptions
        )
        content = await response.json()
      } else {
        const fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch).where(buildWhere(true))
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
    selectEveryTicketRef.current += 1
    setBusinessSearchValue(normalized)
    getBusinessList(1, BUSINESSES_PAGE_SIZE, normalized)
  }

  const handleSelectBusiness = (businessId, checked) => {
    // redesign (row 49, M-AB23): two ticks before a render both count
    const businessIds = [...selectedBusinessRef.current]
    let filteredIds = []
    if (checked) {
      filteredIds = businessIds.includes(businessId) ? businessIds : [...businessIds, businessId]
    } else {
      filteredIds = businessIds.filter(id => id !== businessId)
    }
    commitBusinesses(filteredIds)
    setChangesState(prevState => ({
      ...prevState,
      business: JSON.stringify(filteredIds)
    }))
  }

  // redesign (row 41, review F-2): `pageOnly` (the new list, whose selection can span pages through «Select all businesses») adds
  // the visible page to the selection or takes only that page out; without it, as main: the page replaces the selection, or it is cleared
  const handleSelectAllBusiness = (isAll, { pageOnly = false } = {}) => {
    const businessIds = businessList?.businesses?.reduce((ids, business) => [...ids, business.id], []) ?? []
    let filteredIds = []
    if (pageOnly) {
      const current = selectedBusinessRef.current
      filteredIds = isAll
        ? [...new Set([...current, ...businessIds])]
        : current.filter(id => !businessIds.includes(id))
    } else if (isAll) {
      filteredIds = [...businessIds]
    } else {
      filteredIds = []
    }
    commitBusinesses(filteredIds)
    setChangesState(prevState => ({
      ...prevState,
      business: JSON.stringify(filteredIds)
    }))
  }

  /**
   * redesign (row 41, P-3): select EVERY enabled business that matches the current search, on all pages.
   * The list answers 10 per page whatever `page_size` asks, but a read of ids with no `page` answers all of them in one go
   * (`/business?mode=dashboard&params=id&where=…`, through the SDK, for every user level). The ids join the selection (nothing
   * already chosen is dropped) and `selectedBusinessIds` is what the create and the save send.
   * Resolves `{ ok, error, count }`; `{ ok: true, stale: true }` when the search changed while it loaded (nothing is applied).
   */
  const handleSelectEveryBusiness = async () => {
    const ticket = ++selectEveryTicketRef.current
    try {
      const response = await ordering.businesses().asDashboard().select(['id']).where(buildBusinessWhere(businessSearchValue, true)).get()
      const { error, result } = response?.content || {}
      if (error) return { ok: false, error: result }
      if (!Array.isArray(result)) return { ok: false, error: null }
      if (ticket !== selectEveryTicketRef.current) return { ok: true, error: null, stale: true }
      const ids = [...new Set([...selectedBusinessRef.current, ...result.map(business => business.id)])]
      commitBusinesses(ids)
      setChangesState(prevState => ({
        ...prevState,
        business: JSON.stringify(ids)
      }))
      return { ok: true, error: null, count: result.length }
    } catch (err) {
      return { ok: false, error: [err?.message] }
    }
  }

  const handleSuccessBannerItemAdd = (newItem) => {
    const { items } = addItemToState(newItem)
    const updatedBanner = { ...banner, items }
    handleSuccessUpdate && handleSuccessUpdate(updatedBanner)
  }

  // redesign AB-R1 (review r1 #2): when the API answer to a save of businesses carries no business list, the banner sent up
  // carries the ids that were saved, so the count and the checkboxes show what is stored now (not the list from before)
  function withSentBusinesses (result, sent) {
    if (!Array.isArray(sent) || Array.isArray(result?.business)) return result
    return { ...result, business: sent.map(id => ({ id })) }
  }

  const shownIdRef = useRef(null)
  useEffect(() => {
    if (Object.keys(banner).length === 0) {
      shownIdRef.current = null
      setIsAddMode(true)
      setChangesState(prevState => ({
        ...prevState,
        changes: {}
      }))
      commitSites([])
      commitItems(prev => ({
        ...prev,
        loading: false,
        items: [],
        images: [],
        videos: []
      }))
    } else {
      // redesign AB-R1 (review r1 #1): the host passes the list row, which is a NEW object after every update of the same
      // banner (switch, name, images). Only another banner (or leaving the create form) starts over: the same banner keeps
      // what the person is choosing (business selection, pending changes), as main did with the copy it captured on open.
      const sameBanner = shownIdRef.current != null && shownIdRef.current === banner?.id
      shownIdRef.current = banner?.id ?? null
      setIsAddMode(false)
      if (!sameBanner) {
        setChangesState(prevState => ({
          ...prevState,
          changes: {}
        }))
      }
      // redesign AB-B1 (M-AB21): a banner without items, sites or business does not throw
      const bannerItems = banner?.items ?? []
      const images = bannerItems.filter(item => item.type === 'image')
      const videos = bannerItems.filter(item => item.type === 'video')
      commitItems(prev => ({
        ...prev,
        loading: false,
        items: bannerItems,
        images,
        videos
      }))
      const sitesIds = (banner?.sites ?? []).reduce((ids, site) => [...ids, site.id], [])
      commitSites(sitesIds)
      setBannerState(prevState => ({ ...prevState, banner }))

      if (!sameBanner) {
        const businessIds = (banner?.business ?? []).reduce((ids, business) => [...ids, business.id], [])
        commitBusinesses(businessIds)
      }
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
          handleSelectEveryBusiness={handleSelectEveryBusiness}
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
