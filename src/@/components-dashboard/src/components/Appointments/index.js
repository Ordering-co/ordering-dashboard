import React, { useState, useEffect, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'
import { readRememberedBusiness, writeRememberedBusiness } from './rememberedBusiness'

// the largest page the API gives for calendar_events
const EVENTS_PAGE_SIZE = 50

// Reading `window.localStorage` itself can throw (blocked storage), so it is guarded here.
const getStorage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch (err) {
    return null
  }
}

export const Appointments = (props) => {
  const {
    UIComponent
  } = props

  const [ordering] = useApi()
  const [{ token, user }] = useSession()

  const project = ordering?.project
  const userId = user?.id

  const [selectedBusiness, setSelectedBusinessState] = useState(() => readRememberedBusiness(getStorage(), project, userId))
  // `businessId` is the business the last FINISHED result (success or error) belongs to; it stays while loading.
  const [businessCalendarEvents, setBusinessCalendarEvents] = useState({ loading: false, result: [], error: null, businessId: null })

  // Every request takes a number; only the answer of the last one may write the state.
  const lastRequest = useRef(0)
  // The business read from memory at mount (checked once) and the one the user holds now.
  const rememberedAtMount = useRef(selectedBusiness)
  const currentBusiness = useRef(selectedBusiness)
  // A rename found by the check keeps the id: the events must not be asked again for that new object.
  const renamedBusiness = useRef(null)

  /**
   * Choose a business and remember it for this project and user
   */
  const setSelectedBusiness = useCallback((business) => {
    currentBusiness.current = business
    setSelectedBusinessState(business)
    writeRememberedBusiness(getStorage(), project, userId, business)
  }, [project, userId])

  /**
   * Method to get the calendar events of business from API
   */
  const getBusinessCalendarEvents = async () => {
    const requestId = ++lastRequest.current
    const isLast = () => requestId === lastRequest.current
    const businessId = selectedBusiness.id
    try {
      setBusinessCalendarEvents(prev => ({ ...prev, loading: true, result: [], error: null }))
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      // redesign (row 50, R1-07): the API always pages calendar_events (page_size at most 50) and main read only the
      // first page. Page 1 says how many there are; the others are asked together (review F-2) and the list shows once with all of
      // them, in page order; a failing page is an error, not a partial list
      const readPage = async (page) => {
        const response = await fetch(`${ordering.root}/business/${businessId}/calendar_events?page=${page}&page_size=${EVENTS_PAGE_SIZE}`, requestOptions)
        return response.json()
      }
      const fail = (result) => setBusinessCalendarEvents(prev => ({ ...prev, loading: false, result: [], error: result, businessId }))
      const first = await readPage(1)
      if (!isLast()) return
      if (first.error) return fail(first.result)
      const totalPages = Number(first.pagination?.total_pages) || 1
      const rest = await Promise.all(Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) => readPage(index + 2)))
      if (!isLast()) return
      const failed = rest.find(content => content.error)
      if (failed) return fail(failed.result)
      const events = [first, ...rest].flatMap(content => (Array.isArray(content.result) ? content.result : []))
      setBusinessCalendarEvents(prev => ({
        ...prev,
        loading: false,
        result: events,
        error: null,
        businessId
      }))
    } catch (err) {
      if (!isLast()) return
      setBusinessCalendarEvents(prev => ({
        ...prev,
        loading: false,
        result: [],
        error: [err.message],
        businessId
      }))
    }
  }

  /**
   * Check the business remembered from a previous visit (R1-03). The API answers 200 [] to the events of a
   * business that no longer exists, so the error never arrives: ask the business itself, like BusinessDetails.
   */
  const checkRememberedBusiness = async (remembered) => {
    try {
      const { content } = await ordering
        .setAccessToken(token)
        .businesses(remembered.id)
        .asDashboard()
        .select(['id', 'name', 'timezone'])
        .get()
      // The user chose (or cleared) another business meanwhile: this answer is about a stale one.
      if (currentBusiness.current?.id !== remembered.id) return
      const result = content.result
      const exists = !content.error && result && typeof result === 'object' && !Array.isArray(result) &&
        result.id !== undefined && result.id !== null && result.id !== ''
      if (!exists) {
        writeRememberedBusiness(getStorage(), project, userId, null)
        currentBusiness.current = null
        // Drop the events that were asked in parallel, whether they came already or not.
        lastRequest.current++
        setSelectedBusinessState(null)
        setBusinessCalendarEvents({ loading: false, result: [], error: null, businessId: null })
        return
      }
      // a store renamed, or whose zone is new or changed, is updated without asking its events again
      const name = typeof result.name === 'string' ? result.name : remembered.name
      const timezone = typeof result.timezone === 'string' ? result.timezone : remembered.timezone
      if (name !== remembered.name || timezone !== remembered.timezone) {
        const renamed = timezone === undefined ? { id: remembered.id, name } : { id: remembered.id, name, timezone }
        currentBusiness.current = renamed
        renamedBusiness.current = renamed
        setSelectedBusinessState(renamed)
        writeRememberedBusiness(getStorage(), project, userId, renamed)
      }
    } catch (err) {
      // Could be the connection: forget nothing and change nothing.
    }
  }

  /**
   * Ask again for the events of the chosen business (retry)
   */
  const refreshCalendarEvents = () => {
    if (!selectedBusiness) return
    getBusinessCalendarEvents()
  }

  useEffect(() => {
    if (!selectedBusiness) return
    if (renamedBusiness.current === selectedBusiness) {
      renamedBusiness.current = null
      return
    }
    getBusinessCalendarEvents()
  }, [selectedBusiness])

  // Only a business that came from memory is checked, once per mount.
  useEffect(() => {
    const remembered = rememberedAtMount.current
    rememberedAtMount.current = null
    if (!remembered) return
    checkRememberedBusiness(remembered)
  }, [])

  return (
    <>
      {
        UIComponent && (
          <UIComponent
            {...props}
            selectedBusiness={selectedBusiness}
            setSelectedBusiness={setSelectedBusiness}
            businessCalendarEvents={businessCalendarEvents}
            refreshCalendarEvents={refreshCalendarEvents}
          />
        )
      }
    </>
  )
}

Appointments.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
