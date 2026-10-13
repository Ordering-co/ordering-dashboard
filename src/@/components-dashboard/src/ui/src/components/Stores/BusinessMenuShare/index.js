import React from 'react'
import { BusinessMenuShare as BusinessMenuShareController } from '../../../../../index'
import { SelectBusinesses } from '../../Shared'

const BusinessMenuShareUI = (props) => {
  const {
    actionState,
    selectedBusinessIds,
    businessesState,
    handleSelectBusiness,
    handleSelectAllBusiness,
    handleShareBusinesses,
    searchBusinesses,
    handleChangeBusinessPage,
    handleChangeBusinessPageSize,
    businessesPaginationProps
  } = props

  return (
    <>
      <SelectBusinesses
        isSkeleton={businessesState.loading}
        allBusinesses={businessesState.businesses}
        selectedBusinessIds={selectedBusinessIds}
        handleSelectBusiness={handleSelectBusiness}
        handleSelectAllBusinesses={() => handleSelectAllBusiness(true)}
        handleSelectNoneBusinesses={() => handleSelectAllBusiness(false)}
        isDisabled={actionState.loading || businessesState.loading}
        handleUpdateClick={handleShareBusinesses}
        searchBusinesses={searchBusinesses}
        handleChangeBusinessPage={handleChangeBusinessPage}
        handleChangeBusinessPageSize={handleChangeBusinessPageSize}
        businessesPaginationProps={businessesPaginationProps}
      />
    </>
  )
}

export const BusinessMenuShare = (props) => {
  const businessMenuShareProps = {
    ...props,
    UIComponent: BusinessMenuShareUI
  }
  return (
    <BusinessMenuShareController {...businessMenuShareProps} />
  )
}
