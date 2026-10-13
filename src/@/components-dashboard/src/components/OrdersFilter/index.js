import React from 'react'
import PropTypes from 'prop-types'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useSession } from '../../contexts/SessionContext'

dayjs.extend(utc)
dayjs.extend(timezone)

export const OrdersFilter = (props) => {
  const {
    UIComponent,
    filterValues,
    setFilterValues,
    handleFilterValues
  } = props

  const [{ user }] = useSession()

  /**
   * Changer order Id
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeOrderId = (e) => {
    const orderId = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setFilterValues({ ...filterValues, orderId })
  }

  /**
   * Changer external Id
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeExternalId = (e) => {
    setFilterValues({ ...filterValues, externalId: e?.target?.value })
  }

  /**
   * Changer filter value
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeMetaFieldValue = (e, id) => {
    const metafield = filterValues?.metafield.map(item => {
      if (id === item.id) {
        return {
          ...item,
          [e.target.name]: e.target.value
        }
      }
      return item
    })

    setFilterValues({ ...filterValues, metafield })
  }

  const handleAddMetaField = (item) => {
    setFilterValues({
      ...filterValues,
      metafield: [...filterValues?.metafield, item]
    })
  }

  const handleDeleteMetafield = (id) => {
    const metafield = filterValues?.metafield.filter(item => item.id !== id)
    setFilterValues({ ...filterValues, metafield })
  }

  /**
   * Change group type
   * * @param {object} groupType Group type
   */
  const handleChangeGroup = (groupType) => {
    let _groupTypes = [...filterValues.driverGroupBusinessIds]
    if (!_groupTypes.includes(groupType)) {
      _groupTypes.push(groupType)
    } else {
      _groupTypes = _groupTypes.filter((type) => type !== groupType)
    }

    // setGroupDriverIds(_driverIds)
    setFilterValues({ ...filterValues, driverGroupBusinessIds: _groupTypes })
  }

  /**
 * Change group type
 * * @param {object} groupTypeUnassigned Group type unassigned
 */
  const handleChangeGroupUnassigned = (groupTypeUnassigned) => {
    let _groupTypesUnassigned = [...filterValues.groupTypesUnassigned]
    if (!_groupTypesUnassigned.includes(groupTypeUnassigned)) {
      _groupTypesUnassigned.push(groupTypeUnassigned)
    } else {
      _groupTypesUnassigned = _groupTypesUnassigned.filter((type) => type !== groupTypeUnassigned)
    }

    // setGroupDriverIds(_driverIds)
    setFilterValues({ ...filterValues, groupTypesUnassigned: _groupTypesUnassigned })
  }
  /**
   * Change date type
   * * @param {string} dateType date type
  */
  const handleChangeDateType = (dateType) => {
    const now = dayjs()
    switch (dateType) {
      case 'default':
        setFilterValues({ ...filterValues, dateType: 'default', deliveryFromDatetime: null, deliveryEndDatetime: null })
        break
      case 'today': {
        let todayDatetime
        if (user?.timezone && user?.timezone !== 'UTC') {
          const nowInUserTimezone = now.tz(user?.timezone).startOf('day')
          todayDatetime = nowInUserTimezone.utc().format('YYYY-MM-DD HH:mm:ss')
        } else {
          const today = now.format('YYYY-MM-DD')
          todayDatetime = dayjs(today).format('YYYY-MM-DD HH:mm:ss')
        }
        setFilterValues({ ...filterValues, dateType: 'today', deliveryFromDatetime: todayDatetime, deliveryEndDatetime: null })
        break
      }
      case 'yesterday': {
        let yesterFrom
        let yesterEnd
        if (user?.timezone && user?.timezone !== 'UTC') {
          const yesterdayInUserTimezone = now.tz(user?.timezone).subtract(1, 'day').startOf('day')
          yesterFrom = yesterdayInUserTimezone.utc().format('YYYY-MM-DD HH:mm:ss')
          yesterEnd = yesterdayInUserTimezone.endOf('day').utc().format('YYYY-MM-DD HH:mm:ss')
        } else {
          const yesterday = now.subtract(1, 'day')
          yesterFrom = dayjs(yesterday).format('YYYY-MM-DD 00:00:00')
          yesterEnd = dayjs(yesterday).endOf('day').format('YYYY-MM-DD 23:59:59')
        }
        setFilterValues({ ...filterValues, dateType: 'yesterday', deliveryFromDatetime: yesterFrom, deliveryEndDatetime: yesterEnd })
        break
      }
      case 'last7': {
        const last7day = now.subtract('7', 'day').format('YYYY-MM-DD')
        const last7Datetime = dayjs(last7day).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'last7', deliveryFromDatetime: last7Datetime, deliveryEndDatetime: null })
        break
      }
      case 'last30': {
        const last30day = now.subtract('30', 'day').format('YYYY-MM-DD')
        const last30Datetime = dayjs(last30day).format('YYYY-MM-DD HH:mm:ss')
        setFilterValues({ ...filterValues, dateType: 'last30', deliveryFromDatetime: last30Datetime, deliveryEndDatetime: null })
        break
      }
      case 'term':
        setFilterValues({ ...filterValues, dateType: 'term', deliveryFromDatetime: null, deliveryEndDatetime: null })
    }
  }
  /**
   * Change start date
   * * @param {date} fromDate start date
  */
  const handleChangeFromDate = (fromDate) => {
    let fromDatetime
    if (fromDate !== null) {
      fromDatetime = dayjs(fromDate).format('YYYY-MM-DD HH:mm:ss')
    } else {
      fromDatetime = null
    }
    setFilterValues({ ...filterValues, deliveryFromDatetime: fromDatetime })
  }
  /**
   * Change end date
   * * @param {date} endDate end date
  */
  const handleChangeEndDate = (endDate) => {
    let endDatetime
    if (endDate !== null) {
      endDatetime = dayjs(endDate).format('YYYY-MM-DD HH:mm:ss')
    } else {
      endDatetime = null
    }
    setFilterValues({ ...filterValues, deliveryEndDatetime: endDatetime })
  }
  /**
   * Change businesses
   * * @param {number} businessId business id
  */
  const handleChangeBusinesses = (businessId) => {
    let _businessIds = [...filterValues.businessIds]
    if (!_businessIds.includes(businessId)) {
      _businessIds.push(businessId)
    } else {
      _businessIds = _businessIds.filter((_businessId) => _businessId !== businessId)
    }
    setFilterValues({ ...filterValues, businessIds: _businessIds })
  }
  /**
   * Change driver
   * * @param {number} driverId driver id
  */
  const handleChangeDriver = (driverId) => {
    let _driverIds = [...filterValues.driverIds]
    if (!_driverIds.includes(driverId)) {
      _driverIds.push(driverId)
    } else {
      _driverIds = _driverIds.filter((id) => id !== driverId)
    }
    setFilterValues({ ...filterValues, driverIds: _driverIds })
  }
  /**
   * Change city
   * * @param {number} cityId city id of business
  */
  const handleChangeCity = (cityId) => {
    let _cityIds = [...filterValues.cityIds]
    if (!_cityIds.includes(cityId)) {
      _cityIds.push(cityId)
    } else {
      _cityIds = _cityIds.filter((_cityId) => _cityId !== cityId)
    }
    setFilterValues({ ...filterValues, cityIds: _cityIds })
  }
  /**
   * Change country code
   * * @param {string} code code of country
  */
  const handleChangeCountryCode = (code) => {
    let _countryCode = [...filterValues.countryCode]
    if (!_countryCode.includes(code)) {
      _countryCode.push(code)
    } else {
      _countryCode = _countryCode.filter((_code) => _code !== code)
    }
    setFilterValues({ ...filterValues, countryCode: _countryCode })
  }

  /**
   * Change currency
   * * @param {string} code code of country
  */
  const handleChangeCurrency = (code) => {
    let _currency = [...filterValues.currency]
    if (!_currency.includes(code)) {
      _currency.push(code)
    } else {
      _currency = _currency.filter((_code) => _code !== code)
    }
    setFilterValues({ ...filterValues, currency: _currency })
  }

  /**
   * Change order status
   * * @param {number} status status
  */
  const handleChangeOrderStatus = (status) => {
    let _statuses = [...filterValues.statuses]
    if (!_statuses.includes(status)) {
      _statuses.push(status)
    } else {
      _statuses = _statuses.filter((_status) => _status !== status)
    }
    setFilterValues({ ...filterValues, statuses: _statuses })
  }
  /**
   * Change delivery type
   * * @param {number} deliveryType delivery type
  */
  const handleChangeDeliveryType = (deliveryType) => {
    let _deliveryTypes = [...filterValues.deliveryTypes]
    if (!_deliveryTypes.includes(deliveryType)) {
      _deliveryTypes.push(deliveryType)
    } else {
      _deliveryTypes = _deliveryTypes.filter((_deliveryType) => _deliveryType !== deliveryType)
    }
    setFilterValues({ ...filterValues, deliveryTypes: _deliveryTypes })
  }
  /**
   * Change paymethod type
   * * @param {number} paymethodId paymethod Id
  */
  const handleChangePaymethodType = (paymethodId) => {
    let _paymethodIds = [...filterValues.paymethodIds]
    if (!_paymethodIds.includes(paymethodId)) {
      _paymethodIds.push(paymethodId)
    } else {
      _paymethodIds = _paymethodIds.filter((_paymethodId) => _paymethodId !== paymethodId)
    }
    setFilterValues({ ...filterValues, paymethodIds: _paymethodIds })
  }
  /**
   * Change filter values
   * * @param {Object} changes filter value changes
  */
  const handleChangeChildFilterValue = (changes) => {
    setFilterValues({ ...filterValues, ...changes })
  }

  /**
   * Changer offer Id
   * @param {EventTarget} e Related HTML event
   */
  const handleChangeOfferId = (e) => {
    const offerId = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setFilterValues({ ...filterValues, offerId })
  }

  /**
   * Change admin
   * * @param {number} adminID admin id
  */
  const handleChangeAdmin = (adminId) => {
    let _adminIds = [...filterValues.administratorIds]
    if (!_adminIds.includes(adminId)) {
      _adminIds.push(adminId)
    } else {
      _adminIds = _adminIds.filter((id) => id !== adminId)
    }
    setFilterValues({ ...filterValues, administratorIds: _adminIds })
  }

  /**
   * Reset filter values
  */
  const handleResetFilterValues = () => {
    const initialValues = {
      orderId: null,
      externalId: null,
      groupTypes: [],
      groupTypesUnassigned: [],
      dateType: null,
      deliveryFromDatetime: null,
      deliveryEndDatetime: null,
      businessIds: [],
      driverIds: [],
      driverGroupIds: [],
      cityIds: [],
      statuses: [],
      deliveryTypes: [],
      paymethodIds: [],
      countryCode: [],
      currency: [],
      metafield: [],
      logisticStatus: null,
      assigned: null,
      driverGroupBusinessIds: [],
      customerName: null,
      customerEmail: null,
      customerCellphone: null,
      customerLastname: null,
      administratorIds: [],
      coupon: null,
      offerId: null,
      timeStatus: null,
      fraudStatus: null
    }
    setFilterValues(initialValues)
    handleFilterValues(initialValues)
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          handleChangeOrderId={handleChangeOrderId}
          handleChangeGroup={handleChangeGroup}
          handleChangeDateType={handleChangeDateType}
          handleChangeFromDate={handleChangeFromDate}
          handleChangeEndDate={handleChangeEndDate}
          handleChangeBusinesses={handleChangeBusinesses}
          handleChangeDriver={handleChangeDriver}
          handleChangeCity={handleChangeCity}
          handleChangeOrderStatus={handleChangeOrderStatus}
          handleChangeDeliveryType={handleChangeDeliveryType}
          handleChangePaymethodType={handleChangePaymethodType}
          handleResetFilterValues={handleResetFilterValues}
          handleChangeCountryCode={handleChangeCountryCode}
          handleChangeCurrency={handleChangeCurrency}
          handleChangeMetaFieldValue={handleChangeMetaFieldValue}
          handleAddMetaField={handleAddMetaField}
          handleDeleteMetafield={handleDeleteMetafield}
          handleChangeExternalId={handleChangeExternalId}
          handleChangeChildFilterValue={handleChangeChildFilterValue}
          handleChangeGroupUnassigned={handleChangeGroupUnassigned}
          handleChangeAdmin={handleChangeAdmin}
          handleChangeOfferId={handleChangeOfferId}
        />
      )}
    </>
  )
}

OrdersFilter.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
