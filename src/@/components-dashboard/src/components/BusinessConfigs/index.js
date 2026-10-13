import React from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useApi } from '../../contexts/ApiContext'

export const BusinessConfigs = (props) => {
  const {
    UIComponent,
    business,
    handleSuccessUpdate
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const saveBusinessConfig = async (configId, params) => {
    try {
      const response = await fetch(`${ordering.root}/business/${business?.id}/configs/${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ value: params?.value })
      })
      const content = await response.json()
      if (!content.error) {
        const configs = (business?.configs || []).map(config => (
          config.id === content.result?.id ? content.result : config
        ))
        handleSuccessUpdate && handleSuccessUpdate({ ...business, configs })
      }
      return { error: content.error, result: content.result }
    } catch (err) {
      return { error: true, result: [err.message] }
    }
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          saveBusinessConfig={saveBusinessConfig}
        />
      )}
    </>
  )
}

BusinessConfigs.propTypes = {
  UIComponent: PropTypes.elementType,
  business: PropTypes.object,
  handleSuccessUpdate: PropTypes.func
}
