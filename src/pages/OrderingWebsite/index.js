import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWebsite as OrderingWebsiteController } from '~ui'

export const OrderingWebsite = (props) => {
  const orderingWebsiteProps = {
    ...props,
    appId: props?.appId || 'website'
  }
  return (
    <>
      <HelmetTags page={props?.pageName || 'ordering_website'} />
      <OrderingWebsiteController {...orderingWebsiteProps} />
    </>
  )
}
