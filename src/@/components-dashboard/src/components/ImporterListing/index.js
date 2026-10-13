import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const ImporterListing = (props) => {
  props = { ...defaultProps, ...props }
  const {
    UIComponent,
    paginationSettings
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [importerList, setImporterList] = useState({ loading: false, error: null, importers: [] })
  const [paginationProps, setPaginationProps] = useState({
    currentPage: (paginationSettings.controlType === 'pages' && paginationSettings.initialPage && paginationSettings.initialPage >= 1) ? paginationSettings.initialPage - 1 : 0,
    pageSize: paginationSettings.pageSize ?? 10,
    totalItems: null,
    totalPages: null
  })
  const [paginationDetail, setPaginationDetail] = useState({})
  const [actionStatus, setActionStatus] = useState({ loading: false, error: null })

  const getImporters = async (page, pageSize) => {
    try {
      setImporterList({ ...importerList, loading: true })
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = page
        ? await fetch(`${ordering.root}/importers?page=${page || paginationProps.currentPage}&page_size=${pageSize || paginationProps.pageSize}`, requestOptions)
        : await fetch(`${ordering.root}/importers`, requestOptions)
      const { result, pagination } = await response.json()

      setImporterList({
        ...importerList,
        loading: false,
        importers: result
      })

      let nextPageItems = 0
      if (pagination.current_page !== pagination.total_pages) {
        const remainingItems = pagination.total - importerList.importers.length
        nextPageItems = remainingItems < pagination.page_size ? remainingItems : pagination.page_size
      }

      setPaginationProps({
        ...paginationProps,
        currentPage: pagination.current_page,
        totalPages: pagination.total_pages,
        totalItems: pagination.total,
        from: pagination.from,
        to: pagination.to,
        nextPageItems
      })
      setPaginationDetail({ ...pagination })
    } catch (err) {
      if (err.constructor.name !== 'Cancel') {
        setImporterList({ ...importerList, loading: false, error: [err.message] })
      }
    }
  }

  const handleDeleteImporter = async (importerId) => {
    try {
      setActionStatus({ ...actionStatus, loading: true })
      const requestOptions = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
      const response = await fetch(`${ordering.root}/importers/${importerId}`, requestOptions)
      const content = await response.json()
      if (!content.error) {
        const importers = importerList.importers.filter(importer => importer.id !== importerId)
        setPaginationDetail({
          ...paginationDetail,
          totalPages: paginationDetail?.totalPages - 1,
          totalItems: paginationDetail?.totalItems - 1
        })
        setImporterList({ ...importerList, importers })
      }
      setActionStatus({
        ...actionStatus,
        loading: false,
        error: content.error ? content.result : null
      })
    } catch (err) {
      setActionStatus({ ...actionStatus, loading: false, error: [err.message] })
    }
  }

  /**
* Method to add user
* @param {Object} newImporter new user to add
*/
  const handleSuccessAddImporter = (newImporter) => {
    setImporterList({
      ...importerList,
      importers: [
        ...importerList.importers,
        newImporter
      ]
    })
    setPaginationDetail({
      ...paginationDetail,
      total: paginationDetail?.total ? paginationDetail?.total + 1 : 1
    })
  }

  /**
 * Method to update importers
 * @param {Object} updatedImporter updated importer
 */
  const handleSuccessUpdateImporter = (updatedImporter) => {
    const importers = importerList.importers.map(importer => {
      if (importer.id === updatedImporter.id) {
        return updatedImporter
      }
      return importer
    })
    setImporterList({
      ...importerList,
      importers
    })
  }

  useEffect(() => {
    getImporters()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          actionStatus={actionStatus}
          importerList={importerList}
          getImporters={getImporters}
          paginationProps={paginationProps}
          paginationDetail={paginationDetail}
          handleDeleteImporter={handleDeleteImporter}
          handleSuccessAddImporter={handleSuccessAddImporter}
          handleSuccessUpdateImporter={handleSuccessUpdateImporter}
        />
      )}
    </>
  )
}

ImporterListing.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * Slug from Store
   */
  slug: PropTypes.string,
  /**
   * True, flag to make initial API call
   */
  isInitialRender: PropTypes.bool

}

const defaultProps = {
  paginationSettings: { initialPage: 1, pageSize: 10, controlType: 'infinity' }
}
