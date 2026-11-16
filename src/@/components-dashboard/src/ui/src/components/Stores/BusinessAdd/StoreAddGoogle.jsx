import React, { useEffect, useId, useRef } from 'react'
import { GoogleAutocompleteInput, GoogleBusinessSearch as GoogleBusinessSearchController, useConfig, useLanguage } from '../../../../../index'
import { Button, Checkbox, Field, InlineNotice, Select } from '../../Shared/Product'
import './store-add-google.css'

// (main ): main's Google business search on the redesigned add. It replaces the lookup that read a place through
// a hidden map (D2): a business or an address is searched, the business is confirmed before anything is filled, a field
// the user already changed is offered as a suggestion instead of overwritten, and photos are copied only once chosen and with the
// rights confirmed. The behavior is main's controller (components/GoogleBusinessSearch); this is its Product face, in the same place
// and look as the lookup it replaces. Main shows it on the add for every project, without the countries gate of the old modal.

const SEARCH_STATUSES = ['idle', 'loading', 'nearby', 'error']

// main (ba9758f9d): production answers with Referrer-Policy: same-origin, so the photo requests to places.googleapis.com
// carried no Referer and keys restricted to websites rejected them. Only the Google photo thumbnails send the site origin.
const GOOGLE_PHOTO_REFERRER_POLICY = 'strict-origin-when-cross-origin'

const PhotoCredits = ({ attributions = [] }) => (
  <span className='odc-sadd-google-credit'>
    {attributions.map((author, index) => (
      <React.Fragment key={`${author.name}-${index}`}>
        {index > 0 && ', '}
        {author.uri ? <a href={author.uri} target='_blank' rel='noopener noreferrer'>{author.name}</a> : author.name}
      </React.Fragment>
    ))}
  </span>
)

