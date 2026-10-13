import React from 'react'
import { HelmetTags } from '../../components/HelmetTags'
import { HomePage as HomeController } from '~ui'

export const Home = (props) => {
  const homeProps = {
    ...props,
    disableSupportModule: true
  }
  return (
    <>
      <HelmetTags page='home' />
      <HomeController {...homeProps} />
    </>
  )
}
