import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { MessagesListing } from '~ui'

export const MessagesList = (props) => {
  const messagesListProps = {
    ...props,
    isUseQuery: true
  }
  return (
    <>
      <HelmetTags page='messages' />
      <MessagesListing {...messagesListProps} />
    </>
  )
}
