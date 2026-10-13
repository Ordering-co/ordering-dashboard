import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { Dropdown } from 'react-bootstrap'
import { useLanguage, useApi, useSite } from '../../../../../index'
import { Button, Input } from '../../../styles'
import { Select } from '../../../styles/Select/FirstSelect'
import { Modal } from '../../Shared'
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
import { TrackingModalContent, SelectWrapper, TrackingOption, ErrorText, ModalActions } from './styles'

const writeStoredDomain = (storageKey, value) => {
  try {
    if (value) {
      window.localStorage.setItem(storageKey, value)
    } else {
      window.localStorage.removeItem(storageKey)
    }
  } catch (e) {}
}

export const OrderTrackingLink = (props) => {
  const { order } = props
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

  const activeDomain = savedDomain || defaultDomain

  const selectOptions = [
    ...domainOptions.map(option => ({
      value: option.key,
      content: (
        <TrackingOption>
          <span>{option.site ? (option.site.name || option.site.code || option.site.type) : t('DEFAULT', 'Default')}</span>
          <small>{option.url}</small>
        </TrackingOption>
      )
    })),
    {
      value: TRACKING_DOMAIN_OTHER_KEY,
      content: (
        <TrackingOption>
          <span>{t('OTHER', 'Other')}</span>
          <small>{t('TRACKING_DOMAIN_OTHER_HELP', 'Enter a tracking domain manually')}</small>
        </TrackingOption>
      )
    }
  ]

  const openTrackingTab = () => {
    const url = getOrderTrackingUrl({ domain: activeDomain, order })
    if (url) window.open(url, '_blank')
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

  return (
    <>
      {!hasTrackingLink && (
        <Dropdown.Item disabled title={t('ORDER_WITHOUT_TRACKING_LINK', 'This order has no tracking link')}>
          {t('OPEN_TRACKING_URL', 'Open tracking url')}
        </Dropdown.Item>
      )}
      {hasTrackingLink && (
        <>
          <Dropdown.Item onClick={openTrackingTab} disabled={!activeDomain}>
            {t('OPEN_TRACKING_URL', 'Open tracking url')}
          </Dropdown.Item>
          <Dropdown.Item onClick={handleOpenModal}>
            {t('EDIT_TRACKING_URL', 'Edit tracking url')}
          </Dropdown.Item>
        </>
      )}
      {modalOpen && (
        <Modal
          width='600px'
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={t('TRACKING_DOMAIN', 'Tracking domain')}
        >
          <TrackingModalContent>
            <p>{t('TRACKING_DOMAIN_HELP', 'Enter the tracking domain used for customer order links.')}</p>
            <SelectWrapper>
              <Select
                defaultValue={selectedKey}
                options={selectOptions}
                optionInnerMaxHeight='200px'
                onChange={(value) => { setSelectedKey(value); setError(null) }}
              />
            </SelectWrapper>
            {selectedKey === TRACKING_DOMAIN_OTHER_KEY && (
              <Input
                name='tracking_domain'
                value={customDomain}
                placeholder='https://tracking.example.com'
                onChange={(e) => { setCustomDomain(e.target.value); setError(null) }}
                onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                autoComplete='off'
              />
            )}
            {error && <ErrorText>{error}</ErrorText>}
            <ModalActions>
              <Button color='primary' onClick={handleSave}>
                {t('SAVE', 'Save')}
              </Button>
            </ModalActions>
          </TrackingModalContent>
        </Modal>
      )}
    </>
  )
}

OrderTrackingLink.propTypes = {
  order: PropTypes.object
}
