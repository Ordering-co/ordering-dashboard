import React from 'react'
import { BusinessDeliveryZoneShare as BusinessDeliveryZoneShareController } from '../../../../../index'
import { SelectBusinesses } from '../../Shared'

export const BusinessDeliveryZoneShareUI = (props) => {
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

export const BusinessDeliveryZoneShare = (props) => {
  const BusinessDeliveryZoneShareProps = {
    ...props,
    UIComponent: BusinessDeliveryZoneShareUI
  }
  return (
    <BusinessDeliveryZoneShareController {...BusinessDeliveryZoneShareProps} />
  )
}
