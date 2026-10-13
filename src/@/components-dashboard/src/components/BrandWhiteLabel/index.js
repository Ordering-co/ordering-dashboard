import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

/**
 * Controller for BrandWhiteLabel.
 *
 * Backend endpoint `GET /franchises/{id}/sites/current` is idempotent: returns
 * the current site + theme for the brand, creating it if necessary. The
 * frontend only calls it after the user confirms (when brand has no
 * `site_id`), to avoid creating a site without explicit permission.
 */
export const BrandWhiteLabel = (props) => {
  const {
    UIComponent,
    brand,
    handleUpdateBrand
  } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [siteCurrentState, setSiteCurrentState] = useState({
    loading: !!brand?.site_id,
    site: null,
    theme: null,
    error: null
  })
  const [confirmCreate, setConfirmCreate] = useState(!!brand?.id && !brand?.site_id)

  const baseHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }

  const loadCurrentSite = async () => {
    if (!brand?.id) return
    try {
      setSiteCurrentState((prev) => ({ ...prev, loading: true, error: null }))
      const response = await fetch(`${ordering.root}/franchises/${brand.id}/sites/current`, {
        method: 'GET',
        headers: baseHeaders
      })
      const { error, result } = await response.json()
      if (error) {
        setSiteCurrentState({ loading: false, site: null, theme: null, error: result })
        return
      }
      const site = result?.site || result
      const theme = result?.theme || (Array.isArray(result?.themes) ? result.themes[0] : null)
      setSiteCurrentState({ loading: false, site, theme, error: null })
      if (!brand?.site_id && site?.id && handleUpdateBrand) {
        handleUpdateBrand({ ...brand, site_id: site.id })
      }
    } catch (err) {
      setSiteCurrentState({ loading: false, site: null, theme: null, error: [err.message] })
    }
  }

  const handleConfirmCreate = async () => {
    setConfirmCreate(false)
    await loadCurrentSite()
  }

  useEffect(() => {
    if (!brand?.id) return
    if (brand?.site_id) {
      setConfirmCreate(false)
      loadCurrentSite()
    } else {
      setConfirmCreate(true)
      setSiteCurrentState({ loading: false, site: null, theme: null, error: null })
    }
  }, [brand?.id, brand?.site_id])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          siteCurrentState={siteCurrentState}
          confirmCreate={confirmCreate}
          handleConfirmCreate={handleConfirmCreate}
          handleRetry={loadCurrentSite}
        />
      )}
    </>
  )
}

BrandWhiteLabel.propTypes = {
  UIComponent: PropTypes.elementType,
  brand: PropTypes.object,
  handleUpdateBrand: PropTypes.func
}
