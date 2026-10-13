import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

/**
 * Component to manage Home page behavior without UI component
 */
export const Home = (props) => {
  const {
    UIComponent
  } = props
  const [{ token, loading }] = useSession()
  const [ordering] = useApi()

  /** this is dumy data */
  const dumyDataList = [
    { id: 1, name: 'Create a store', addText: false, description: 'Go inside your Stores and Click Add New Store, fill up all the fields required and also add your banner and logo, if you don’t have one right now, don’t worry, you can add those later.', completed: false },
    { id: 2, name: 'Fill up your business information', addText: false, description: 'The business information will show on your front-end website, such as; business name, logo, banner, business email, slug = the word after your domain, orderinwebsite.co/store, and business description.', completed: false },
    { id: 3, name: 'Add your first category', addText: false, description: 'After you’ve clicked on the Add New Store and Filled up your business information you’ll get a blank screen, click on the Add Category button and add the name of your category.', completed: false },
    { id: 4, name: 'Add your first product', addText: false, description: 'Now, click in the category you’ve just added and create a product, the products cannot be created if you don’t have a category, add an image to that product, make it look good.', completed: false },
    { id: 5, name: 'Create a business menu', addText: false, description: 'To create a menu click in the store, a sidebar setting bar will show, inside here you’ll find the tab Menu, click Add Menu now, add a name, the delivery types, schedule, and at the bottom you’ll find all the products you have available to put inside this menu.', completed: false },
    { id: 6, name: 'Create a delivery zone', addText: false, description: 'Go back a little bit in your sidebar setting bar, click in Delivery Zones, name the delivery zones, put a minimum price of delivery, and the price is how much you are going to charge for delivery, click “+”, and add your delivery zone, by Polygon or Circle, create by clicking around the map your range of delivery.', completed: false },
    { id: 7, name: 'Payment method', addText: true, description: 'Last but not least, add a Payment Method, you’ll have several payment gateways, the biggest ones, PayPal, Stripe, or any other payment you want. That’s it! Look for your store in your Front-end Website.', completed: false }
  ]

  const [ordersList, setOrdersList] = useState({ loading: false, orders: 0, error: null })
  const [todaySalelsList, setTodaySalesList] = useState({ loading: false, sales: 0, error: null })
  const [monthSalesList, setMonthSalesList] = useState({ loading: false, sales: [], error: null })
  const [taskList, setTaskList] = useState({ loading: false, data: [], error: null })

  /**
   * Method to get task list
   */
  const getTasks = () => {
    setTaskList({
      ...taskList,
      data: dumyDataList
    })
  }

  /**
   * Method to update task list
   */
  const handleUpdateTaskList = (data) => {
    setTaskList({ ...taskList, data })
  }

  const getLocalDateYYYYMMDD = (date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Method to get orders list
   */
  const getOrders = async () => {
    if (loading) return
    try {
      setOrdersList((prev) => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/reports/orders?lapse=today`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const todayDate = getLocalDateYYYYMMDD()
        const ordersForToday = Array.isArray(result)
          ? result.filter((order) => String(order?.time ?? '').slice(0, 10) === todayDate)
          : []

        let totalOrders = 0
        if (ordersForToday.length > 0) {
          for (const order of ordersForToday) {
            totalOrders += Number.parseInt(order?.orders, 10) || 0
          }
        }
        setOrdersList((prev) => ({ ...prev, loading: false, orders: totalOrders }))
      } else {
        setOrdersList((prev) => ({ ...prev, loading: false, error: result }))
      }
    } catch (err) {
      setOrdersList((prev) => ({ ...prev, loading: false, error: err }))
    }
  }

  /**
   * Method to get sales list
   */
  const getSales = async () => {
    if (loading) return
    try {
      setTodaySalesList((prev) => ({ ...prev, loading: true }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const functionFetch = `${ordering.root}/reports/sales?lapse=today`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        const todayDate = getLocalDateYYYYMMDD()
        const salesForToday = Array.isArray(result)
          ? result.filter((sale) => String(sale?.time ?? '').slice(0, 10) === todayDate)
          : []

        let totalSales = 0
        if (salesForToday.length > 0) {
          for (const sale of salesForToday) {
            totalSales += Number(sale?.sales) || 0
          }
        }
        setTodaySalesList((prev) => ({ ...prev, loading: false, sales: totalSales }))
      } else {
        setTodaySalesList((prev) => ({ ...prev, loading: false, error: result }))
      }
    } catch (err) {
      setTodaySalesList((prev) => ({ ...prev, loading: false, error: err }))
    }
  }

  /**
   * Method to get sales list
   */
  const getMonthSales = async () => {
    if (loading) return
    try {
      setMonthSalesList({ ...monthSalesList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const lapse = getCurrentDateRange()
      const functionFetch = `${ordering.root}/reports/sales?lapse=${lapse}`

      const response = await fetch(functionFetch, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setMonthSalesList({
          ...monthSalesList,
          loading: false,
          sales: result
        })
      } else {
        setMonthSalesList({
          ...monthSalesList,
          loading: true,
          error: result
        })
      }
    } catch (err) {
      setMonthSalesList({
        ...monthSalesList,
        loading: false,
        error: err
      })
    }
  }

  const getCurrentDateRange = () => {
    const newDate = new Date()
    const date = newDate.getDate()
    const fullDate = date < 10 ? `0${date}` : date
    const month = newDate.getMonth() + 1
    const fullMonth = month < 10 ? `0${month}` : month
    const year = newDate.getFullYear()
    return `${year}-${fullMonth}-01,${year}-${fullMonth}-${fullDate}`
  }

  useEffect(() => {
    getOrders()
    getSales()
    getMonthSales()
    getTasks()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          ordersList={ordersList}
          todaySalelsList={todaySalelsList}
          monthSalesList={monthSalesList}
          taskList={taskList}
          getCurrentDateRange={getCurrentDateRange}
          handleUpdateTaskList={handleUpdateTaskList}
        />
      )}
    </>
  )
}

Home.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
