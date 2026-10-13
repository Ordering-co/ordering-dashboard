import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const IntegrationLogs = (props) => {
  props = { ...defaultProps, ...props }
  const {
    model,
    modelId,
    pluginId,
    UIComponent,
    paginationSettings
  } = props

  const [ordering] = useApi()
  const [session] = useSession()

  const [logsList, setLogsList] = useState({ logs: [], loading: true, error: null })
  const [selectedLogState, setSelectedLogState] = useState({ log: {}, loading: true, error: null })
  const [relatedGroupEvent, setRelatedGroupEvent] = useState(null)
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage - 1 : 0,
    pageSize: paginationSettings?.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })

  /**
   * Method to get logs from API
   */
  const getLogs = async (page, pageSize) => {
    try {
      setLogsList({ ...logsList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      let url = `${ordering.root}/logs?orderBy=-id&page=${page}&page_size=${pageSize}&params=model,model_id,event,type,created_at,group_key`
      let where = {}
      const conditions = []

      if (model) {
        conditions.push({
          attribute: 'model',
          value: model
        })
      }
      if (model && modelId) {
        conditions.push({
          attribute: 'model_id',
          value: modelId
        })
      }
      if (relatedGroupEvent) {
        conditions.push({
          attribute: 'group_key',
          value: relatedGroupEvent
        })
      }
      if (pluginId) {
        conditions.push({
          attribute: 'plugin_id',
          value: pluginId
        })
      }
      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      if (Object.keys(where).length) {
        url = `${url}&where=${JSON.stringify(where)}`
      }
      const response = await fetch(url, requestOptions)
      const { error, pagination, result } = await response.json()
      if (!error) {
        setLogsList({ ...logsList, loading: false, logs: result })
        setPaginationProps({
          ...paginationProps,
          currentPage: pagination.current_page,
          totalPages: pagination.total_pages,
          totalItems: pagination.total,
          from: pagination.from,
          to: pagination.to
        })
      } else {
        setLogsList({ ...logsList, loading: false, error })
      }
    } catch (err) {
      setLogsList({ ...logsList, loading: false, error: err.message })
    }
  }

  const getLog = async (id) => {
    try {
      setSelectedLogState({ ...selectedLogState, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        }
      }
      let url = `${ordering.root}/logs/${id}`
      let where = {}
      const conditions = []

      if (conditions.length) {
        where = {
          conditions,
          conector: 'AND'
        }
      }
      if (Object.keys(where).length) {
        url = `${url}&where=${JSON.stringify(where)}`
      }
      const response = await fetch(url, requestOptions)
      const { error, result } = await response.json()
      if (!error) {
        setSelectedLogState({ ...selectedLogState, loading: false, log: result })
      } else {
        setSelectedLogState({ ...selectedLogState, loading: false, error })
      }
    } catch (err) {
      setSelectedLogState({ ...selectedLogState, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    if (!selectedLogState?.log?.id) return
    getLog(selectedLogState?.log?.id)
  }, [selectedLogState?.log?.id])

  useEffect(() => {
    if (relatedGroupEvent === null) return
    getLogs(1, paginationSettings?.pageSize ?? 10)
  }, [relatedGroupEvent])

  useEffect(() => {
    getLogs(1, paginationSettings?.pageSize ?? 10)
  }, [modelId])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          logsList={logsList}
          selectedLogState={selectedLogState}
          setSelectedLogState={setSelectedLogState}
          relatedGroupEvent={relatedGroupEvent}
          setRelatedGroupEvent={setRelatedGroupEvent}
          paginationProps={paginationProps}
          getLogs={getLogs}
        />
      )}
    </>
  )
}

IntegrationLogs.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
