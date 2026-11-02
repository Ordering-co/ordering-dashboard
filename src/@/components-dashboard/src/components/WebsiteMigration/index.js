import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

/**
 * A legacy website's move to the new website (api-core
 * `sites/{id}/migration`): its `status` (`eligible`, `dns_required`,
 * `migrated`, `not_eligible`) with `migrated_at`, `url`, `product_id`,
 * `domain` and `cname_target`, and the migration itself, in one step.
 * `migration` stays null when the API has none (404) or fails: the legacy
 * editor stays as it is.
 */
export const WebsiteMigration = (props) => {
  const { UIComponent, siteId, onChange, onMigrated } = props

  const [ordering] = useApi()
  const [{ token }] = useSession()
  const [migrationState, setMigrationState] = useState({ loading: !!siteId, migration: null, migrating: false, errorCodes: [] })

  const request = async (method) => {
    const response = await fetch(`${ordering.root}/sites/${siteId}/migration`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    })
    let body = {}
    try {
      body = await response.json()
    } catch (err) {
      body = { error: true }
    }
    return {
      error: !!body?.error || !response.ok,
      result: body?.result,
      errorCodes: Array.isArray(body?.error_codes) ? body.error_codes : []
    }
  }

  const getMigration = async () => {
    setMigrationState(prev => ({ ...prev, loading: true }))
    try {
      const { error, result } = await request('GET')
      setMigrationState(prev => ({ ...prev, loading: false, migration: error ? null : result || null }))
    } catch (err) {
      setMigrationState(prev => ({ ...prev, loading: false, migration: null }))
    }
  }

  /** Migrates the site; true when it went live on the new website. */
  const handleMigrate = async () => {
    setMigrationState(prev => ({ ...prev, migrating: true, errorCodes: [] }))
    try {
      const { error, result, errorCodes } = await request('POST')
      if (error) {
        setMigrationState(prev => ({ ...prev, migrating: false, errorCodes: errorCodes.length ? errorCodes : ['site_migration.failed'] }))
        // Its status changed meanwhile: show the one it has now
        if (errorCodes.some(code => ['site_migration.already_migrated', 'site_migration.dns_required', 'site_migration.not_eligible'].includes(code))) getMigration()
        return false
      }
      setMigrationState(prev => ({ ...prev, migrating: false, migration: result || null }))
      onMigrated && onMigrated(result)
      return true
    } catch (err) {
      setMigrationState(prev => ({ ...prev, migrating: false, errorCodes: ['site_migration.failed'] }))
      return false
    }
  }

  const clearErrors = () => setMigrationState(prev => ({ ...prev, errorCodes: [] }))

  useEffect(() => {
    if (!siteId) return
    getMigration()
  }, [siteId])

  useEffect(() => {
    onChange && onChange({ loading: migrationState.loading, migration: migrationState.migration })
  }, [migrationState.loading, migrationState.migration])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          migrationState={migrationState}
          handleMigrate={handleMigrate}
          clearErrors={clearErrors}
        />
      )}
    </>
  )
}

WebsiteMigration.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType,
  /**
   * The legacy site (`/sites`) to read and migrate
   */
  siteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  /**
   * Called with `{ loading, migration }` whenever they change
   */
  onChange: PropTypes.func,
  /**
   * Called with the result once the site is migrated
   */
  onMigrated: PropTypes.func
}
