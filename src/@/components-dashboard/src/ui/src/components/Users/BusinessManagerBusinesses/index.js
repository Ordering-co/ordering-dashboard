import React from 'react'
import { BusinessManagerBusinesses as BusinessManagerBusinessesController } from '../../../../../index'
import { SelectBusinesses } from '../../Shared'

const BusinessManagerBusinessesUI = (props) => {
  const {
    actionState,
    selectedBusinessIds,
    businessesState,
    handleSelectBusiness,
    handleSelectAllBusiness,
    handleUpdateBusinesses,
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
        handleUpdateClick={handleUpdateBusinesses}
        searchBusinesses={searchBusinesses}
        handleChangeBusinessPage={handleChangeBusinessPage}
        handleChangeBusinessPageSize={handleChangeBusinessPageSize}
        businessesPaginationProps={businessesPaginationProps}
      />
    </>
  )
}

export const BusinessManagerBusinesses = (props) => {
  const businessMenuShareProps = {
    ...props,
    UIComponent: BusinessManagerBusinessesUI
  }
  return (
    <BusinessManagerBusinessesController {...businessMenuShareProps} />
  )
}
