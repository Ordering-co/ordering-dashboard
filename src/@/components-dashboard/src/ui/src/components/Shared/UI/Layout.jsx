import React from 'react'

import { LayoutContainer } from './shell-navigation-styles'

export const Layout = (props) => {
  return (
    <LayoutContainer style={{ paddingTop: props.pt ?? 0 }}>
      {props.children}
    </LayoutContainer>
  )
}
