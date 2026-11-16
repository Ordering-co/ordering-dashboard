import React, { useEffect, useId, useRef, useState } from 'react'
import { useLanguage, useUtils, useConfig, useSession, GoogleAutocompleteInput, GoogleMapsMap } from '../../../../../index'
import { getUserType } from '../../../utils'
import { canAssignDriverManually } from '../../../../../utils/dashboardFeatureAccess'
import { DriverSelector } from '../DriverSelector'
import { CompanySelector } from '../CompanySelector'
import { Input } from '../../../styles'
import { ReviewCustomer } from '../ReviewCustomer'
import { Avatar } from '../../Shared/Product/Avatar'
import { Button as ProductButton, IconButton as ProductIconButton } from '../../Shared/Product/Button'
import { ExternalLink, MapPin, MessageSquare, Phone } from '../../Shared/Icon'
import '../OrderDetails/details-tab.css'

const getTranslationKeyFromLabelName = (value) => {
  if (typeof value !== 'string') return undefined
  return value.toUpperCase().replace(/ /g, '_')
}

// A name on one line: the API may send «Marco » (a trailing space) or an empty middle name (redesign F6e-2, Q4-02)
const joinName = (...parts) => parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

const mapsLink = (query) => `http://maps.google.com/?q=${query}`

// The Google script is loaded by the address field (and by the map); until it is there the map has nothing to draw
const isGoogleMapsLoaded = () => typeof window !== 'undefined' && !!window.google?.maps?.Map

// redesign F3: how long the address field waits for Google before it says the search is unavailable
const GOOGLE_WAIT_MS = 5000

const openInNewTab = (url) => window.open(url, '_blank', 'noopener,noreferrer')

/**
 * Customer, business and driver of an order, as two sections of the detail panel (batch 5.3):
 * no accordions, the address is always in view. Edit customer, Review, the driver and company
 * selectors and their conditions are the ones this component always had; only their place changed.
 * The driver and company selectors have no condition on the status (as in main): a closed order can
 * be reassigned. A pickup keeps its address, coordinates, notes, zipcode and the customer preference.
 */
