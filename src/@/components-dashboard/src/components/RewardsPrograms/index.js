import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'
import { useLanguage } from '../../contexts/LanguageContext'

export const RewardsPrograms = (props) => {
  const {
    UIComponent,
    type
  } = props

  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [, t] = useLanguage()
  const [loyaltyPlanList, setLoyaltyPlanList] = useState({ loading: true, error: null, loyaltyPlans: [], pagination: null })
  const [pointWallet, setPointWallet] = useState(null)

  /**
   * Method to update the pointsWallet business
   */
  const handleUpdateWalletBusiness = (result) => {
    const businesses = pointWallet?.businesses.map(business => {
      if (business.id === result.id) {
        return {
          ...business,
          ...result
        }
      }
      return business
    })

    setPointWallet({
      ...pointWallet,
      businesses
    })
  }

  /**
   * Method to add the pointsWallet business
   */
  const handleAddWalletBusiness = (result) => {
    const businesses = [...pointWallet?.businesses, result]
    setPointWallet({
      ...pointWallet,
      businesses
    })
  }

  /**
   * Method to add the pointsWallet business
   */
  const handleDeleteWalletBusiness = (result) => {
    const businesses = pointWallet?.businesses?.filter(business => business.id !== result.id)
    setPointWallet({
      ...pointWallet,
      businesses
    })
  }

  /**
   * Method to update the pointsWallet
   */
  const handleUpdatePointsWallet = (changes) => {
    setPointWallet({ ...changes })
  }

  /**
   * Method to get loyalty plans from API
   */
  const getLoyaltyPlans = async () => {
    if (loading) return
    try {
      setLoyaltyPlanList({ ...loyaltyPlanList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/loyalty_plans`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result, pagination } = await response.json()
      if (!error) {
        const loyalty = result.find(plan => plan.type === type)
        setLoyaltyPlanList({
          ...loyaltyPlanList,
          ...(loyalty && { loading: false }),
          loyaltyPlans: result,
          pagination
        })
        if (loyalty) setPointWallet(JSON.parse(JSON.stringify(loyalty)))
        else await getBusinessTypes()
      } else {
        setLoyaltyPlanList({
          ...loyaltyPlanList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setLoyaltyPlanList({
        ...loyaltyPlanList,
        loading: false,
        error: err
      })
    }
  }

  const createWallet = async (businessId) => {
    try {
      const payload = {
        name: `Loyalty ${type === 'cashback' ? 'Cash' : 'Point'} Plan`,
        type,
        redemption_rate: 1,
        accumulation_rate: 1,
        businesses: JSON.stringify([
          {
            id: businessId,
            accumulates: true,
            redeems: true
          }
        ])
      }
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      }

      const response = await fetch(`${ordering.root}/loyalty_plans`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setPointWallet(content.result)
        const loyaltyPlans = JSON.parse(JSON.stringify(loyaltyPlanList.loyaltyPlans))
        loyaltyPlans.push(content.result)
        setLoyaltyPlanList({
          ...loyaltyPlanList,
          loading: false,
          loyaltyPlans
        })
      } else {
        setLoyaltyPlanList({
          ...loyaltyPlanList,
          loading: false,
          error: content.result
        })
      }
    } catch (err) {
      setLoyaltyPlanList({
        ...loyaltyPlanList,
        loading: false,
        error: err
      })
    }
  }

  /**
   * Method to get business types from API
   */
  const getBusinessTypes = async () => {
    try {
      const requestOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      }
      const response = await fetch(`${ordering.root}/backoffice/businesses?params=id&page=1&page_size=10`, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        if (result?.length > 0) {
          await createWallet(result[0]?.id)
        } else {
          setLoyaltyPlanList({
            ...loyaltyPlanList,
            loading: false,
            error: t('MOBILE_HAVE_NO_BUSINESS', 'You have no businesses available.')
          })
        }
      } else {
        setLoyaltyPlanList({
          ...loyaltyPlanList,
          loading: false,
          error: result
        })
      }
    } catch (err) {
      setLoyaltyPlanList({
        ...loyaltyPlanList,
        loading: false,
        error: err
      })
    }
  }

  useEffect(() => {
    getLoyaltyPlans()
  }, [type])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          loyaltyPlanList={loyaltyPlanList}
          pointWallet={pointWallet}
          handleUpdateWalletBusiness={handleUpdateWalletBusiness}
          handleUpdatePointsWallet={handleUpdatePointsWallet}
          handleAddWalletBusiness={handleAddWalletBusiness}
          handleDeleteWalletBusiness={handleDeleteWalletBusiness}
        />
      )}
    </>
  )
}

RewardsPrograms.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
