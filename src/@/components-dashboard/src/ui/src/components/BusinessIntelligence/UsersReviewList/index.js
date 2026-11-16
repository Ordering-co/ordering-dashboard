import React, { useEffect, useState } from 'react'
import {
  useLanguage,
  UsersList as UsersController
} from '../../../../../index'
import { addQueryToUrl } from '../../../utils'
import { ReviewsPagination, ReviewsTable } from '../ReviewsDirectory/ReviewsTable'

// redesign reviews FD1 (D3, RV-03, RV-05, RV-08, RV-12): the drivers, customers and professionals list is a Product table with a
// Product foot. It no longer mounts the panel: the page opens it in its SplitView, so this list tells which row was chosen
// (`onOpenRow`) and draws which one is open (`activeId`). The controller of main is the same, with the same props.
export const UsersReviewListUI = (props) => {
  const {
    parentSearchValue,
    usersList,
    paginationProps,
    getUsers,
    searchValue,
    onSearch,
    defaultUserTypesSelected,
    isUseQuery,
    activeId,
    onOpenRow,
    onRetry
  } = props

  const [, t] = useLanguage()
  const types = defaultUserTypesSelected ?? []
  const isCustomers = types.length === 1 && types[0] === 3
  const isProfessionals = types[0] === 8
  const nameHeader = isCustomers ? t('CUSTOMER', 'Customer') : isProfessionals ? t('PROFESSIONAL', 'Professional') : t('DRIVER', 'Driver')
  const label = isCustomers ? t('CUSTOMERS', 'Customers') : isProfessionals ? t('PROFESSIONALS', 'Professionals') : t('DRIVERS', 'Drivers')
  const total = paginationProps?.totalItems ?? null

  useEffect(() => {
    if (parentSearchValue === null) return
    // redesign the wrapper seeds the controller with the search of the page, so on mount it already has it; handing it over again
    // (null → '' counts too: both ask for the same thing) made the controller ask for the users a second time
    if ((parentSearchValue || null) === (searchValue || null)) return
    onSearch(parentSearchValue)
  }, [parentSearchValue])

  useEffect(() => {
    if (!isUseQuery || !paginationProps?.currentPage || !paginationProps?.pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({
      page: paginationProps.currentPage,
      pageSize: paginationProps.pageSize
    })
  }, [paginationProps?.currentPage, paginationProps?.pageSize, paginationProps?.totalPages])

  return (
    <>
      <ReviewsTable
        kind='user'
        label={label}
        nameHeader={nameHeader}
        rows={usersList.users ?? []}
        loading={usersList.loading}
        error={usersList.error}
        // redesign reviews R1 (Q1-2): the wrapper mounts the controller again; without it (the UI on its own) the page is asked again
        onRetry={() => onRetry
          ? onRetry(paginationProps?.currentPage, paginationProps?.pageSize)
          : getUsers(paginationProps.currentPage, paginationProps.pageSize)}
        pageSize={paginationProps?.pageSize}
        activeId={activeId}
        onOpen={onOpenRow}
      />
      {!usersList.error && (
        <ReviewsPagination
          page={paginationProps?.currentPage}
          pageSize={paginationProps?.pageSize}
          total={total}
          busy={usersList.loading}
          onPageChange={(page) => getUsers(page, paginationProps.pageSize)}
          onPageSizeChange={(size, page) => getUsers(page, size)}
        />
      )}
    </>
  )
}

export const UsersReviewList = (props) => {
  // redesign reviews R1 (Q1-2): the controller of main (UsersList, shared, not touched) keeps the `error` of an earlier answer when the
  // next one is good, so asking it for the page again never recovers. «Try again» mounts it again with a new key, on the page and the
  // size the list had (it reads them from `paginationSettings` when it mounts, and only with `controlType: 'pages'`).
  const [retry, setRetry] = useState({ attempt: 0, page: 1, pageSize: null })
  const paginationSettings = retry.attempt === 0
    ? props.paginationSettings
    : {
        ...props.paginationSettings,
        initialPage: retry.page,
        pageSize: retry.pageSize ?? props.paginationSettings?.pageSize,
        controlType: 'pages'
      }
  const driversReviewListProps = {
    ...props,
    paginationSettings,
    // redesign a tab opened with a search typed mounts this controller, which asked first without the filter and then, when the
    // list handed the search over, again with it. The seed makes its first request the right one (the controller reads it as its first value).
    searchSeed: props.searchSeed ?? { value: props.parentSearchValue },
    isSearchByUserEmail: true,
    isSearchByUserName: true,
    // redesign (row 8, reviews P1): the reviews of disabled drivers, customers and professionals are listed too (UsersList is
    // shared with the Users pages, which keep their `enabled` condition: only this list opts out), and their row says «Inactive»
    disabledActiveStateCondition: true,
    UIComponent: UsersReviewListUI,
    propsToFetch: ['name', 'middle_name', 'second_lastname', 'lastname', 'email', 'photo', 'qualification', 'reviews', 'enabled'],
    onRetry: (page, pageSize) => setRetry(current => ({ attempt: current.attempt + 1, page: page || 1, pageSize: pageSize || null }))
  }
  return <UsersController key={retry.attempt} {...driversReviewListProps} />
}
