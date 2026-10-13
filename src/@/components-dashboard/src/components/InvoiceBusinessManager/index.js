import React, { useEffect, useState } from 'react'
import PropTypes, { string } from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { useConfig } from '../../contexts/ConfigContext'
import { useLanguage } from '../../contexts/LanguageContext'

/**
 * Component to manage InvoiceBusunessManager behavior without UI component
 */
export const InvoiceBusinessManager = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    propsToFetch
  } = props

  const [ordering] = useApi()
  const [{ token, loading, user }] = useSession()
  const [{ configs }] = useConfig()

  const [, t] = useLanguage()

  const BUSINESSES_PAGE_SIZE = 10

  const [businessList, setBusinessList] = useState({ loading: false, businesses: [], error: null })
  const [businessSearchValue, setBusinessSearchValue] = useState('')
  const [businessPagination, setBusinessPagination] = useState({
    currentPage: 1,
    pageSize: BUSINESSES_PAGE_SIZE,
    totalPages: null,
    totalItems: null
  })
  const [payMethodsList, setPayMethodsList] = useState({ loading: false, data: [], error: null })

  const configTypes = configs?.order_types_allowed?.value.split('|').map(value => Number(value)) || []
  const defaultOrderTypes = [
    { value: 1, name: t('DELIVERY', 'Delivery'), enabled: true },
    { value: 2, name: t('PICKUP', 'Pickup'), enabled: true },
    { value: 3, name: t('EAT_IN', 'Eat in'), enabled: true },
    { value: 4, name: t('CURBSIDE', 'Curbside'), enabled: true },
    { value: 5, name: t('DRIVE_THRU', 'Drive thru'), enabled: true }
  ]

  const [orderTypes, setOrderTypes] = useState(
    defaultOrderTypes.filter(type => configTypes?.includes(type.value))
  )
  const [exportInvoiceList, setExportInvoiceList] = useState({ loading: false, invoice: null, error: null })
  const [businessInvocing, setBusinessInvocing] = useState({
    type: 'charge',
    from: '',
    to: '',
    business: '',
    cancelled: false,
    discounts: false,
    notes: '',
    percentage_fee: 0,
    fixed_fee: 0,
    tax: 0,
    misc_amount: 0,
    misc_description: ''
  })
  const [filterPaymethodsID, setFilterPaymethodsID] = useState([])
  const [filterOrderTypesID, setFilterOrderTypesID] = useState([])

  const handleChangeDeliveryTypes = (orderTypess) => {
    setFilterOrderTypesID(orderTypess)
  }

  const handleChangePayMethods = (payMethods) => {
    const _paymethodIds = payMethods.filter((_payMethods) => _payMethods.enabled).map((_payMethodss) => _payMethodss.id)
    setFilterPaymethodsID(_paymethodIds)
    setPayMethodsList({ ...payMethodsList, data: payMethods })
  }

  const filterPaymethods = (paymethods) => {
    const _paymethods = {
      apple_pay: true,
      google_pay: true,
      global_apple_pay: true,
      global_google_pay: true,
      stripe_connect: true
    }

    return paymethods?.filter?.(p => p.enabled && (_paymethods[p.gateway] !== false))
  }

  /**
   * Method to get business list
   * @param {number} page page to fetch
   * @param {number} pageSize page size
   * @param {string} search business name search
   */
  const getBusiness = async (page = 1, pageSize = BUSINESSES_PAGE_SIZE, search = '') => {
    try {
      setBusinessList(prev => ({ ...prev, loading: true }))

      const safePage = Number(page) >= 1 ? Number(page) : 1
      const safePageSize = Number(pageSize) >= 1 ? Number(pageSize) : BUSINESSES_PAGE_SIZE

      const conditions = []
      if (search && String(search).trim()) {
        conditions.push({
          attribute: 'name',
          value: { condition: 'ilike', value: encodeURI(`%${String(search).trim()}%`) }
        })
      }

      let content = null
      if (user?.level === 0) {
        const requestOptions = {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }
        const whereObj = conditions.length ? JSON.stringify({ conditions, conector: 'AND' }) : ''
        const whereParam = whereObj ? `&where=${whereObj}` : ''
        const params = Array.from(new Set(['id', ...(propsToFetch || [])])).join(',')
        const response = await fetch(
          `${ordering.root}/backoffice/businesses?params=${params}&page=${safePage}&page_size=${safePageSize}${whereParam}`,
          requestOptions
        )
        content = await response.json()
      } else {
        let fetchEndpoint = ordering.businesses().asDashboard().select(propsToFetch)
        if (conditions.length) {
          fetchEndpoint = fetchEndpoint.where({ conditions, conector: 'AND' })
        }
        const response = await fetchEndpoint.get({ query: { page: safePage, page_size: safePageSize } })
        content = response.content
      }
      const { error, result, pagination } = content || {}
      if (!error) {
        setBusinessList(prev => ({ ...prev, loading: false, businesses: result || [], pagination, error: null }))
        if (pagination) {
          setBusinessPagination(prev => ({
            currentPage: pagination.current_page ?? prev.currentPage,
            pageSize: pagination.page_size === 0 ? prev.pageSize : (pagination.page_size ?? prev.pageSize),
            totalPages: pagination.total_pages ?? null,
            totalItems: pagination.total ?? null
          }))
        }
      } else {
        setBusinessList(prev => ({ ...prev, loading: false, error: result }))
      }
    } catch (error) {
      setBusinessList(prev => ({ ...prev, loading: false, error: [error || error?.toString() || error?.message] }))
    }
  }

  const searchBusinesses = (val) => {
    const normalized = val == null ? '' : String(val).trim()
    setBusinessSearchValue(normalized)
    setBusinessPagination(prev => ({ ...prev, currentPage: 1 }))
    getBusiness(1, BUSINESSES_PAGE_SIZE, normalized)
  }

  const handleChangeBusinessPage = (page) => {
    getBusiness(page, businessPagination.pageSize, businessSearchValue)
  }

  /**
   * Method to get payMethod list from API
   */
  const getPaymentMethod = async () => {
    if (loading) return
    try {
      setPayMethodsList({ ...payMethodsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const functionFetch = `${ordering.root}/paymethods`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()

      setPayMethodsList({
        ...payMethodsList,
        loading: false,
        error: error ? result : null,
        data: !error ? filterPaymethods(result) : []
      })
    } catch (err) {
      setPayMethodsList({
        ...payMethodsList,
        loading: false,
        error: err
      })
    }
  }

  /**
   * Method to get order list from API
   */
  const getOrders = async () => {
    try {
      setExportInvoiceList({
        ...exportInvoiceList,
        loading: true
      })
      const where = [
        {
          attribute: 'business_id',
          value: businessInvocing.business
        }
      ]
      if (businessInvocing.from) {
        where.push({
          attribute: 'delivery_datetime',
          value: {
            condition: '>=',
            value: `${businessInvocing.from} 00:00:00`
          }
        })
      }
      if (businessInvocing.to) {
        where.push({
          attribute: 'delivery_datetime',
          value: {
            condition: '<=',
            value: `${businessInvocing.to} 23:59:59`
          }
        })
      }
      if (filterOrderTypesID.length !== 0) {
        where.push(
          {
            attribute: 'delivery_type',
            value: filterOrderTypesID
          }
        )
      }
      if (filterPaymethodsID.length !== 0) {
        where.push(
          {
            attribute: 'paymethod_id',
            value: filterPaymethodsID
          }
        )
      }
      const { content: { error, result, pagination } } = await ordering.orders().asDashboard().where(where).get()
      if (!error) {
        const invoice = getExportInvoice(result)
        setExportInvoiceList({
          ...exportInvoiceList,
          loading: false,
          invoice,
          pagination
        })
      } else {
        setExportInvoiceList({
          ...exportInvoiceList,
          loading: false,
          error: result
        })
      }
    } catch (error) {
      setExportInvoiceList({
        ...exportInvoiceList,
        loading: false,
        error: [error || error?.toString() || error?.message]
      })
    }
  }

  const getExportInvoice = (result) => {
    const paymethods = []
    for (const paymethod of payMethodsList?.data) {
      if (paymethod.enabled) paymethods.push(paymethod.id)
    }
    const _orderTypes = []
    if (orderTypes) {
      for (const orderType of orderTypes) {
        if (orderType.enabled) _orderTypes.push(orderType.value)
      }
    }
    let from = businessInvocing.from.split('-')
    if (from.length === 1) from = null
    else from = new Date(from[0], from[1] - 1, from[2], 0, 0, 0, 0)
    let to = businessInvocing.to.split('-')
    if (to.length === 1) to = null
    else to = new Date(to[0], to[1] - 1, to[2], 0, 0, 0, 0)
    const orders = result.filter((order) => {
      let valid = true
      let date = order.delivery_datetime.split(' ')
      date = new Date(date[0].split('-')[0], date[0].split('-')[1] - 1, date[0].split('-')[2], 0, 0, 0, 0)
      const orderPaymethodIds = order.payment_events.reduce((ids, event) => [...ids, event?.paymethod?.id], [])
      orderPaymethodIds.push(order.paymethod_id)
      const walletIds = order.payment_events.reduce((ids, event) => [...ids, event?.wallet_event?.wallet_id], [])
      if ((!orderPaymethodIds.some(id => paymethods.includes(id)) && !walletIds?.length) ||
        _orderTypes.indexOf(order.delivery_type) === -1 ||
        ([0, 1, 7, 8, 9, 11, 15].indexOf(order.status) === -1 && !businessInvocing.cancelled)) {
        valid = false
      }
      if ((from && from > date) || (to && to < date)) valid = false
      return valid
    })
    const _exportInvoice = {
      from: businessInvocing.from,
      to: businessInvocing.to,
      type: businessInvocing.type,
      orders,
      percentage_fee: businessInvocing.percentage_fee,
      fixed_fee: businessInvocing.fixed_fee,
      tax: businessInvocing.tax,
      misc_amount: (businessInvocing.type !== 'payout' ? 1 : -1) * businessInvocing.misc_amount,
      misc_description: businessInvocing.misc_description,
      inlcude_discounts: businessInvocing.discounts,
      tax_products: businessInvocing.type !== 'payout'
        ? 0
        : orders?.reduce(function (previous, current) {
          if (current.tax_type === 1) return previous
          else return previous + getTax(current)
        }, 0),
      discounts: !businessInvocing.discounts
        ? 0
        : orders?.reduce(function (previous, current) {
          return previous - getDiscount(current)
        }, 0),
      orders_subtotal: orders?.reduce(function (previous, current) {
        return previous + getSubtotal(current)
      }, 0),
      orders_total: orders?.reduce(function (previous, current) {
        return previous + getTotal(current)
      }, 0),
      notes: businessInvocing.notes.replace(/\n/g, '<br>')
    }
    _exportInvoice.percentage_fee_total = (businessInvocing.type !== 'payout' ? 1 : -1) * (_exportInvoice.orders_subtotal + _exportInvoice.discounts) * businessInvocing.percentage_fee / 100
    _exportInvoice.fixed_fee_total = (businessInvocing.type !== 'payout' ? 1 : -1) * orders.length * businessInvocing.fixed_fee
    const subtotal = parseFloat(_exportInvoice.percentage_fee_total) +
      parseFloat(_exportInvoice.fixed_fee_total) +
      parseFloat(_exportInvoice.misc_amount) +
      parseFloat(_exportInvoice.discounts) +
      parseFloat(_exportInvoice.tax_products) +
      (businessInvocing.type !== 'payout' ? 0 : parseFloat(_exportInvoice.orders_subtotal))
    _exportInvoice.subtotal = subtotal
    _exportInvoice.tax_total = (businessInvocing.type !== 'payout' ? 1 : -1) * subtotal * parseFloat(businessInvocing.tax) / 100
    _exportInvoice.total = subtotal + _exportInvoice.tax_total
    businessList.businesses.forEach(function (business) {
      if (business.id === businessInvocing.business) {
        _exportInvoice.business = business
      }
    })
    return _exportInvoice
  }

  /**
   * Method to get sub option total
   */
  const getSuboptionTotal = (option, suboption) => {
    let suboptionQuantity = 1
    let suboptionPrice = suboption.price
    if (option.allow_suboptionQuantity && suboption.quantity) {
      suboptionQuantity = suboption.quantity
    }
    if (option.with_half_option && suboption.position && suboption.position !== 'whole') {
      suboptionPrice = suboption.half_price
    }
    return suboptionPrice * suboptionQuantity
  }

  /**
   * Method to get product total
   */
  const getProductsTotal = (product) => {
    let total = 0
    if (product.options) {
      for (let i = 0; i < product.options.length; i++) {
        const option = product.options[i]
        if (option.suboptions) {
          for (let j = 0; j < option.suboptions.length; j++) {
            const suboption = option.suboptions[j]
            total += getSuboptionTotal(option, suboption)
          }
        }
      }
    }
    return (total + product.price) * product.quantity
  }

  /**
   * Method to get included taxes for products
   */
  const getIncludedTaxes = (order) => {
    if (!order?.taxes) return 0
    if (order?.taxes?.length === 0) {
      return order.tax_type === 1 ? order?.summary?.tax ?? 0 : 0
    } else {
      return order?.taxes.reduce((taxIncluded, tax) => {
        return taxIncluded + ((tax.type === 1 && tax.target === 'product') ? tax.summary?.tax : 0)
      }, 0)
    }
  }

  /**
   * Method to get order sub total
   */
  const getSubtotal = (order) => {
    if (!order.summary) {
      let subtotal = 0
      for (let i = 0; i < order.products.length; i++) {
        subtotal += getProductsTotal(order.products[i])
      }
      return roundPrice(subtotal)
    } else {
      // Match OrderBill calculation: subtotal + included taxes
      return order.summary.subtotal + getIncludedTaxes(order)
    }
  }

  /**
   * Method to get order tax
   */
  const getTax = (order) => {
    if (!order.summary) {
      const tax = (order.tax_type === 2) ? order.tax * (getSubtotal(order) - order.discount) / 100 : 0
      return roundPrice(tax)
    } else {
      return order.summary.tax
    }
  }

  /**
   * Method to get order discount
   */
  const getDiscount = (order) => {
    if (!order.summary) {
      return roundPrice(order.discount)
    } else {
      return order.summary.discount
    }
  }

  /**
   * Method to get converted number
   */
  const roundPrice = (value) => {
    const power = Math.pow(10, configs?.format_number_decimal_length?.value)
    const poweredVal = Math.round(value * power)
    return poweredVal / power
  }

  /**
   * Method to get order total
   */
  const getTotal = (order) => {
    if (!order.summary) {
      const subtotal = getSubtotal(order)
      const tax = getTax(order)
      const serviceFee = getServiceFee(order)
      const totalorder = order.delivery_type === '2' ? subtotal + tax + serviceFee - order.discount : subtotal + tax + order.delivery_zone_price + getDriverTip(order) + serviceFee - order.discount
      return roundPrice(totalorder)
    } else {
      return order.summary.total
    }
  }

  /**
   * Method to get order service fee
   */
  const getServiceFee = (order) => {
    if (!order.summary) {
      const subtotal = (getSubtotal(order) - order.discount) * order.service_fee / 100
      return roundPrice(subtotal)
    } else {
      return order.summary.service_fee
    }
  }

  /**
   * Method to get order driver tip
   */
  const getDriverTip = (order) => {
    if (!order.summary) {
      const tip = (getSubtotal(order) - order.discount) * order.driver_tip / 100
      return roundPrice(tip)
    } else {
      return order.summary.driver_tip
    }
  }

  useEffect(() => {
    const configTypes = configs?.order_types_allowed?.value.split('|').map(value => Number(value)) || []
    setOrderTypes(defaultOrderTypes.filter(type => configTypes?.includes(type.value)))
  }, [configs?.order_types_allowed?.value])

  useEffect(() => {
    getBusiness()
    getPaymentMethod()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          businessList={businessList}
          businessPagination={businessPagination}
          handleChangeBusinessPage={handleChangeBusinessPage}
          searchBusinesses={searchBusinesses}
          invocing={businessInvocing}
          payMethodsList={payMethodsList}
          orderTypes={orderTypes}
          exportInvoiceList={exportInvoiceList}
          handleChangeOrderTypes={setOrderTypes}
          handleChangeInvocing={setBusinessInvocing}
          handleChangePayMethods={handleChangePayMethods}
          getOrders={getOrders}
          getSubtotal={getSubtotal}
          getTotal={getTotal}
          handleChangeDeliveryTypes={handleChangeDeliveryTypes}
        />
      )}
    </>
  )
}

InvoiceBusinessManager.propTypes = {
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
  propsToFetch: ['name', 'lastname', 'email', 'phone', 'photo', 'cellphone', 'country_phone_code', 'city_id', 'city', 'address', 'addresses', 'address_notes', 'dropdown_option_id', 'dropdown_option', 'location', 'zipcode', 'level', 'enabled', 'middle_name', 'second_lastname']
}
