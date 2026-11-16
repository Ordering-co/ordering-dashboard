import React, { useId, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'react-bootstrap'
import { useLanguage, useApi, useSite } from '../../../../../index'
import { Button, Dialog } from '../../Shared/Product'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectOptionContent } from '../../Shared/UI/SelectOption'
import { ExternalLink, Link } from '../../Shared/Icon'
import { useProjectState } from '../../../contexts/ProjectContext'
import {
  TRACKING_DOMAIN_DEFAULT_KEY,
  TRACKING_DOMAIN_OTHER_KEY,
  findTrackingDomainOption,
  getDefaultTrackingDomain,
  getOrderTrackingUrl,
  getTrackingDomainOptions,
  getTrackingDomainStorageKey,
  normalizeTrackingDomain,
  readStoredTrackingDomain
} from '../../../utils/getOrderTrackingUrl'
import './tracking-link.css'

const writeStoredDomain = (storageKey, value) => {
  try {
    if (value) {
      window.localStorage.setItem(storageKey, value)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch (e) {}
}

/**
 * The tracking link of an order: what the two actions do and the dialog that edits the domain.
 * `OrderTrackingLink` below draws them as the legacy dropdown items; the order panel header draws them as
 * two direct items of «More actions» (redesign fix-qa E5, as in `main`) with `menuItems` and `dialog`.
 */
export const useOrderTrackingLink = (order) => {
  const [, t] = useLanguage()
  const [ordering, { configurations }] = useApi()
  const [{ sites }] = useSite()
  const [projectStatus] = useProjectState()

  const hasTrackingLink = !!(order?.uuid && order?.hash_key)
  const storageKey = getTrackingDomainStorageKey(ordering?.project)

  const domainOptions = useMemo(
    () => getTrackingDomainOptions({ sites, configurations, ordering, websiteProduct: projectStatus?.websiteProduct }),
    [sites, configurations, ordering?.project, projectStatus?.websiteProduct]
  )
  const defaultDomain = getDefaultTrackingDomain({
    sites,
    configurations,
    ordering,
    websiteProduct: projectStatus?.websiteProduct
  })

  const [savedDomain, setSavedDomain] = useState(() => readStoredTrackingDomain(window.localStorage, ordering?.project))
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState(TRACKING_DOMAIN_DEFAULT_KEY)
  const [customDomain, setCustomDomain] = useState('')
  const [error, setError] = useState(null)
  const fieldId = useId()
  const selectId = useId()
  const selectLabelId = useId()
  const dialogBodyRef = useRef(null)

  const activeDomain = savedDomain || defaultDomain

  // The C18 dropdown (redesign F6c, Q2-14; it was the only native select left in /orders): the site name is the
  // label and its URL the muted second column. «Default» is always there, it is what an empty choice means.
  const row = (value, label, meta) => ({ value, content: <SelectOptionContent label={label} meta={meta} /> })
  const selectOptions = [
    ...(domainOptions.some(option => option.key === TRACKING_DOMAIN_DEFAULT_KEY)
      ? []
      : [row(TRACKING_DOMAIN_DEFAULT_KEY, t('DEFAULT', 'Default'))]),
    ...domainOptions.map(option => row(
      option.key,
      option.site ? (option.site.name || option.site.code || option.site.type) : t('DEFAULT', 'Default'),
      option.url
    )),
    row(TRACKING_DOMAIN_OTHER_KEY, t('OTHER', 'Other'), t('TRACKING_DOMAIN_OTHER_HELP', 'Enter a tracking domain manually'))
  ]

  const openTrackingTab = () => {
    const url = getOrderTrackingUrl({ domain: activeDomain, order })
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleOpenModal = () => {
    const matched = savedDomain ? findTrackingDomainOption(domainOptions, savedDomain) : null
    if (!savedDomain) {
      setSelectedKey(TRACKING_DOMAIN_DEFAULT_KEY)
      setCustomDomain('')
    } else if (matched) {
      setSelectedKey(matched.key)
      setCustomDomain('')
    } else {
      setSelectedKey(TRACKING_DOMAIN_OTHER_KEY)
      setCustomDomain(savedDomain)
    }
    setError(null)
    setModalOpen(true)
  }

  const handleSave = () => {
    if (selectedKey === TRACKING_DOMAIN_DEFAULT_KEY) {
      writeStoredDomain(storageKey, TRACKING_DOMAIN_DEFAULT_KEY)
      setSavedDomain('')
      setModalOpen(false)
      return
    }
    const domain = selectedKey === TRACKING_DOMAIN_OTHER_KEY
      ? normalizeTrackingDomain(customDomain)
      : domainOptions.find(option => option.key === selectedKey)?.url
    if (!domain) {
      setError(t('INVALID_TRACKING_DOMAIN', 'Please enter a valid domain'))
      return
    }
    writeStoredDomain(storageKey, domain)
    setSavedDomain(domain)
    setModalOpen(false)
  }

  const unavailable = t('TRACKING_LINK_UNAVAILABLE', 'This order has no tracking link yet')
  const menuItems = [
    {
      key: 'tracking-open',
      label: t('OPEN_TRACKING_URL', 'Open tracking URL'),
      icon: ExternalLink,
      disabled: !hasTrackingLink || !activeDomain,
      description: !hasTrackingLink
        ? unavailable
        : !activeDomain ? t('TRACKING_DOMAIN_REQUIRED', 'Choose a tracking domain first') : undefined,
      onSelect: openTrackingTab
    },
    {
      key: 'tracking-edit',
      label: `${t('EDIT_TRACKING_URL', 'Edit tracking URL')}…`,
      icon: Link,
      disabled: !hasTrackingLink,
      description: hasTrackingLink ? undefined : unavailable,
      onSelect: handleOpenModal
    }
  ]

  const dialog = (
    <Dialog
      open={modalOpen}
      onOpenChange={(next) => { if (!next) setModalOpen(false) }}
      size='md'
      // The focus starts on the first control: the domain source.
      initialFocus={() => dialogBodyRef.current?.querySelector('.od-first-select-trigger, input') ?? true}
      // The title is the menu item that opened it, without its ellipsis (redesign F6c, Q2-14).
      title={t('EDIT_TRACKING_URL', 'Edit tracking URL')}
      closeLabel={t('CLOSE', 'Close')}
      footer={(
        <>
          <Button onClick={() => setModalOpen(false)}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' onClick={handleSave}>{t('SAVE', 'Save')}</Button>
        </>
      )}
    >
      <div className='odc-tracking' ref={dialogBodyRef}>
        <p className='odc-tracking-help'>{t('TRACKING_DOMAIN_HELP', 'Enter the tracking domain used for customer order links.')}</p>
        <div className='odc-tracking-field'>
          <span className='odc-tracking-label' id={selectLabelId}>{t('TRACKING_DOMAIN_SOURCE', 'Tracking domain source')}</span>
          <FirstSelect
            id={selectId}
            ariaLabelledBy={`${selectLabelId} ${selectId}`}
            fitTrigger
            // The list is an overlay, not part of the dialog body (redesign F6d-2, Q3-11).
            portal
            className='odc-tracking-select'
            defaultValue={selectedKey}
            options={selectOptions}
            onChange={(key) => { setSelectedKey(key); setError(null) }}
          />
        </div>
        {selectedKey === TRACKING_DOMAIN_OTHER_KEY && (
          <div className='odc-tracking-field'>
            <label className='odc-tracking-label' htmlFor={fieldId}>{t('TRACKING_DOMAIN', 'Tracking domain')}</label>
            <input
              id={fieldId}
              name='tracking_domain'
              className='odc-tracking-input'
              value={customDomain}
              placeholder='https://tracking.example.com'
              onChange={(e) => { setCustomDomain(e.target.value); setError(null) }}
              onKeyPress={(e) => e.key === 'Enter' && handleSave()}
              autoComplete='off'
              aria-invalid={!!error}
              aria-describedby={error ? 'tracking-domain-error' : undefined}
            />
          </div>
        )}
        {error && <p id='tracking-domain-error' className='odc-tracking-error' role='alert'>{error}</p>}
      </div>
    </Dialog>
  )

  return { hasTrackingLink, activeDomain, openTrackingTab, handleOpenModal, menuItems, dialog }
}

export const OrderTrackingLink = (props) => {
  const { order } = props
  const [, t] = useLanguage()
  const { hasTrackingLink, activeDomain, openTrackingTab, handleOpenModal, dialog } = useOrderTrackingLink(order)

  return (
    <>
      {!hasTrackingLink && (
        <Dropdown.Item disabled title={t('ORDER_WITHOUT_TRACKING_LINK', 'This order has no tracking link')}>
          {t('OPEN_TRACKING_URL', 'Open tracking URL')}
        </Dropdown.Item>
      )}
      {hasTrackingLink && (
        <>
          <Dropdown.Item onClick={openTrackingTab} disabled={!activeDomain}>
            {t('OPEN_TRACKING_URL', 'Open tracking URL')}
          </Dropdown.Item>
          <Dropdown.Item onClick={handleOpenModal}>
            {t('EDIT_TRACKING_URL', 'Edit tracking URL')}
          </Dropdown.Item>
        </>
      )}
      {dialog}
    </>
  )
}

OrderTrackingLink.propTypes = {
  order: PropTypes.object
}
