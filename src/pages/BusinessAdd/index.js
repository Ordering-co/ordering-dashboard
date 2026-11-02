import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLocation } from 'react-router-dom'
import { BusinessAdd as BusinessAddController } from '~ui'
export const BusinessAdd = (props) => {
  const { search, state } = useLocation()
  const placeId = new URLSearchParams(search).get('placeId') || undefined

  const businessAddProps = {
    placeId,
    googleBusiness: state?.googleBusiness,
    ...props
  }

  return (
    <>
      <HelmetTags page='business_add' />
      <BusinessAddController {...businessAddProps} />
    </>
  )
}