export const OrderContactInformation = (props) => {
  const {
    order,
    customerInfoState,
    handleChangeCustomerInfoState,
    isTourOpen,
    setCurrentTourStep,
    handleOpenMessages,
    isServiceOrder,
    handleUpdateCustomerInfo,
    setAddressState,
    setCommentInfostate,
    commentInfoState,
    addressState,
    disableSocketRoomDriver,
    onSelectTab
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const [{ configs }] = useConfig()
  const [{ user }] = useSession()
  const googleInputRef = useRef(null)
  const customerHeadingId = useId()
  const businessHeadingId = useId()
  const addressFieldId = useId()
  const cellphoneFieldId = useId()
  const emailFieldId = useId()
  const notesFieldId = useId()
  const addressHintId = useId()

  const googleMapsApiKey = configs?.google_maps_api_key?.value
  const isDisableDriverCompanies = configs?.disable_companies_order_details?.value === '1'
  const readOnlyBusinessOwner = !getUserType('viewOnlyBusinessOwner') && getUserType('readOnlyBusinessOwner')
  const canAssignDriver = !readOnlyBusinessOwner && canAssignDriverManually({ level: user?.level, configs })

  const googleMapsControls = {
    defaultZoom: 15,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    mapTypeId: 'roadmap', // 'roadmap', 'satellite', 'hybrid', 'terrain'
    mapTypeControl: false,
    mapTypeControlOptions: {
      mapTypeIds: ['roadmap', 'satellite']
    },
    isMarkerDraggable: true
  }

  const defaultPosition = { lat: 40.77473399999999, lng: -73.9653844 }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState(null)
  // Each opening of the review starts a fresh form: the dialog stays mounted while it fades out.
  const [reviewSession, setReviewSession] = useState(0)
  const [isEdit, setIsEdit] = useState(false)
  // redesign fix-qa E6: the map block is drawn only once Google Maps has loaded, so an unreachable or
  // keyless Google leaves no blank block between the address and the notes
  const [mapsReady, setMapsReady] = useState(isGoogleMapsLoaded)
  // redesign F3: a Google that has not answered after a few seconds is taken as blocked or offline (no hint before: it is
  // still loading); without a key there is nothing to wait for
  const [googleTimedOut, setGoogleTimedOut] = useState(false)

  const pastOrderStatuses = [1, 2, 5, 6, 10, 11, 12, 15, 16, 17]
  const deliveryTypes = [1, 7]
  const customer = order?.customer
  const business = order?.business
  const showDriver = deliveryTypes.includes(order?.delivery_type) && !isServiceOrder

  useEffect(() => {
    if (!isEdit || !googleMapsApiKey || mapsReady) return
    const timer = setInterval(() => {
      if (!isGoogleMapsLoaded()) return
      setMapsReady(true)
      clearInterval(timer)
    }, 200)
    return () => clearInterval(timer)
  }, [isEdit, googleMapsApiKey, mapsReady])

  useEffect(() => {
    if (!isEdit || !googleMapsApiKey || mapsReady) {
      setGoogleTimedOut(false)
      return
    }
    const timer = setTimeout(() => setGoogleTimedOut(true), GOOGLE_WAIT_MS)
    return () => clearTimeout(timer)
  }, [isEdit, googleMapsApiKey, mapsReady])

  const handleReviewCustomer = (customer) => {
    setCurrentCustomer(customer)
    setReviewSession(session => session + 1)
    setIsModalOpen(true)
  }

  const handleCustomerReviewed = () => {
    setIsModalOpen(false)
  }

  const handleChangeAddress = (e) => {
    setAddressState({
      address: googleInputRef?.current?.value || e?.address,
      location: e?.location,
      zipcode: e?.zipcode
    })
  }

  const handleUpdateCustomer = async () => {
    await handleUpdateCustomerInfo()
    setIsEdit(false)
  }

  // redesign fix-qa E6: leaving the form without saving drops what was typed. The controller keeps
  // the edits in its state, so each edited field goes back to the value the order has, and the
  // address picked on the map is forgotten.
  const handleCancelEdit = () => {
    const edited = Object.keys(customerInfoState?.customer ?? {})
    if (edited.length > 0) {
      handleChangeCustomerInfoState(Object.fromEntries(edited.map(key => [key, customer?.[key]])))
    }
    setAddressState({})
    setIsEdit(false)
  }

  // redesign fix-qa E9: the Chat tab opens from here; the focus goes with it, to the composer of the chat (to the chat
  // itself when the order has ended and has none). The chat stays mounted but hidden, so it is looked up once the tab shows.
  const handleMessageCustomer = (event) => {
    const panel = event.currentTarget.closest('#orderDetails') ?? document
    onSelectTab('chat')
    window.requestAnimationFrame(() => {
      const chat = panel.querySelector('.odc-od-chat-pane')
      const target = chat?.querySelector('[data-chat-composer]') ?? chat?.querySelector('[data-chat-root]')
      target?.focus()
    })
  }

  const handleToggleEdit = () => {
    if (isEdit) handleCancelEdit()
    else setIsEdit(true)
  }

  const handleChangeCenter = (position) => {
    const newLat = position.lat()
    const newLng = position.lng()
    setAddressState((prev) => ({
      ...prev,
      location: { lat: newLat, lng: newLng }
    }))
  }

  // redesign F6h-3 (A2-04): what the API sends (names, addresses, notes) is wrapped in <bdi> where it is shown, so a Latin
  // address or name keeps its own order inside a right-to-left line.
  const customerFullName = joinName(customer?.name, customer?.middle_name, customer?.lastname, customer?.second_lastname)
  const customerPhone = customer?.cellphone
    ? `${customer?.country_phone_code ? '+' + customer?.country_phone_code : ''}${customer?.cellphone}`
    : null
  // Who the order is for: the person it was placed on behalf of, the customer, or a guest.
  const displayName = order?.on_behalf_of ||
    customerFullName ||
    ((!customer?.email || !customer?.phone) ? t('GUEST_USER', 'Guest user') : '')

  const hasAddress = !!customer?.address
  const hasLocation = !!customer?.location
  const showAddress = hasAddress || hasLocation
  const mapsUrl = hasAddress
    ? mapsLink(customer?.address)
    : hasLocation ? mapsLink(`${customer?.location?.lat},${customer?.location?.lng}`) : null
  const deliveryPreference = order?.delivery_option
    ? t(getTranslationKeyFromLabelName(order?.delivery_option?.name), order?.delivery_option?.name)
    : t('EITHER_WAY', 'Either way')
  // Only the table (type 9) has no delivery preference, as in main (OrderBill: delivery_type !== 9).
  const showPreference = parseInt(order?.delivery_type, 10) !== 9
  const hasAddressExtras = !!customer?.address_notes || !!customer?.zipcode
  // redesign F3: the address input is a Google Places Autocomplete, disabled until Google is there
  const addressSearchUnavailable = !googleMapsApiKey || (!mapsReady && googleTimedOut)
  const canMessage = !!onSelectTab && user?.level !== 5

  const driverName = order?.driver_id
    ? joinName(order?.driver?.name, order?.driver?.middle_name, order?.driver?.lastname, order?.driver?.second_lastname)
    : order?.external_driver_id ? order?.external_driver?.name : null
  const driverPhone = order?.driver_id ? order?.driver?.cellphone : order?.external_driver?.phone
  const driverPhoto = order?.driver?.photo || order?.external_driver?.photo
  // redesign F6c (Q2-25): the selector already shows the assigned driver, so the card with the same person goes away and
  // the phone (which main showed on the card) moves to the selector's label. External drivers are not in the selector.
  // redesign F6d (P4-02): only when the selector is on the page (not while the assignment comment is open) AND it really shows
  // that driver. The selector draws the person from the order's candidates (`/controls/orders/:id`), so a driver that is not
  // among them, a failed request or a list still loading leave its field empty or on «loading…»: then the card (main's, with
  // the full name) stays.
  // redesign F6e-2 (Q4-02): the selector says which driver id its field shows (`onSelectedShown`); the card goes by that id.
  // No reading of the selector's text, no observer: a name padded with spaces cannot make the two disagree, and the card is
  // only hidden in the commit where the selector draws the driver.
  const driverSelectorShown = !order?.driver_company_id && canAssignDriver
  const driverSelectorMounted = driverSelectorShown && !commentInfoState?.open
  const [selectorShownId, setSelectorShownId] = useState(null)
  const watchSelector = driverSelectorMounted && !!order?.driver_id && showDriver
  const driverShownBySelector = watchSelector && selectorShownId !== null && String(selectorShownId) === String(order?.driver_id)

  return (
    <>
      <section className='odt-sec' aria-labelledby={customerHeadingId}>
        <div className='odt-sec-head'>
          <h3 id={customerHeadingId}>{t('CUSTOMER', 'Customer')}</h3>
          <div className='odt-sec-actions'>
            {!order?.user_review && pastOrderStatuses.includes(order?.status) && (
              <ProductButton size='sm' onClick={() => handleReviewCustomer(customer)}>
                {t('REVIEW', 'Review')}
              </ProductButton>
            )}
            {!readOnlyBusinessOwner && (
              <ProductButton
                size='sm'
                aria-label={`${t('EDIT', 'Edit')} ${t('CUSTOMER', 'Customer')}`}
                aria-pressed={isEdit}
                onClick={handleToggleEdit}
              >
                {t('EDIT', 'Edit')}
              </ProductButton>
            )}
          </div>
        </div>
        <div className='odt-party'>
          <Avatar
            size='lg'
            name={displayName}
            src={customer?.photo && !order?.on_behalf_of ? optimizeImage(customer?.photo, 'h_50,c_limit') : undefined}
          />
          <span className='odt-party-name'>
            {!!order?.on_behalf_of && <span className='odt-party-tag'>{t('ON_BEHALF_OF', 'On behalf of')}</span>}
            <bdi>{displayName}</bdi>
          </span>
          <span className='odt-party-acts'>
            {!order?.on_behalf_of && customerPhone && (
              <ProductIconButton
                icon={Phone}
                size='sm'
                label={`${t('CALL', 'Call')} ${customer?.name ?? t('CUSTOMER', 'Customer')}`}
                onClick={() => window.open(`tel:${customerPhone}`)}
              />
            )}
            {canMessage && (
              <ProductIconButton
                icon={MessageSquare}
                size='sm'
                label={`${t('MESSAGE', 'Message')} ${customer?.name ?? t('CUSTOMER', 'Customer')}`}
                onClick={handleMessageCustomer}
              />
            )}
          </span>
          {!isEdit && (
            <span className='odt-party-lines'>
              {order?.on_behalf_of && customerFullName && <span><bdi>{customerFullName}</bdi></span>}
              {customerPhone && (
                <span>
                  <bdi dir='ltr' className='odc-num'>
                    <a href={`tel:${customerPhone}`}>{customerPhone}</a>
                  </bdi>
                </span>
              )}
              {customer?.email && (
                <span><bdi><a href={`mailto:${customer?.email}`}>{customer?.email}</a></bdi></span>
              )}
              {!!customer?.internal_number && (
                <span>{`${t('INTERNAL_NUMBER', 'Internal number')}: ${customer?.internal_number}`}</span>
              )}
            </span>
          )}
        </div>
        {isEdit
          ? (
            <div className='odt-edit' role='group' aria-label={`${t('EDIT', 'Edit')} ${t('CUSTOMER', 'Customer')}`}>
              {/* redesign F6d (Q2-21): the four fields are the same shape: a div with a <label class=odt-field-label> tied to
                  its control, so none of them measures (or reads) differently from the others */}
              <div className='odt-field'>
                <label className='odt-field-label' htmlFor={cellphoneFieldId}>{t('CELLPHONE', 'Phone / Mobile')}</label>
                <Input
                  id={cellphoneFieldId}
                  type='tel'
                  inputMode='numeric'
                  value={customerInfoState?.customer?.cellphone ?? customer?.cellphone ?? ''}
                  onChange={(e) => {
                    handleChangeCustomerInfoState({ cellphone: e.target.value })
                  }}
                  onKeyPress={(e) => {
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault()
                    }
                  }}
                />
              </div>
              <div className='odt-field'>
                <label className='odt-field-label' htmlFor={emailFieldId}>{t('EMAIL', 'Email')}</label>
                <Input
                  id={emailFieldId}
                  type='email'
                  value={customerInfoState?.customer?.email ?? customer?.email ?? ''}
                  onChange={(e) => {
                    handleChangeCustomerInfoState({ email: e.target.value })
                  }}
                />
              </div>
              {/* redesign F3: label, field and hint are siblings (the hint is not part of the field's name); the field is
                  disabled by GoogleAutocompleteInput while Google is not there, and its box comes from details-tab.css */}
              <div className='odt-field'>
                <label className='odt-field-label' htmlFor={addressFieldId}>{t('ADDRESS', 'Address')}</label>
                <GoogleAutocompleteInput
                  id={addressFieldId}
                  name='address'
                  className='input-autocomplete od-ui od-field od-field-input'
                  apiKey={googleMapsApiKey}
                  placeholder={t('ADDRESS', 'Address')}
                  aria-describedby={addressSearchUnavailable ? addressHintId : undefined}
                  onChangeAddress={(e) => {
                    handleChangeAddress(e)
                  }}
                  defaultValue={customer?.address ?? ''}
                  childRef={(ref) => {
                    googleInputRef.current = ref
                  }}
                  autoComplete='new-password'
                  countryCode={configs?.country_autocomplete?.value || '*'}
                />
                {addressSearchUnavailable && (
                  <span id={addressHintId} className='odt-field-hint'>
                    {t('ADDRESS_SEARCH_UNAVAILABLE', 'Address search unavailable')}
                  </span>
                )}
              </div>
              {googleMapsApiKey && mapsReady && (
                <div className='odt-edit-map'>
                  <GoogleMapsMap
                    apiKey={googleMapsApiKey}
                    fillContainer
                    location={addressState?.location ?? customer?.location ?? defaultPosition}
                    mapControls={googleMapsControls}
                    handleChangeCenter={handleChangeCenter}
                    onlyMarkerChangeCenter
                  />
                </div>
              )}
              <div className='odt-field'>
                <label className='odt-field-label' htmlFor={notesFieldId}>{t('NOTES', 'Notes')}</label>
                <Input
                  id={notesFieldId}
                  defaultValue={customerInfoState?.customer?.address_notes ?? customer?.address_notes ?? ''}
                  onChange={(e) => {
                    handleChangeCustomerInfoState({ address_notes: e.target.value })
                  }}
                />
              </div>
              <div className='odt-edit-actions'>
                <ProductButton onClick={handleCancelEdit}>{t('CANCEL', 'Cancel')}</ProductButton>
                <ProductButton variant='primary' busy={!!customerInfoState?.loading} onClick={handleUpdateCustomer}>
                  {customerInfoState?.loading ? t('LOADING', 'Loading') : t('SAVE', 'Save')}
                </ProductButton>
              </div>
            </div>
            )
          : (
              (showAddress || showPreference || hasAddressExtras) && (
                <div className='odt-addr'>
                  {showAddress && <MapPin className='odc-icon' />}
                  <div className='odt-addr-body'>
                    {hasAddress && <b><bdi>{customer?.address}</bdi></b>}
                    {hasLocation && (
                      <span>
                        <a
                          href={mapsLink(`${customer?.location?.lat},${customer?.location?.lng}`)}
                          rel='noopener noreferrer'
                          target='_blank'
                        >
                          <bdi dir='ltr' className='odc-num'>{customer?.location?.lat}, {customer?.location?.lng}</bdi>
                        </a>
                      </span>
                    )}
                    {!!customer?.address_notes && <span><bdi>{customer?.address_notes}</bdi></span>}
                    {!!customer?.zipcode && <span>{`${t('ZIPCODE', 'Zipcode')}: ${customer?.zipcode}`}</span>}
                    {showPreference && (
                      <span>{`${t('DELIVERY_PREFERENCE', 'Delivery preference')}: ${deliveryPreference}`}</span>
                    )}
                  </div>
                  {showAddress && mapsUrl && (
                    <ProductIconButton
                      icon={ExternalLink}
                      size='sm'
                      flipInRtl
                      label={t('OPEN_ADDRESS_IN_MAPS', 'Open address in maps')}
                      onClick={() => openInNewTab(mapsUrl)}
                    />
                  )}
                </div>
              )
            )}
      </section>

      <section className='odt-sec' aria-labelledby={businessHeadingId} data-tour='tour_driver'>
        <h3 id={businessHeadingId}>
          {showDriver ? t('BUSINESS_AND_DRIVER', 'Business and driver') : t('BUSINESS', 'Business')}
        </h3>
        <div className='odt-party'>
          <Avatar
            kind='business'
            size='lg'
            name={business?.name}
            src={business?.logo ? optimizeImage(business?.logo, 'h_50,c_limit') : undefined}
          />
          <span className='odt-party-name'><bdi>{business?.name}</bdi></span>
          <span className='odt-party-acts'>
            {business?.phone && (
              <ProductIconButton
                icon={Phone}
                size='sm'
                label={`${t('CALL', 'Call')} ${business?.name ?? t('BUSINESS', 'Business')}`}
                onClick={() => window.open(`tel:${business.phone}`)}
              />
            )}
          </span>
          <span className='odt-party-lines'>
            {business?.address && (
              <span>
                <a href={mapsLink(business?.address)} rel='noopener noreferrer' target='_blank'><bdi>{business?.address}</bdi></a>
              </span>
            )}
            {business?.address_notes && <span><bdi>{business?.address_notes}</bdi></span>}
            {business?.zipcode && <span>{`${t('ZIPCODE', 'Zipcode')}: ${business?.zipcode}`}</span>}
            {business?.phone && <span><bdi dir='ltr' className='odc-num'>{business?.phone}</bdi></span>}
            {business?.email && (
              <span><bdi><a href={`mailto:${business?.email}`}>{business?.email}</a></bdi></span>
            )}
          </span>
        </div>
        {showDriver && (
          <>
            {!driverShownBySelector && (
              <div className='odt-party'>
                <Avatar
                  size='lg'
                  name={driverName ?? undefined}
                  src={driverPhoto ? optimizeImage(driverPhoto, 'h_50,c_limit') : undefined}
                />
                {driverName
                  ? <span className='odt-party-name'><bdi>{driverName}</bdi></span>
                  : <span className='odt-party-name' data-muted=''>{t('NO_DRIVER', 'No driver')}</span>}
                <span className='odt-party-acts'>
                  {driverName && driverPhone && (
                    <ProductIconButton
                      icon={Phone}
                      size='sm'
                      label={`${t('CALL', 'Call')} ${joinName(order?.driver_id ? order?.driver?.name : order?.external_driver?.name) || t('DRIVER', 'Driver')}`}
                      onClick={() => window.open(`tel:${driverPhone}`)}
                    />
                  )}
                </span>
                {driverName && (
                  <span className='odt-party-lines'><span>{t('DRIVER', 'Driver')}</span></span>
                )}
              </div>
            )}
            {!order?.driver_id && !isDisableDriverCompanies && canAssignDriver && (
              <div className='odt-assign'>
                <CompanySelector
                  small
                  isPhoneView
                  defaultValue={order?.driver_company_id ?? 'default'}
                  order={order}
                  isTourOpen={isTourOpen}
                  setCurrentTourStep={setCurrentTourStep}
                  handleOpenMessages={handleOpenMessages}
                  isOrderDrivers
                  orderId={order?.id}
                  disableSocketRoomDriver
                />
              </div>
            )}
            {driverSelectorMounted && (
              <div className='odt-assign'>
                <span className='odt-assign-head'>
                  <span className='odt-assign-label'>{t('DRIVER', 'Driver')}</span>
                  {driverShownBySelector && driverPhone && (
                    <ProductIconButton
                      icon={Phone}
                      size='sm'
                      label={`${t('CALL', 'Call')} ${joinName(order?.driver?.name) || t('DRIVER', 'Driver')}`}
                      onClick={() => window.open(`tel:${driverPhone}`)}
                    />
                  )}
                </span>
                <DriverSelector
                  small
                  isPhoneView
                  defaultValue={commentInfoState?.driverId ?? order?.driver_id ?? 'default'}
                  order={order}
                  isTourOpen={isTourOpen}
                  setCurrentTourStep={setCurrentTourStep}
                  handleOpenMessages={handleOpenMessages}
                  isOrderDrivers
                  orderId={order?.id}
                  setCommentInfostate={setCommentInfostate}
                  disableSocketRoomDriver={disableSocketRoomDriver}
                  onSelectedShown={setSelectorShownId}
                />
              </div>
            )}
          </>
        )}
      </section>

      {currentCustomer && (
        <ReviewCustomer
          key={reviewSession}
          open={isModalOpen}
          order={order}
          customer={currentCustomer}
          onClose={() => handleCustomerReviewed()}
        />
      )}
    </>
  )
}
