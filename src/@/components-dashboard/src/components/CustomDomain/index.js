import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { useSession } from '../../contexts/SessionContext'
import { useToast, ToastType } from '../../contexts/ToastContext'
import { useApi } from '../../contexts/ApiContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useConfig } from '../../contexts/ConfigContext'

export const CustomDomain = (props) => {
  const {
    UIComponent,
    site,
    setSite,
    onClose,
    ensureSite
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [{ configs }] = useConfig()
  const [, { showToast }] = useToast()
  const [, t] = useLanguage()

  const [formState, setFormState] = useState({ loading: false, changes: {}, error: null })

  const handleSaveConfig = async (changes) => {
    const { content: { error, result } } = await ordering.setAccessToken(token).configs(configs?.google_maps_api_key?.id).save(changes)
    if (error) {
      throw Error(result)
    }
  }

  const handleSaveDomain = async (changes, siteId) => {
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(changes)
    }

    const response = await fetch(`${ordering.root}/sites/${siteId}`, requestOptions)
    const { error, result } = await response.json()
    if (error) {
      throw Error(result)
    }
    return result
  }

  /**
 * Method to update the site theme from API
 */
  const handleChangeCustomDomain = async (mapKey) => {
    try {
      showToast(ToastType.Info, t('LOADING', 'Loading'))

      // /my-products/dashboard creates or fixes its site on the first save, so it hands `ensureSite` to get the site
      // to write on; the other pages write on `site` as main. It goes first, so a failure leaves nothing half saved.
      let target = site
      if (ensureSite) {
        try {
          target = await ensureSite()
        } catch (result) {
          showToast(ToastType.Error, result instanceof Error ? result.message : result)
          return
        }
      }
      if (mapKey) {
        const mapApiKeyChanges = {
          key: configs?.google_maps_api_key?.key,
          value: mapKey
        }
        await handleSaveConfig(mapApiKeyChanges)
      }
      const changes = {
        ...formState?.changes,
        ssl_setup_type: 'automatic'
      }
      const result = await handleSaveDomain(changes, target?.id)
      showToast(ToastType.Success, t('DOMAIN_IS_CHANGED', 'The domain is changed'))
      setSite({
        ...target,
        ...result,
        domain: result?.domain ?? formState?.changes?.domain
      })
      onClose && onClose()
    } catch (err) {
      showToast(ToastType.Error, err.message)
    }
  }

  const handleChangeFormState = (changes) => {
    setFormState({
      ...formState,
      changes: {
        ...formState?.changes,
        ...changes
      }
    })
  }

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          formState={formState}
          handleChangeFormState={handleChangeFormState}
          handleChangeCustomDomain={handleChangeCustomDomain}
        />
      )}
    </>
  )
}

CustomDomain.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
