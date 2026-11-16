import React from 'react'
import { Loading } from './simple-spinner-styles'

export const SimpleSpinner = (props) => {
  return (
    <Loading {...props} id='loading' />
  )
}
