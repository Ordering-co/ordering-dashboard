import React, { useContext, useEffect } from 'react'
import { QueryLogin as QueryLoginController } from '../../../../../index'
import { ConfigFileContext } from '../../../contexts/ConfigFileContext'
import { SpinnerLoader } from '../../Shared'

const QueryLoginUI = (props) => {
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
    allowedLevels: [0, 2, 5]
  }
  return <QueryLoginController {...queryProps} />
}
