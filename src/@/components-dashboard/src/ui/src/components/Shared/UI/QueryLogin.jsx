import React, { useContext, useEffect } from 'react'
import { QueryLogin as QueryLoginController } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { SpinnerLoader } from '../SpinnerLoader'

export const QueryLoginUI = (props) => {
  const {
    project
  } = props

  const [configFile, setConfigFile] = useContext(ConfigFileContext)

  useEffect(() => {
    setConfigFile({
      ...configFile,
      project
    })
  }, [project])

  return (
    <SpinnerLoader />
  )
}

export const QueryLogin = (props) => {
  const queryProps = {
    ...props,
    UIComponent: QueryLoginUI,
    // Owner decision 29 A (2026-10-21): the same levels as the login form (Login/LoginForm), level 8 included
    allowedLevels: [0, 2, 5, 8]
  }
  return <QueryLoginController {...queryProps} />
}
