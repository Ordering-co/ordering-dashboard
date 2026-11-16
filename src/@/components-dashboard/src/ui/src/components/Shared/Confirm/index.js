import React from 'react'
import { useTheme } from 'styled-components'
import { LegacyConfirm } from '../UI/Confirm'

export const Confirm = (props) => {
  const theme = useTheme()
  return theme ? <LegacyConfirm {...props} /> : null
}

export const Alert = Confirm
