import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { translateApiMessage } from '../../utils/translateApiMessage'

// redesign review r1 (R1): `GET offers/:id` without `params` brings no relations (no sites, users, loyalty levels, businesses…), so a
// promotion opened by ?id= showed every section empty and a Save replaced what was stored; and that endpoint fails with
// `params=loyalty_levels` (measured on orderingv1). So the record is read through the list endpoint, filtered by its id, with the fields
// the list asks for (C/components/EnterprisePromotionList `propsToFetch`), relations included: the same GET the list sends.
const PROMOTION_PARAMS = [
  'name', 'auto', 'enabled', 'end', 'description', 'image', 'label', 'order_priority', 'sites', 'stackable', 'start', 'target', 'type',
  'limit_per_user', 'user_order_count', 'user_order_count_condition', 'valid_from_after_user_last_order_minutes', 'valid_until_after_user_last_order_minutes',
  'users', 'delivery_zones', 'paymethods', 'order_types_allowed', 'max_discount', 'rank', 'rate_type', 'rate', 'public', 'coupon', 'businesses', 'condition_type',
  'minimum', 'products', 'categories', 'schedule', 'limit', 'include_options', 'loyalty_levels'
].join(',')

export const EnterprisePromotionDetails = (props) => {
  const {
    promotion,
    promotionId,
    promotionsList,
    businessesList,
    getAllBusinessIds,
    sitesState,
    UIComponent,
    handleSuccessUpdatePromotions,
    handleSuccessAddPromotion,
    handleSuccessDeletePromotion
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast, hideToast }] = useToast()

  const [promotionState, setPromotionState] = useState({ promotion, loading: !promotion, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {} })
  const [actionState, setActionState] = useState({ loading: false, error: null })
  const [isAddMode, setIsAddMode] = useState(false)
  const [selectedBusinessIds, setSelectedBusinessIds] = useState([])
  const [isSelectingAllBusinesses, setIsSelectingAllBusinesses] = useState(false)
  const selectingAllBusinesses = useRef(false)
  const [selectedSitesIds, setSelectedSitesIds] = useState([])
  const [selectedProductsIds, setSelectedProductsIds] = useState({})
  const [selectedCategoryIds, setSelectedCategoryIds] = useState({})
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [selectedLoyaltyLevelIds, setSelectedLoyaltyLevelIds] = useState([])

  /**
   * Clean formState
   */
  const cleanFormState = () => setFormState({ loading: false, changes: {} })

  /**
   * Update business promotion image data
   * @param {File} file Image to change business promotion image
   */
  const handleChangeImage = (file) => {
    const reader = new window.FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      setFormState({
        ...formState,
        changes: {
          ...formState.changes,
          image: reader.result
        }
      })
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeInput = (e) => {
    setFormState({
      ...formState,
      changes: { ...formState.changes, [e.target.name]: e.target.value }
    })
  }

  /**
   * Update parameter data
   * @param {changes} changes parameters to change
   */
  const handleChangeItem = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        ...changes
      }
    })
  }

  /**
   * Method to remove the key of changes
   * @param {String} key
   */
  const handleRemoveKey = (key) => {
    const _changes = { ...formState?.changes }
    delete _changes[key]
    setFormState({
      ...formState,
      changes: _changes
    })
  }

  /**
   * Method to change the sites
   */
  // redesign review r1 (R1): the record the sections edit is the one loaded by the GET when the page opened it by ?id= (the prop is then
  // empty); a change to its sites, users or loyalty levels starts from that record, or a Save would replace them with one item
  const storedRecord = () => (promotionState.promotion && Object.keys(promotionState.promotion).length ? promotionState.promotion : promotion)

  const handleSelectSite = (checked, siteId) => {
    let sites = []
    if (formState.changes?.sites) {
      sites = [...formState.changes?.sites]
    } else {
      if (storedRecord()?.sites) {
        sites = storedRecord()?.sites?.reduce((ids, site) => [...ids, site.id], [])
      }
    }
    if (checked) {
      sites.push(siteId)
    } else {
      sites = sites.filter(id => id !== siteId)
    }
    setSelectedSitesIds(sites)
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        sites
      }
    })
  }

  // owner decision 14 B: «Select all» takes every business of the project (or every match of the search) from the list's
  // `getAllBusinessIds`, not only the loaded page. While it reads, `isSelectingAllBusinesses` is true (the UI freezes the control, and a
  // second click does nothing). On a failure the selection stays as it was and the error toast says so. «Select none» is synchronous as before.
  // Without a reader (another host of this controller) it keeps the old behavior: the loaded page.
  const applyBusinessIds = (businessIds) => {
    setSelectedBusinessIds(businessIds)
    setFormState(current => ({
      ...current,
      changes: {
        ...current.changes,
        businesses: businessIds
      }
    }))
  }

  const handleSelectAllBusiness = async (isAll) => {
    if (!isAll) {
      applyBusinessIds([])
      return
    }
    if (typeof getAllBusinessIds !== 'function') {
      applyBusinessIds(businessesList?.businesses?.reduce((ids, business) => [...ids, business.id], []) || [])
      return
    }
    if (selectingAllBusinesses.current) return
    selectingAllBusinesses.current = true
    setIsSelectingAllBusinesses(true)
    try {
      // W1 review F1: it adds; a business already selected that the search does not find keeps the promotion
      const found = await getAllBusinessIds()
      applyBusinessIds([...found, ...selectedBusinessIds.filter(id => !found.includes(id))])
    } catch (err) {
      showToast(ToastType.Error, translateApiMessage(t, err?.message, t('STORES_LOAD_FAILED', "We couldn't load the stores.")))
    } finally {
      selectingAllBusinesses.current = false
      setIsSelectingAllBusinesses(false)
    }
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
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        businesses: filteredIds
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
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        sites: filteredIds
      }
    })
  }

  const handleSelectUser = (checked, userId) => {
    let users = []
    if (formState.changes?.users) {
      users = [...formState.changes?.users]
    } else {
      if (storedRecord()?.users) {
        users = storedRecord()?.users?.reduce((ids, user) => [...ids, user.id], [])
      }
    }
    if (checked) {
      users.push(userId)
    } else {
      users = users.filter(id => id !== userId)
    }
    setSelectedUserIds(users)
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        users
      }
    })
  }

  const handleSelectAllUsers = () => {
    setSelectedUserIds([])
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        users: []
      }
    })
  }

  const handleSelectLoyaltyLevel = (checked, levelId) => {
    let loyaltyLevels = []
    if (formState.changes?.loyalty_levels) {
      loyaltyLevels = [...formState.changes?.loyalty_levels]
    } else {
      if (storedRecord()?.loyalty_levels) {
        loyaltyLevels = storedRecord()?.loyalty_levels?.reduce((ids, level) => [...ids, level.id], [])
      }
    }
    if (checked) {
      loyaltyLevels.push(levelId)
    } else {
      loyaltyLevels = loyaltyLevels.filter(id => id !== levelId)
    }
    setSelectedLoyaltyLevelIds(loyaltyLevels)
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        loyalty_levels: loyaltyLevels
      }
    })
  }

  const handleSelectAllLoyaltyLevels = (loyaltyLevels) => {
    setSelectedLoyaltyLevelIds(loyaltyLevels)
    setFormState({
      ...formState,
      changes: {
        ...formState.changes,
        loyalty_levels: loyaltyLevels
      }
    })
  }

  /**
   * Default fuction for business profile workflow
   */
  const handleUpdateClick = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = { ...formState?.changes }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
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

      const response = await fetch(`${ordering.root}/offers/${promotion.id ?? promotionState.promotion?.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setPromotionState({
          ...promotionState,
          promotion: content.result
        })
        setActionState({ loading: false, error: null })
        if (handleSuccessUpdatePromotions) {
          const updatedPromotions = promotionsList.filter(_promotion => {
            if (_promotion.id === promotion.id) {
              Object.assign(_promotion, content.result)
            }
            return true
          })
          handleSuccessUpdatePromotions(updatedPromotions)
        }
        cleanFormState()
        showToast(ToastType.Success, t('PROMOTION_SAVED', 'Promotion saved'))
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
   * Method to add new promotion from API
   */
  const handleAddPromotion = async (notCloseAdd) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ loading: true, error: null })
      const changes = { ...formState?.changes }
      if (changes?.schedule) {
        changes.schedule = JSON.stringify(changes.schedule)
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/offers`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setActionState({ error: null, loading: false })
        setPromotionState({
          ...promotionState,
          promotion: content.result
        })
        handleSuccessAddPromotion && handleSuccessAddPromotion(content.result)
        showToast(ToastType.Success, t('PROMOTION_ADDED', 'Promotion added'))
        setIsAddMode(false)
        !notCloseAdd && props.onClose && props.onClose()
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
   * Method to delete the business promotion
   * @param {Number} promotionId promotion id
   */
  // redesign PE-B3 (PE-14): deletes the id it can find (a record opened by ?id= has `promotion={}`, so `promotion.id` was undefined and the
  // request went to /offers/undefined), RESOLVES its outcome (`{ ok: true }` or `{ ok: false, error }`) and, on an API error or a throw,
  // frees the Save buttons (`loading` stayed true). Same request and toasts as before.
  const handleDeletePromotion = async () => {
    const offerId = promotionState.promotion?.id ?? promotion?.id ?? promotionId
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setActionState({ ...actionState, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/offers/${offerId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeletePromotion && handleSuccessDeletePromotion(offerId)
        showToast(ToastType.Success, t('OFFER_DELETED', 'Offer deleted'))
        props.onClose && props.onClose()
        return { ok: true }
      }
      hideToast?.() // redesign (row 81, review r1 R10): the «Loading» toast must not outlive a failed delete
      setActionState({ loading: false, error: content.result })
      return { ok: false, error: content.result }
    } catch (err) {
      hideToast?.()
      const error = [err.message]
      setActionState({ loading: false, error })
      return { ok: false, error }
    }
  }

  const initSetting = (promotion) => {
    const businessIds = promotion?.businesses?.reduce((ids, business) => [...ids, business.id], [])
    setSelectedBusinessIds(businessIds || [])
    const sitesIds = promotion?.sites?.reduce((ids, site) => [...ids, site.id], [])
    setSelectedSitesIds(sitesIds || [])
    const _selectedProductsIds = promotion?.products?.reduce((ids, product) => [...ids, product.id], [])
    setSelectedProductsIds(_selectedProductsIds)
    const _selectedCategoryIds = promotion?.categories?.reduce((ids, category) => [...ids, category.id], [])
    setSelectedCategoryIds(_selectedCategoryIds)
    const userIds = promotion?.users?.reduce((ids, user) => [...ids, user.id], [])
    setSelectedUserIds(userIds || [])
    const LoyaltyLevelIds = promotion?.loyalty_levels?.reduce((ids, level) => [...ids, level.id], [])
    setSelectedLoyaltyLevelIds(LoyaltyLevelIds || [])
  }

  /**
   * Method to get the offer from API
   */
  const getPromotion = async () => {
    try {
      setPromotionState({
        ...promotionState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const where = JSON.stringify({ conditions: [{ attribute: 'id', value: Number(promotionId) }], conector: 'AND' })
      const response = await fetch(`${ordering.root}/offers?page=1&page_size=1&params=${PROMOTION_PARAMS}&where=${where}`, requestOptions)
      const content = await response.json()
      const error = content.error || (Array.isArray(content.result) && content.result.length === 0)
      const result = Array.isArray(content.result) ? (content.result[0] ?? [t('NOT_FOUND', 'Not found')]) : content.result
      if (!error) {
        setPromotionState({
          loading: false,
          promotion: result,
          error: null
        })
        // redesign PE-B3 (PE-13): a record opened by ?id= is not on the loaded page, so only this GET knows its businesses, sites, users and levels
        initSetting(result)
      } else {
        setPromotionState({
          ...promotionState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setPromotionState({
        ...promotionState,
        loading: false,
        error: [error.message]
      })
    }
  }

  useEffect(() => {
    if (!Object.keys(promotion || {}).length) {
      if (promotionId) {
        setIsAddMode(false)
        getPromotion()
      } else {
        setIsAddMode(true)
        setFormState({
          ...formState,
          changes: {
            ...formState?.changes,
            enabled: true,
            auto: false,
            public: true,
            condition_type: 1,
            type: 1,
            target: 1,
            rate_type: 1,
            stackable: false,
            rate: 0,
            sponsor: 'business'
          }
        })
        setSelectedBusinessIds([...selectedBusinessIds])
        setSelectedSitesIds([...selectedSitesIds])
        setSelectedProductsIds({ ...selectedProductsIds })
        setSelectedCategoryIds({ ...selectedCategoryIds })
        setSelectedUserIds([...selectedUserIds])
        setSelectedLoyaltyLevelIds([...selectedLoyaltyLevelIds])
      }
    } else {
      setIsAddMode(false)
      initSetting(promotion)
    }
    setPromotionState({ ...promotionState, promotion })
  }, [JSON.stringify(promotion || {}), promotionId])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            isAddMode={isAddMode}
            promotionState={promotionState}
            formState={formState}
            actionState={actionState}
            selectedBusinessIds={selectedBusinessIds}
            isSelectingAllBusinesses={isSelectingAllBusinesses}
            selectedSitesIds={selectedSitesIds}
            selectedProductsIds={selectedProductsIds}
            setSelectedProductsIds={setSelectedProductsIds}
            selectedCategoryIds={selectedCategoryIds}
            setSelectedCategoryIds={setSelectedCategoryIds}
            handleChangeImage={handleChangeImage}
            handleChangeInput={handleChangeInput}
            handleUpdateClick={handleUpdateClick}
            handleAddPromotion={handleAddPromotion}
            handleDeletePromotion={handleDeletePromotion}
            getPromotion={getPromotion}
            handleChangeItem={handleChangeItem}
            handleRemoveKey={handleRemoveKey}
            handleSelectSite={handleSelectSite}
            handleSelectAllBusiness={handleSelectAllBusiness}
            handleSelectBusiness={handleSelectBusiness}
            handleSelectAllSites={handleSelectAllSites}
            selectedUserIds={selectedUserIds}
            handleSelectUser={handleSelectUser}
            selectedLoyaltyLevelIds={selectedLoyaltyLevelIds}
            handleSelectLoyaltyLevel={handleSelectLoyaltyLevel}
            handleSelectAllLoyaltyLevels={handleSelectAllLoyaltyLevels}
            handleSelectAllUsers={handleSelectAllUsers}
          />
        )
      }
    </>
  )
}

EnterprisePromotionDetails.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
