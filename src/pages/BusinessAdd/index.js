import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { useLocation } from 'react-router-dom'
import { BusinessAdd as BusinessAddController } from '~ui'
export const BusinessAdd = (props) => {
  const { search } = useLocation()
  const placeId = search?.split('=')[1]

  const businessAddProps = {
    placeId,
    ...props
  }

  return (
    <>
      <HelmetTags page='business_add' />
      <BusinessAddController {...businessAddProps} />
    </>
  )
}
