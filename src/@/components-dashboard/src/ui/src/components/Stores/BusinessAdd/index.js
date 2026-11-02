import React, { useState, useEffect, useCallback } from 'react'
import { BusinessDetails } from './BusinessDetails'
import { useLanguage, useEvent, useConfig, BusinessAdd as BusinessAddController } from '../../../../../index'
import { List as MenuIcon } from 'react-bootstrap-icons'
import { Images } from './Images'
import { Schedule } from './Schedule'
import { Photos } from './Photos'
import { OrderTypePriceLevel } from './OrderTypePriceLevel'
import { PaymentMethods } from './PaymentMethods'
import { ReceiveOrders } from './ReceiveOrders'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { Button, IconButton, Input } from '../../../styles'
import { DeliveryZone } from './DeliveryZone'
import { GoogleBusinessSearch } from '../GoogleBusinessSearch'
import { getUniqueId, stringToSlug } from '../../../utils'
import { useHistory } from 'react-router-dom'
import { Alert, Modal } from '../../Shared'
import {
  AddNewBusinessContainer,
  BoxLayout,
  ButtonWrapper,
  HeaderTitleContainer,
  SlugEditWrapper,
  SlugFormControl
} from './styles'
import { ButtonLink } from '../../../styles/Buttons'

const DEFAULT_SCHEDULE = Array.from({ length: 7 }, () => ({
  enabled: true,
  lapses: [{ open: { hour: 0, minute: 0 }, close: { hour: 23, minute: 59 } }]
}))

