import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { OrderingWebsite as OrderingWebsiteController } from '~ui'

export const OrderingWebsite = (props) => {
  const orderingWebsiteProps = {
    ...props,
    appId: props?.appId || 'website',
    // The legacy website's migration to Builder, off until VITE_WEBSITE_MIGRATION is 'true'
    withMigration: import.meta.env.VITE_WEBSITE_MIGRATION === 'true',
    // Websites are made in Builder: these pages only keep the legacy one
    disableSiteCreation: true
  }
  return (
    <>
      <HelmetTags page={props?.pageName || 'ordering_website'} />
      <OrderingWebsiteController {...orderingWebsiteProps} />
    </>
  )
}
