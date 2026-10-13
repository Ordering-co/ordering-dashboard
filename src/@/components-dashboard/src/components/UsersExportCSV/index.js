import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const UsersExportCSV = (props) => {
  const {
    defaultUserTypesSelected,
    UIComponent,
    userTypesSelected,
    searchValue,
    isSearchByUserId,
    isSearchByUserEmail,
    isSearchByUserPhone,
    isSearchByUserName
  } = props
  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null, result: null })

  /**
   * Method to get csv from API
   */
  const getCSV = async (filterApply) => {
    if (loading) return
    try {
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const defaultConditions = []
      if (Array.isArray(defaultUserTypesSelected)) {
        defaultConditions.push({ attribute: 'level', value: defaultUserTypesSelected })
      }

      const filterConditons = []
      const isOrdersCountValue = props.multiFilterValues && props.multiFilterValues?.ordersCount && props.multiFilterValues?.ordersCount?.value

      if (filterApply) {
        if (userTypesSelected.length > 0) {
          filterConditons.push({ attribute: 'level', value: userTypesSelected })
        }
        // if (!disabledActiveStateCondition) {
        //   filterConditons.push({ attribute: 'enabled', value: selectedUserActiveState })
        // }
        if (searchValue) {
          const searchConditions = []
          if (isSearchByUserId) {
            searchConditions.push(
              {
                attribute: 'id',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            )
          }
          if (isSearchByUserEmail) {
            searchConditions.push(
              {
                attribute: 'email',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            )
          }
          if (isSearchByUserPhone) {
            searchConditions.push(
              {
                attribute: 'cellphone',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            )
          }
          if (isSearchByUserName) {
            searchConditions.push(
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            )
            searchConditions.push(
              {
                attribute: 'lastname',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${searchValue}%`)
                }
              }
            )
          }

          filterConditons.push({
            conector: 'OR',
            conditions: searchConditions
          })
        }
        if (Object.keys(props.multiFilterValues || {})?.length > 0) {
          const searchConditions = []
          if (props.multiFilterValues?.name && props.multiFilterValues?.name !== null) {
            searchConditions.push(
              {
                attribute: 'name',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${props.multiFilterValues?.name}%`)
                }
              }
            )
          }
          if (props.multiFilterValues?.lastname && props.multiFilterValues?.lastname !== null) {
            searchConditions.push(
              {
                attribute: 'lastname',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${props.multiFilterValues?.lastname}%`)
                }
              }
            )
          }
          if (props.multiFilterValues?.email && props.multiFilterValues?.email !== null) {
            searchConditions.push(
              {
                attribute: 'email',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${props.multiFilterValues?.email}%`)
                }
              }
            )
          }
          if (props.multiFilterValues?.cellphone && props.multiFilterValues?.cellphone !== null) {
            searchConditions.push(
              {
                attribute: 'cellphone',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${props.multiFilterValues?.cellphone}%`)
                }
              }
            )
          }
          if (props.multiFilterValues?.countryPhoneCode !== null) {
            searchConditions.push(
              {
                attribute: 'country_phone_code',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${props.multiFilterValues?.countryPhoneCode}%`)
                }
              }
            )
          }
          if (props.multiFilterValues?.cityIds.length !== 0) {
            searchConditions.push(
              {
                attribute: 'city_id',
                value: props.multiFilterValues?.cityIds
              }
            )
          }
          if (props.multiFilterValues?.phoneVerified !== null) {
            searchConditions.push(
              {
                attribute: 'phone_verified',
                value: props.multiFilterValues?.phoneVerified
              }
            )
          }
          if (props.multiFilterValues?.emailVerified !== null) {
            searchConditions.push(
              {
                attribute: 'email_verified',
                value: props.multiFilterValues?.emailVerified
              }
            )
          }
          if (props.multiFilterValues?.userType !== null) {
            searchConditions.push(
              {
                attribute: 'level',
                value: props.multiFilterValues?.userType
              }
            )
          }
          if (props.multiFilterValues?.loyaltyLevel !== null) {
            searchConditions.push(
              {
                attribute: 'loyalty_level_id',
                value: props.multiFilterValues?.loyaltyLevel
              }
            )
          }
          if (props.multiFilterValues?.enabled !== null) {
            searchConditions.push(
              {
                attribute: 'enabled',
                value: props.multiFilterValues?.enabled
              }
            )
          }
          if (props.multiFilterValues?.deliveryFromDatetime !== null) {
            searchConditions.push(
              {
                attribute: 'created_at',
                value: {
                  condition: '>=',
                  value: props.multiFilterValues?.deliveryFromDatetime
                }
              }
            )
          }
          if (props.multiFilterValues?.deliveryEndDatetime !== null) {
            searchConditions.push(
              {
                attribute: 'created_at',
                value: {
                  condition: '<=',
                  value: props.multiFilterValues?.deliveryEndDatetime
                }
              }
            )
          }

          if (searchConditions.length) {
            filterConditons.push({
              conector: 'AND',
              conditions: searchConditions
            })
          }
        }
      }
      const filterConditonsObj = {
        conditions: filterConditons,
        conector: 'AND'
      }
      const commonParams = {
        mode: 'dashboard',
        orderBy: 'id',
        version: 'v2'
      }

      const transformedCommonParams = Object.keys(commonParams).map(key => {
        return `${key}=${commonParams[key]}`
      }).join('&')

      const functionFetch = filterApply
        ? isOrdersCountValue
          ? `${ordering.root}/users_new.csv?${transformedCommonParams}&orders_count_condition=${(props.multiFilterValues?.ordersCount?.condition)}&orders_count_value=${(props.multiFilterValues?.ordersCount?.value)}&where=${JSON.stringify(filterConditonsObj)}`
          : `${ordering.root}/users_new.csv?${transformedCommonParams}&where=${JSON.stringify(filterConditonsObj)}`
        : defaultConditions.length > 0
          ? `${ordering.root}/users_new.csv?${transformedCommonParams}&where=${JSON.stringify(defaultConditions)}`
          : `${ordering.root}/users_new.csv?${transformedCommonParams}`

      const response = await fetch(functionFetch, requestOptions)
      const content = await response.json()
      setActionStatus({
        loading: false,
        result: content.result,
        error: null
      })
    } catch (err) {
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: err
      })
    }
  }
  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          actionStatus={actionStatus}
          getCSV={getCSV}
        />
      )}
    </>
  )
}

UsersExportCSV.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
