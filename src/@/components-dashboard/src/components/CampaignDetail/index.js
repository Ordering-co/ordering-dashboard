import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { CONFIG_CATEGORIES_VERSION } from '../../utils'

const categoryHideList = ['cloudinary', 'tookan', 'order_messages', 'others']
const configHideList = [
  'search_by_address',
  'distance_unit_km',
  'pickup',
  'orders_metafields_strategy',
  'order_validate',
  'time_format',
  'driver_close_distance',
  'lazy_load_products_when_necessary',
  'advanced_business_search_enabled'
]

export const CampaignDetail = (props) => {
  const {
    campaign,
    campaignId,
    campaignList,
    UIComponent,
    handleSuccessUpdateCampaign,
    handleSuccessAddCampaign,
    handleSuccessDeleteCampaign
  } = props

  const [, t] = useLanguage()
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [, { showToast }] = useToast()

  const [campaignState, setCampaignState] = useState({ campaign, loading: !campaign, error: null })
  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })
  const [isAddMode, setIsAddMode] = useState(false)
  const [audienceState, setAudienceState] = useState({ loading: false, audience: 0, error: null })
  const [categoryList, setCategoryList] = useState({ loading: false, categories: [], error: null })
  const [contactState, setContactState] = useState({ loading: false, changes: {}, error: null })

  /**
   * Clean formState
   */
  const cleanFormState = () => setFormState({ loading: false, changes: {} })

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
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeContactData = (e) => {
    const changes = formState.changes?.contact_data
      ? { ...formState.changes?.contact_data, [e.target.name]: e.target.value }
      : { [e.target.name]: e.target.value }
    setFormState({
      ...formState,
      changes: { ...formState.changes, contact_data: changes }
    })
  }

  /**
 * Update credential data
 * @param {EventTarget} e Related HTML event
 */
  const handleChangeParentContact = (name, value) => {
    const changes = formState.changes?.contact_data
      ? { ...formState.changes?.contact_data, [name]: value }
      : { [name]: value }
    setFormState({
      ...formState,
      changes: { ...formState.changes, contact_data: changes }
    })
  }

  /**
   * Update parameter data
   * @param {string} key parameters to change
   * @param {string} value parameters to change
   */
  const handleChangeItem = (key, value) => {
    const changes = { ...formState.changes, [key]: value }
    if (key === 'scheduled_at') {
      changes.status = value ? 'scheduled' : 'pending'
    }

    setFormState({
      ...formState,
      changes
    })
  }

  /**
   * Update parameter data
   * @param {string} name parameters to change
   * @param {string} value parameters to change
   */
  const handleChangeType = (name, value) => {
    const changes = { ...contactState?.changes, [name]: value }
    setContactState({ ...contactState, changes })

    if (isAddMode) {
      handleChangeItem && handleChangeItem(name, value)
    }
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
   * Default fuction for recovery action workflow
   */
  const handleUpdateClick = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const changes = { ...formState?.changes }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
        }
      }
      if (changes?.conditions) delete changes.conditions
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/marketing_campaigns/${campaign.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setCampaignState({
          ...campaignState,
          campaign: content.result
        })
        setFormState({ ...formState, loading: false, error: null, changes: {} })
        if (handleSuccessUpdateCampaign) {
          const updatedCampaigns = campaignList?.campaigns.filter(_action => {
            if (_action.id === campaign.id) {
              Object.assign(_action, content.result)
            }
            return true
          })
          handleSuccessUpdateCampaign(updatedCampaigns)
        }
        cleanFormState()
        showToast(ToastType.Success, t('CAMPAIGN_SAVED', 'Campaign saved'))
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to add new campaign from API
   */
  const handleAddCampaign = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })

      const changes = { ...formState?.changes }

      for (const key in changes) {
        // if (key === 'conditions' && changes[key].length > 0) {
        //   changes[key].forEach(change => {
        //     for (const innerKey in change) {
        //       if (change[innerKey] === null) delete change[innerKey]
        //     }
        //   })
        // }

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

      const response = await fetch(`${ordering.root}/marketing_campaigns`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setFormState({ ...formState, loading: false, error: null })
        handleSuccessAddCampaign && handleSuccessAddCampaign(content.result)
        showToast(ToastType.Success, t('CAMPAIGN_ADDED', 'Campaign added'))
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to delete a campaign
   */
  const handleDeleteCampaign = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/marketing_campaigns/${campaign.id}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        handleSuccessDeleteCampaign && handleSuccessDeleteCampaign(campaign.id)
        showToast(ToastType.Success, t('CAMPAIGN_DELETED', 'Campaign deleted'))
        setFormState({ ...formState, loading: false, error: null })
        props.onClose && props.onClose()
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to delete a campaign
   */
  const handleDeleteCondition = async (conditionId) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setFormState({ ...formState, loading: true, error: null })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/marketing_campaigns/${campaign.id}/conditions/${conditionId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        showToast(ToastType.Success, t('CONDITION_DELETED', 'Condition deleted'))
        setFormState({ ...formState, loading: false, error: null })
        if (handleSuccessUpdateCampaign) {
          const updatedCampaigns = campaignList?.campaigns.map(_action => {
            if (_action.id === campaign.id) {
              const conditions = _action.conditions.filter(item => item.id !== content.result.id)
              return {
                ..._action,
                conditions
              }
            }
            return _action
          })
          handleSuccessUpdateCampaign(updatedCampaigns)
        }
        const updatedConditions = campaignState?.campaign?.conditions.filter(item => item.type !== content?.result?.type)
        setCampaignState({
          ...campaignState,
          campaign: {
            ...campaignState?.campaign,
            conditions: updatedConditions
          }
        })
      } else {
        setFormState({
          ...formState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setFormState({
        ...formState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to get audience from API
   */
  const getAudience = async (conditions, contactType) => {
    try {
      setAudienceState({ ...audienceState, loading: true })
      const _conditions = [...conditions]
      _conditions.forEach(condition => {
        Object.keys(condition).forEach(key => {
          if (condition[key] === null) {
            delete condition[key]
          }
        })
      })

      const changes = { conditions: JSON.stringify(_conditions), contact_type: contactType }

      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/marketing_campaigns/audience`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        setAudienceState({
          ...audienceState,
          loading: false,
          error: null,
          audience: content?.result,
          pagination: content?.pagination
        })
      } else {
        setAudienceState({
          ...audienceState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setAudienceState({
        ...audienceState,
        loading: false,
        error: err.message
      })
    }
  }

  /**
   * Method to get parent categoryid
   */
  const getParentCategory = async () => {
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
      filterConditons.push({ attribute: 'key', value: 'key_pro' })

      const functionFetch = `${ordering.root}/config_categories?version=${CONFIG_CATEGORIES_VERSION}&where=${JSON.stringify(filterConditons)}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      if (!error && result.length > 0) {
        getConfigList(result[0].id)
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
  const getConfigList = async (id) => {
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
      filterConditons.push({ attribute: 'parent_category_id', value: parseInt(id) })

      const functionFetch = `${ordering.root}/config_categories?version=${CONFIG_CATEGORIES_VERSION}&orderBy=rank&where=${JSON.stringify(filterConditons)}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      if (!error) {
        const _result = result.filter(setting => !categoryHideList.includes(setting.key)).map(setting => {
          const configs = setting.configs?.filter(config => !configHideList.includes(config.key)).sort((a, b) => (a.rank * 1 > b.rank * 1) ? 1 : -1)
          return {
            ...setting,
            configs: [...configs]
          }
        })
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

  const handleUpdateCategoryList = (categories) => {
    setCategoryList({
      ...categoryList,
      categories
    })
  }

  const getCampaign = async () => {
    try {
      setCampaignState({
        ...campaignState,
        loading: true
      })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/marketing_campaigns/${campaignId}`
      const response = await fetch(functionFetch, requestOptions)
      const { result, error } = await response.json()
      if (!error) {
        setCampaignState({
          loading: false,
          campaign: result,
          error: null
        })
      } else {
        setCampaignState({
          ...campaignState,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setCampaignState({
        ...campaignState,
        loading: false,
        error: [error.message]
      })
    }
  }

  /**
   * Update credential data
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeData = (e) => {
    const contactData = { ...contactState.changes?.contact_data, [e.target.name]: e.target.value }
    setContactState({
      ...contactState,
      changes: { ...contactState.changes, contact_data: contactData }
    })

    if (isAddMode) {
      handleChangeContactData && handleChangeContactData(e)
    }
  }

  /**
 * Update credential data
 */
  const handleChangeContact = (name, value) => {
    const contactData = { ...formState.changes?.contact_data, [name]: value }
    setFormState({
      ...formState,
      changes: { ...formState.changes, contact_data: contactData }
    })

    if (isAddMode) {
      handleChangeParentContact && handleChangeParentContact(name, value)
    }
  }

  /**
   * Default fuction for recovery action workflow
   */
  const handleUpdateContact = async () => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))
      setContactState({ ...contactState, loading: true, error: null })

      const changes = { ...formState?.changes }
      for (const key in changes) {
        if ((typeof changes[key] === 'object' && changes[key] !== null) || Array.isArray(changes[key])) {
          changes[key] = JSON.stringify(changes[key])
        }
        delete changes?.contact_type
      }
      const requestOptions = {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      }

      const response = await fetch(`${ordering.root}/marketing_campaigns/${campaignState?.campaign?.id}`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setContactState({ ...contactState, loading: false, error: null })
        if (handleSuccessUpdateCampaign) {
          const updatedCampaigns = campaignList?.campaigns.filter(_campaign => {
            if (_campaign.id === campaignState?.campaign?.id) {
              Object.assign(_campaign, content.result)
            }
            return true
          })
          handleSuccessUpdateCampaign(updatedCampaigns)
        }
        showToast(ToastType.Success, t('CAMPAIGN_SAVED', 'Campaign saved'))
      } else {
        setContactState({
          ...contactState,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setContactState({
        ...contactState,
        loading: false,
        error: err.message
      })
    }
  }

  useEffect(() => {
    if (Object.keys(campaign).length === 0) {
      if (campaignId) {
        setIsAddMode(false)
        cleanFormState()
        getCampaign()
      } else {
        setIsAddMode(true)
        setFormState({
          ...formState,
          changes: {
            enabled: true,
            conditions: [],
            status: 'pending'
          }
        })
        setCampaignState({
          loading: false,
          campaign: {},
          error: null
        })
      }
    } else {
      setIsAddMode(false)
      cleanFormState()
      setCampaignState({
        ...campaignState,
        campaign
      })
    }
  }, [campaign, campaignId])

  useEffect(() => {
    getAudience(campaignState?.campaign?.conditions, campaignState?.campaign?.contact_type)
  }, [JSON.stringify(campaignState?.campaign?.conditions)])

  useEffect(() => {
    if (!isAddMode || !formState?.changes?.conditions) return
    const contactType = formState?.changes?.contact_type || campaignState?.campaign?.contact_type
    if (formState?.changes?.conditions?.length > 0 && contactType) getAudience(formState?.changes?.conditions, contactType)
  }, [JSON.stringify(formState?.changes?.conditions)])

  useEffect(() => {
    getParentCategory()
  }, [])

  useEffect(() => {
    if (isAddMode) return

    if (campaignState?.campaign && Object.keys(campaignState?.campaign).length > 0) {
      setContactState({
        ...contactState,
        changes: {
          contact_type: campaignState?.campaign?.contact_type || '',
          contact_data: campaignState?.campaign?.contact_data || {}
        }
      })
    }
  }, [campaignState?.campaign])

  useEffect(() => {
    if (!isAddMode) return

    if (formState?.changes && Object.keys(formState?.changes).length > 0) {
      setContactState({
        ...contactState,
        changes: {
          contact_type: formState?.changes?.contact_type || '',
          contact_data: formState?.changes?.contact_data || {}
        }
      })
    }
  }, [formState?.changes])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            isAddMode={isAddMode}
            audienceState={audienceState}
            campaignState={campaignState}
            contactState={contactState}
            formState={formState}
            handleChangeItem={handleChangeItem}
            handleChangeType={handleChangeType}
            handleChangeData={handleChangeData}
            handleChangeContact={handleChangeContact}
            handleUpdateContact={handleUpdateContact}
            handleChangeInput={handleChangeInput}
            handleAddCampaign={handleAddCampaign}
            handleDeleteCampaign={handleDeleteCampaign}
            handleUpdateClick={handleUpdateClick}
            handleRemoveKey={handleRemoveKey}
            handleChangeContactData={handleChangeContactData}
            handleChangeParentContact={handleChangeParentContact}
            setCampaignState={setCampaignState}
            handleDeleteCondition={handleDeleteCondition}
            categoryList={categoryList}
            handleUpdateCategoryList={handleUpdateCategoryList}
          />
        )
      }
    </>
  )
}

CampaignDetail.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