const BusinessAddUI = (props) => {
  const {
    formState,
    handleChangeAddress,
    handleChangeInput,
    handleChangeCenter,
    handleChangeSwtich,
    handleChangeGallery,
    changeFormState,
    paymethodsList,
    handleAddBusiness,
    kmlData,
    handleUploadKmlFiles,
    zoneState,
    handleChangeZoneState,
    gallery,
    handleChangePaymethodIds,
    paymethodIds,
    handleChangeSchedule,
    schedule,
    placeId,
    googleBusiness,
    setShowBillingPayment
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ configs }] = useConfig()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [isSlugEdit, setIsSlugEdit] = useState(false)
  const [googleApplied, setGoogleApplied] = useState({})
  const [addressVersion, setAddressVersion] = useState(0)
  const configTypes = configs?.order_types_allowed?.value?.split('|').map(value => Number(value)) || []
  const isDeliveryAllowed = configTypes.includes(1)

  const handleSubmit = () => {
    if (paymethodIds?.length === 0) {
      setAlertState({
        open: true,
        content: t('AT_LEAST_A_PAYMENT_METHOD_REQUIRED', 'At least a payment method is required')
      })
      return
    }
    if (!formState?.changes?.slug) {
      setAlertState({
        open: true,
        content: t(
          'VALIDATION_ERROR_REQUIRED',
          'Slug is required'
        ).replace('_attribute_', t('SLUG', 'Slug'))
      })
      return
    }
    isSlugEdit && setIsSlugEdit(false)
    handleAddBusiness()
  }

  const handleGoToBusinessList = (e) => {
    e.preventDefault()
    events.emit('go_to_page', { page: 'businesses' })
  }

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  useEffect(() => {
    if (!formState?.loading && formState?.result?.error) {
      if (formState?.result?.result?.length === 0 && formState?.result?.result[0].toLowerCase().includes(t('SLUG', 'Slug').toLowerCase())) setIsSlugEdit(true)
      else setAlertState({ open: true, content: formState?.result?.result })
    }
  }, [formState?.result])

  const changeSchedule = useCallback((e) => handleChangeSchedule(e), [])

  const getGoogleFields = (business) => ({
    name: { name: business.name, slug: business.name ? stringToSlug(business.name) : '' },
    phone: { cellphone: business.phone },
    address: {
      address: business.address,
      location: business.location && { ...business.location, zipcode: business.zipcode || -1, zoom: 15 },
      timezone: business.timezone
    },
    schedule: { schedule: business.schedule },
    priceLevel: { price_level: business.priceLevel >= 1 ? `${business.priceLevel}` : null }
  })

  const handleGoogleChange = (changes) => {
    if (changes.schedule) handleChangeSchedule(changes.schedule)
    if (Object.prototype.hasOwnProperty.call(changes, 'address')) setAddressVersion(version => version + 1)
    changeFormState(changes)
  }

  const handleGooglePhotos = (photos) => {
    const galleryPhotos = photos.filter(photo => photo.role === 'gallery').map(photo => ({ file: photo.file, type: 1, temp_id: getUniqueId() }))
    if (galleryPhotos.length) handleChangeGallery([...gallery, ...galleryPhotos])
    const images = Object.fromEntries(photos.filter(photo => photo.role !== 'gallery').map(photo => [photo.role, photo.file]))
    if (Object.keys(images).length) changeFormState(images)
  }

  return (
    <>
      <AddNewBusinessContainer>
        <HeaderTitleContainer>
          {isCollapse && (
            <IconButton
              color='black'
              onClick={() => handleMenuCollapse(false)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <h1>{t('NEW_BUSINESS', 'New business')}</h1>
        </HeaderTitleContainer>
        <BoxLayout>
          <GoogleBusinessSearch
            initialBusiness={googleBusiness}
            initialPlaceId={googleBusiness ? undefined : placeId}
            getFields={getGoogleFields}
            values={{ ...formState?.changes, schedule }}
            defaults={{ schedule: DEFAULT_SCHEDULE }}
            applied={googleApplied}
            onAppliedChange={setGoogleApplied}
            onChange={handleGoogleChange}
            photoRoles={['gallery', 'header', 'logo']}
            onPhotos={handleGooglePhotos}
            disabled={formState?.loading}
          />
        </BoxLayout>
        <BoxLayout>
          <BusinessDetails
            formState={formState}
            handleChangeAddress={handleChangeAddress}
            handleChangeInput={handleChangeInput}
            handleChangeCenter={handleChangeCenter}
            addressKey={addressVersion}
            setShowBillingPayment={setShowBillingPayment}
          />
        </BoxLayout>
        <BoxLayout>
          <Images
            formState={formState}
            handleChangeSwtich={handleChangeSwtich}
          />
        </BoxLayout>
        <BoxLayout>
          <Schedule
            handleChangeSchedule={changeSchedule}
            schedule={formState?.changes?.schedule}
          />
        </BoxLayout>
        <BoxLayout>
          <Photos
            gallery={gallery}
            handleChangeGallery={handleChangeGallery}
          />
        </BoxLayout>
        <BoxLayout>
          <OrderTypePriceLevel
            formState={formState}
            changeFormState={changeFormState}
          />
        </BoxLayout>
        <DeliveryZone
          kmlData={kmlData}
          zoneState={zoneState}
          formState={formState}
          handleChangeZoneState={handleChangeZoneState}
          handleUploadKmlFiles={handleUploadKmlFiles}
          disabled={!isDeliveryAllowed}
        />

        <BoxLayout>
          <PaymentMethods
            handleChangePaymethodIds={handleChangePaymethodIds}
            paymethodIds={paymethodIds}
            paymethodsList={paymethodsList}
          />
        </BoxLayout>
        <BoxLayout>
          <ReceiveOrders
            formState={formState}
            handleChangeInput={handleChangeInput}
            changeFormState={changeFormState}
          />
        </BoxLayout>
        <ButtonWrapper>
          <ButtonLink
            color='primary'
            outline
            onClick={handleGoToBusinessList}
            href='/stores'
          >
            {t('Cancel', 'Cancel')}
          </ButtonLink>
          <Button
            color='primary'
            onClick={handleSubmit}
            disabled={formState?.loading}
          >
            {t('CONFIRM', 'Confirm')}
          </Button>
        </ButtonWrapper>
      </AddNewBusinessContainer>
      <Alert
        title={t('WEB_APPNAME', 'Ordering')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
      {isSlugEdit && (
        <Modal
          width='769px'
          padding='30px'
          title={t('WEB_APPNAME', 'Ordering')}
          open={isSlugEdit}
          onClose={() => setIsSlugEdit(false)}
        >
          <SlugEditWrapper>
            <p>{formState?.result?.result}</p>
            <SlugFormControl>
              <label>{t('SLUG', 'Slug')}</label>
              <Input
                name='slug'
                placeholder={t('SLUG', 'Slug')}
                value={formState?.changes?.slug}
                onChange={handleChangeInput}
              />
            </SlugFormControl>
            <Button color='primary' borderRadius='8px' onClick={handleSubmit}>{t('ACCEPT', 'Accept')}</Button>
          </SlugEditWrapper>
        </Modal>
      )}
    </>
  )
}

export const BusinessAdd = (props) => {
  const history = useHistory()
  const addNewBusinessProps = {
    ...props,
    UIComponent: BusinessAddUI,
    handleOpenCategory: (slug) => history.push(`/stores/products/${slug}`)
  }
  return <BusinessAddController {...addNewBusinessProps} />
}
