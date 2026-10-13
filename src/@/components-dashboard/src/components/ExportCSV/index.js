import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const ExportCSV = (props) => {
  const {
    UIComponent,
    filterValues,
    ordersStatusGroup,
    selectedSubOrderStatus,
    franchiseId
  } = props
  const [ordering] = useApi()
  const [{ token, loading }] = useSession()
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null, result: null })

  /**
   * Method to get csv from API
   */
  const getCSV = async (filterApply, exportWithoutMetafields, statusesOverride) => {
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
      const filterConditons = []
      const propsToFetch = ['paymethod', 'payment_events', 'driver', 'driver_group', 'driver_company', 'agent', 'delivery_datetime', 'unread', 'franchise']
      if (!exportWithoutMetafields) {
        propsToFetch.push('metafields')
      }
      if (franchiseId) {
        filterConditons.push({
          attribute: 'ref_business',
          conditions: [{
            attribute: 'franchise_id',
            value: franchiseId
          }]
        })
      }

      if (filterApply) {
        if (Object.keys(filterValues).length) {
          if (statusesOverride?.length) {
            filterConditons.push({ attribute: 'status', value: statusesOverride })
          } else if (filterValues.statuses !== undefined) {
            if (filterValues.statuses?.length > 0) {
              filterConditons.push({ attribute: 'status', value: filterValues.statuses })
            } else {
              filterConditons.push({ attribute: 'status', value: selectedSubOrderStatus[ordersStatusGroup] || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })
            }
          }
          if (filterValues?.externalId) {
            filterConditons.push(
              {
                attribute: 'external_id',
                value: {
                  condition: 'ilike',
                  value: encodeURIComponent(`%${filterValues?.externalId}%`)
                }
              }
            )
          }
          if (filterValues?.orderId) {
            filterConditons.push(
              {
                attribute: 'id',
                value: {
                  condition: 'ilike',
                  value: encodeURI(`%${filterValues?.orderId}%`)
                }
              }
            )
          }
          if (filterValues?.logisticStatus !== null) {
            filterConditons.push(
              {
                attribute: 'logistic_status',
                value: filterValues?.logisticStatus
              }
            )
          }
          if (filterValues?.assigned !== null) {
            if (filterValues?.assigned === 0) {
              filterConditons.push(
                {
                  attribute: 'driver_id',
                  value: {
                    condition: '>=',
                    value: 0
                  }
                }
              )
            }
            if (filterValues?.assigned === 1) {
              filterConditons.push(
                {
                  attribute: 'driver_id',
                  value: null
                }
              )
            }
          }
          if (filterValues?.externalId) {
            filterConditons.push(
              {
                attribute: 'external_id',
                value: {
                  condition: 'ilike',
                  value: encodeURIComponent(`%${filterValues?.externalId}%`)
                }
              }
            )
          }
          if (filterValues.deliveryFromDatetime !== null) {
            filterConditons.push(
              {
                attribute: 'delivery_datetime',
                value: {
                  condition: '>=',
                  value: encodeURI(filterValues.deliveryFromDatetime)
                }
              }
            )
          }
          if (filterValues.deliveryEndDatetime !== null) {
            filterConditons.push(
              {
                attribute: 'delivery_datetime',
                value: {
                  condition: '<=',
                  value: filterValues.deliveryEndDatetime
                }
              }
            )
          }
          if (filterValues?.countryCode?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'country_code',
                value: filterValues?.countryCode
              }
            )
          }
          if (filterValues?.currency?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'currency',
                value: filterValues?.currency
              }
            )
          }
          if (filterValues.deliveryEndDatetime !== undefined) {
            if (filterValues.deliveryEndDatetime !== null) {
              filterConditons.push(
                {
                  attribute: 'delivery_datetime',
                  value: {
                    condition: '<=',
                    value: filterValues.deliveryEndDatetime
                  }
                }
              )
            }
          }
          if (filterValues.businessIds !== undefined) {
            if (filterValues.businessIds?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'business_id',
                  value: filterValues.businessIds
                }
              )
            }
          }
          if (filterValues.driverIds !== undefined) {
            if (filterValues.driverIds?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'driver_id',
                  value: filterValues.driverIds
                }
              )
            }
          }
          if (filterValues.deliveryTypes !== undefined) {
            if (filterValues.deliveryTypes?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'delivery_type',
                  value: filterValues.deliveryTypes
                }
              )
            }
          }
          if (filterValues.driverGroupIds?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'driver_group_id',
                value: filterValues.driverGroupIds
              }
            )
          }
          if (filterValues.driverGroupBusinessIds?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'driver_group_business',
                conditions: [
                  {
                    attribute: 'driver_group_id',
                    value: {
                      condition: '=',
                      value: filterValues.driverGroupBusinessIds
                    }
                  }
                ]
              }
            )
          }
          if (filterValues.paymethodIds !== undefined) {
            if (filterValues.paymethodIds?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'paymethod_id',
                  value: filterValues.paymethodIds
                }
              )
            }
          }
          if (filterValues?.cityIds?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'business',
                conditions: [
                  {
                    attribute: 'city_id',
                    value: filterValues?.cityIds
                  }
                ]
              }
            )
          }
          if (filterValues?.customerName) {
            filterConditons.push(
              {
                attribute: 'customer',
                conditions: [
                  {
                    attribute: 'name',
                    value: {
                      condition: 'ilike',
                      value: encodeURI(`%${filterValues?.customerName}%`)
                    }
                  }
                ]
              }
            )
          }
          if (filterValues?.customerLastname) {
            filterConditons.push(
              {
                attribute: 'customer',
                conditions: [
                  {
                    attribute: 'lastname',
                    value: {
                      condition: 'ilike',
                      value: encodeURI(`%${filterValues?.customerLastname}%`)
                    }
                  }
                ]
              }
            )
          }
          if (filterValues?.customerCellphone) {
            filterConditons.push(
              {
                attribute: 'customer',
                conditions: [
                  {
                    attribute: 'cellphone',
                    value: {
                      condition: 'ilike',
                      value: encodeURI(`%${filterValues?.customerCellphone}%`)
                    }
                  }
                ]
              }
            )
          }
          if (filterValues?.customerEmail) {
            filterConditons.push(
              {
                attribute: 'customer',
                conditions: [
                  {
                    attribute: 'email',
                    value: {
                      condition: 'ilike',
                      value: encodeURI(`%${filterValues?.customerEmail}%`)
                    }
                  }
                ]
              }
            )
          }
          if (filterValues.administratorIds?.length !== 0) {
            filterConditons.push(
              {
                attribute: 'agent_id',
                value: filterValues.administratorIds
              }
            )
          }
          if (filterValues?.offerId !== null) {
            if (filterValues.offerId?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'offers',
                  conditions: [
                    {
                      attribute: 'offer_id',
                      value: {
                        condition: '=',
                        value: filterValues?.offerId
                      }
                    }
                  ]
                }
              )
            }
          }
          if (filterValues.coupon !== null) {
            if (filterValues.coupon?.length !== 0) {
              filterConditons.push(
                {
                  attribute: 'offers',
                  conditions: [
                    {
                      attribute: 'coupon',
                      value: {
                        condition: '=',
                        value: filterValues?.coupon
                      }
                    }
                  ]
                }
              )
            }
          }
        }
      }
      const functionFetch = filterApply
        ? `${ordering.root}/orders_v2.csv?mode=dashboard&orderBy=id&where=${JSON.stringify(filterConditons)}&params=${propsToFetch}`
        : `${ordering.root}/orders_v2.csv?mode=dashboard&orderBy=id&params=${propsToFetch}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setActionStatus({
          ...actionStatus,
          loading: false,
          result,
          error: null
        })
      } else {
        setActionStatus({
          ...actionStatus,
          loading: false,
          error: result
        })
      }
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

ExportCSV.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