const StoreAddGoogleUI = (props) => {
  const {
    googleMapsApiKey,
    legacyFields,
    searchState,
    suggestions,
    photoSelection,
    photoState,
    photoRoles = [],
    disabled,
    handleSelectPlace,
    handleSelectNearby,
    handleConfirm,
    handleReject,
    handleReset,
    handleRetry,
    handleUseSuggestion,
    handleDismissSuggestion,
    handleChangePhotoRole,
    handleConfirmRights,
    handleImportPhotos
  } = props

  const [, t] = useLanguage()
  const [{ configs }] = useConfig()
  const id = useId()
  const { status, business, address, nearby = [] } = searchState

  // review: each step replaces the one that had the focus (the search, a card's buttons). Once the person has worked in
  // the search, the focus follows to the new step's title, or back to the search; a business applied by itself on arrival (the
  // modal's hand-off, `?placeId=`) does not take it.
  const sectionRef = useRef(null)
  const searchRef = useRef(null)
  const stepRef = useRef(null)
  const engaged = useRef(false)
  const previousStatus = useRef(status)
  useEffect(() => {
    if (previousStatus.current === status) return
    previousStatus.current = status
    if (!engaged.current || status === 'loading') return
    const active = document.activeElement
    if (active && active !== document.body && !sectionRef.current?.contains(active)) return
    if (status === 'idle') searchRef.current?.focus()
    else stepRef.current?.focus()
  }, [status])

  if (!googleMapsApiKey) return null

  const photos = business?.photos || []
  const canCopyPhotos = !!business?.canCopyPhotos && photos.length > 0
  const selectedCount = Object.keys(photoSelection).length

  const roleLabels = {
    gallery: t('GALLERY', 'Gallery'),
    // the name the add's Images group gives this field
    header: t('HOMEPAGE_BACKGROUND', 'Homepage background'),
    logo: t('BUSINESS_LOGO', 'Business logo')
  }
  const roleOptions = [
    { value: 'none', label: t('DO_NOT_USE', 'Do not use') },
    ...photoRoles.map(role => ({ value: role, label: roleLabels[role] }))
  ]
  const groupLabels = {
    name: t('EXPORT_BUSINESS_NAME', 'Business name'),
    phone: t('PHONE_NUMBER', 'Phone number'),
    address: t('ADDRESS', 'Address'),
    schedule: t('SCHEDULE', 'Schedule')
  }
  const statusNotices = {
    CLOSED_PERMANENTLY: t('GOOGLE_BUSINESS_CLOSED_PERMANENTLY', 'Google lists this business as permanently closed.'),
    CLOSED_TEMPORARILY: t('GOOGLE_BUSINESS_CLOSED_TEMPORARILY', 'Google lists this business as temporarily closed.')
  }
  const suggestionGroups = Object.keys(suggestions).filter(group => groupLabels[group])
  const attribution = <p className='odc-sadd-google-attribution'>{t('DATA_FROM_GOOGLE_MAPS', 'Data from Google Maps')}</p>

  return (
    <section
      ref={sectionRef}
      className='odc-sadd-lookup'
      aria-labelledby={`${id}-title`}
      aria-busy={status === 'loading' || undefined}
      onFocus={() => { engaged.current = true }}
    >
      <h2 className='odc-sadd-lookup-title' id={`${id}-title`}>
        {t('FIND_YOUR_BUSINESS_ON_GOOGLE', 'Find your business on Google')}
        <span className='odc-sadd-group-optional'>{t('OPTIONAL', 'Optional')}</span>
      </h2>

      {SEARCH_STATUSES.includes(status) && (
        <Field
          label={t('SEARCH_BUSINESS_BY_NAME_OR_ADDRESS', 'Business name or address')}
          hint={t('FIND_YOUR_BUSINESS_ON_GOOGLE_HINT', 'Search by business name or address. You can review and edit everything before saving.')}
        >
          <GoogleAutocompleteInput
            name='google_business_search'
            className='odc-field-input'
            apiKey={googleMapsApiKey}
            placeholder={t('SEARCH_BUSINESS_BY_NAME_OR_ADDRESS', 'Business name or address')}
            onSelectPlace={handleSelectPlace}
            fields={legacyFields}
            autoComplete='new-password'
            countryCode={configs?.country_autocomplete?.value || '*'}
            disabled={disabled}
            childRef={node => { searchRef.current = node }}
            // Enter picks a suggestion in Google's list; it must not submit the page's form as well
            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
          />
        </Field>
      )}

      {/* always there, so «Loading…» is announced when it comes */}
      <p className={status === 'loading' ? 'odc-sadd-muted' : 'odc-sr-only'} role='status'>{status === 'loading' ? `${t('LOADING', 'Loading')}…` : ''}</p>

      {status === 'error' && (
        <div ref={stepRef} tabIndex={-1} className='odc-sadd-google-step'>
          <InlineNotice
            tone='danger'
            role='alert'
            action={<Button size='sm' onClick={handleRetry}>{t('RETRY', 'Retry')}</Button>}
          >
            {t('GOOGLE_BUSINESS_SEARCH_ERROR', 'We could not get the details from Google. What you already entered was kept. Try again or fill in the form manually.')}
          </InlineNotice>
        </div>
      )}

      {status === 'nearby' && (
        <div className='odc-sadd-google-card'>
          <h3 className='odc-sadd-google-heading' ref={stepRef} tabIndex={-1}>{t('BUSINESSES_AT_THIS_ADDRESS', 'Businesses at this address')}</h3>
          {address?.address && <p className='odc-sadd-muted'>{address.address}</p>}
          {nearby.length > 0
            ? (
              <ul className='odc-sadd-google-results'>
                {nearby.map(item => (
                  <li key={item.placeId}>
                    <button type='button' className='odc-sadd-google-result' disabled={disabled} onClick={() => handleSelectNearby(item.placeId)}>
                      <strong>{item.name}</strong>
                      <span>{[item.category, item.address].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
              )
            : <p className='odc-sadd-google-text'>{t('NO_BUSINESSES_AT_THIS_ADDRESS', 'We did not find businesses at this address. Search by the business name or fill in the form manually.')}</p>}
          <p className='odc-sadd-muted'>{t('ADDRESS_DOES_NOT_CONFIRM_BUSINESS', 'An address alone does not confirm a business. Pick your business from the list.')}</p>
        </div>
      )}

      {status === 'confirm' && business && (
        <div className='odc-sadd-google-card'>
          <h3 className='odc-sadd-google-heading' ref={stepRef} tabIndex={-1}>{t('IS_THIS_YOUR_BUSINESS', 'Is this your business?')}</h3>
          <div className='odc-sadd-google-summary'>
            {photos[0] && <img className='odc-sadd-google-thumb' src={photos[0].thumbnailUrl} alt='' loading='lazy' referrerPolicy={GOOGLE_PHOTO_REFERRER_POLICY} />}
            <div className='odc-sadd-google-facts'>
              <strong>{business.name}</strong>
              {business.category && <span>{business.category}</span>}
              {business.address && <span>{business.address}</span>}
              {business.phone && <span>{business.phone}</span>}
              {business.website && <a href={business.website} target='_blank' rel='noopener noreferrer'>{business.website}</a>}
              {business.mapsUrl && <a href={business.mapsUrl} target='_blank' rel='noopener noreferrer'>{t('VIEW_ON_GOOGLE_MAPS', 'View on Google Maps')}</a>}
            </div>
          </div>
          {statusNotices[business.status] && <InlineNotice tone='warning'>{statusNotices[business.status]}</InlineNotice>}
          <div className='odc-sadd-google-actions'>
            <Button variant='primary' disabled={disabled} onClick={handleConfirm}>{t('YES_USE_THIS_DATA', 'Yes, use this data')}</Button>
            <Button onClick={handleReject}>{t('NO_SEARCH_ANOTHER', 'No, search another')}</Button>
          </div>
          {attribution}
        </div>
      )}

      {status === 'applied' && business && (
        <div className='odc-sadd-google-card'>
          <div className='odc-sadd-google-applied'>
            <div className='odc-sadd-google-facts'>
              <h3 className='odc-sadd-google-heading' ref={stepRef} tabIndex={-1}>{t('USING_DATA_FROM_GOOGLE', 'Using data from Google')}</h3>
              <span>{[business.name, business.address].filter(Boolean).join(' · ')}</span>
            </div>
            <Button size='sm' disabled={disabled} onClick={handleReset}>{t('CHANGE_BUSINESS', 'Change business')}</Button>
          </div>
          <p className='odc-sadd-muted'>{t('GOOGLE_DATA_REVIEW_HINT', 'Review the fields below and edit anything that is not right. Fields Google does not have stay empty for you to fill in.')}</p>

          {suggestionGroups.length > 0 && (
            <ul className='odc-sadd-google-suggestions'>
              {suggestionGroups.map(group => {
                const preview = Object.values(suggestions[group]).find(value => typeof value === 'string' && value)
                return (
                  <li key={group} className='odc-sadd-google-suggestion'>
                    <p className='odc-sadd-google-text'>
                      <strong>{groupLabels[group]}</strong>
                      {' · '}
                      {t('GOOGLE_SUGGESTS', 'Google suggests')}{preview ? `: ${preview}` : ''}
                    </p>
                    <div className='odc-sadd-google-actions'>
                      <Button size='sm' variant='primary' disabled={disabled} onClick={() => handleUseSuggestion(group)}>{t('USE', 'Use')}</Button>
                      <Button size='sm' onClick={() => handleDismissSuggestion(group)}>{t('KEEP_MINE', 'Keep mine')}</Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {photoRoles.length > 0 && canCopyPhotos && (
            <div className='odc-sadd-google-photos'>
              <h3 className='odc-sadd-google-heading'>{t('PHOTOS_FROM_GOOGLE', 'Photos from Google')}</h3>
              <p className='odc-sadd-muted'>{t('PHOTOS_FROM_GOOGLE_HINT', 'Choose the photos you want to use. They will be copied to your business, so only pick photos you have the right to use.')}</p>
              <ul className='odc-sadd-google-grid'>
                {photos.map((photo, index) => {
                  const photoLabel = `${t('PHOTOS_FROM_GOOGLE', 'Photos from Google')} ${index + 1}`
                  return (
                    <li key={photo.id} className='odc-sadd-google-tile' data-selected={photoSelection[photo.id] ? 'true' : undefined}>
                      <img src={photo.thumbnailUrl} alt='' loading='lazy' referrerPolicy={GOOGLE_PHOTO_REFERRER_POLICY} />
                      <PhotoCredits attributions={photo.attributions} />
                      {photoRoles.length > 1
                        ? (
                          <Select
                            label={photoLabel}
                            options={roleOptions}
                            value={photoSelection[photo.id] || 'none'}
                            disabled={disabled}
                            onValueChange={value => handleChangePhotoRole(photo.id, value === 'none' ? null : value)}
                          />
                          )
                        : (
                          <Checkbox
                            checked={photoSelection[photo.id] === photoRoles[0]}
                            disabled={disabled}
                            onCheckedChange={checked => handleChangePhotoRole(photo.id, checked ? photoRoles[0] : null)}
                          >
                            {roleLabels[photoRoles[0]]}
                          </Checkbox>
                          )}
                    </li>
                  )
                })}
              </ul>
              <Checkbox checked={photoState.rightsConfirmed} disabled={disabled} onCheckedChange={handleConfirmRights}>
                {t('CONFIRM_GOOGLE_PHOTO_RIGHTS', 'I confirm these photos belong to my business or I have permission to use them.')}
              </Checkbox>
              <div className='odc-sadd-google-actions'>
                <Button
                  variant='primary'
                  busy={photoState.loading}
                  disabled={disabled || !selectedCount || !photoState.rightsConfirmed}
                  onClick={handleImportPhotos}
                >
                  {`${t('USE_SELECTED_PHOTOS', 'Use selected photos')} (${selectedCount})`}
                </Button>
              </div>
              {photoState.imported > 0 && <p className='odc-sadd-muted' role='status'>{t('GOOGLE_PHOTOS_ADDED', 'Photos added: _number_').replace('_number_', photoState.imported)}</p>}
              {photoState.failed > 0 && <InlineNotice tone='danger' role='alert'>{t('GOOGLE_PHOTOS_FAILED', 'We could not copy _number_ photo(s). You can upload them manually.').replace('_number_', photoState.failed)}</InlineNotice>}
            </div>
          )}

          {photoRoles.length > 0 && !photos.length && (
            <p className='odc-sadd-muted'>{t('GOOGLE_NO_PHOTOS', 'Google has no photos for this business. You can upload your logo and photos yourself.')}</p>
          )}
          {photoRoles.length > 0 && photos.length > 0 && !canCopyPhotos && (
            <p className='odc-sadd-muted'>{t('GOOGLE_PHOTOS_UNAVAILABLE', 'Photos from Google are not available for this project. You can upload your logo and photos yourself.')}</p>
          )}
          {attribution}
        </div>
      )}
    </section>
  )
}

/** Main's GoogleBusinessSearch controller with the add's Product UI. Takes the controller's props (getFields, values, onChange, …). */
export const StoreAddGoogle = (props) => (
  <GoogleBusinessSearchController {...props} UIComponent={StoreAddGoogleUI} />
)
