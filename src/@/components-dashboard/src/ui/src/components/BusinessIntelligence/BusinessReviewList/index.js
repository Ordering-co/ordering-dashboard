import React, { useEffect } from 'react'
import { useLanguage, DashboardBusinessList as BusinessListController } from '../../../../../index'
import { addQueryToUrl } from '../../../utils'
import { ReviewsPagination, ReviewsTable } from '../ReviewsDirectory/ReviewsTable'

// redesign reviews FD1 (D1, RV-03, RV-05, RV-06, RV-08): the businesses list is a Product table with a Product foot. It no longer
// mounts the panel (SideBar, Confirm): the page opens it in its SplitView, so this list tells which row was chosen (`onOpenRow`)
// and draws which one is open (`activeId`). The controller of main is the same, with the same props.
export const BusinessReviewsListingUI = (props) => {
  const {
    businessList,
    pagination,
    parentSearchValue,
    getPageBusinesses,
    onSearch,
    isUseQuery,
    activeId,
    onOpenRow
  } = props

  const [, t] = useLanguage()

  useEffect(() => {
    if (parentSearchValue === null) return
    onSearch(parentSearchValue)
  }, [parentSearchValue])

  useEffect(() => {
    if (!isUseQuery || !pagination?.currentPage || !pagination?.pageSize || !pagination?.total) return
    addQueryToUrl({
      page: pagination.currentPage,
      pageSize: pagination.pageSize
    })
  }, [pagination?.currentPage, pagination?.pageSize, pagination?.total])

  return (
    <>
      <ReviewsTable
        kind='business'
        label={t('BUSINESS', 'Business')}
        nameHeader={t('BUSINESS', 'Business')}
        rows={businessList.businesses ?? []}
        loading={businessList.loading}
        error={businessList.error}
        onRetry={() => getPageBusinesses(pagination.pageSize, pagination.currentPage)}
        pageSize={pagination?.pageSize}
        activeId={activeId}
        onOpen={onOpenRow}
      />
      {pagination && !businessList.error && (
        <ReviewsPagination
          page={pagination.currentPage}
          pageSize={pagination.pageSize}
          total={pagination.total}
          busy={businessList.loading}
          onPageChange={(page) => getPageBusinesses(pagination.pageSize, page)}
          onPageSizeChange={(size, page) => getPageBusinesses(size, page)}
        />
      )}
    </>
  )
}

export const BusinessReviewList = (props) => {
  const reviewsProps = {
    ...props,
    noActiveStatusCondition: true,
    asDashboard: true,
    isSearchByBusinessName: true,
    isSearchByBusinessEmail: true,
    isSearchByBusinessPhone: true,
    propsToFetch: ['name', 'logo', 'address', 'reviews', 'slug'],
    UIComponent: BusinessReviewsListingUI
  }
  return <BusinessListController {...reviewsProps} />
}
