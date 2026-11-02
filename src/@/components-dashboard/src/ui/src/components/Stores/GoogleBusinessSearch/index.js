import React from 'react'
import { useLanguage, useConfig, GoogleAutocompleteInput, GoogleBusinessSearch as GoogleBusinessSearchController } from '../../../../../index'
import { Button, Checkbox, DefaultSelect } from '../../../styles'
import {
  Container,
  SearchControl,
  Status,
  Notice,
  Card,
  Summary,
  SummaryInfo,
  Actions,
  ResultList,
  ResultButton,
  AppliedHeader,
  Hint,
  SuggestionList,
  SuggestionItem,
  PhotoSection,
  PhotoGrid,
  PhotoTile,
  PhotoAttribution,
  CheckLabel,
  GoogleAttribution
} from './styles'

const SEARCH_STATUSES = ['idle', 'loading', 'nearby', 'error']

const GOOGLE_PHOTO_REFERRER_POLICY = 'strict-origin-when-cross-origin'

const PhotoCredits = ({ attributions }) => (
  <PhotoAttribution>
    {attributions.map((author, index) => (
      <React.Fragment key={`${author.name}-${index}`}>
        {index > 0 && ', '}
        {author.uri ? <a href={author.uri} target='_blank' rel='noopener noreferrer'>{author.name}</a> : author.name}
      </React.Fragment>
    ))}
  </PhotoAttribution>
)

const GoogleBusinessSearchUI = (props) => {
  const {
    googleMapsApiKey,
    legacyFields,
    searchState,
    suggestions,
    photoSelection,
    photoState,
    photoRoles = [],
    disabled,
    hideTitle,
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

  if (!googleMapsApiKey) return null

  const { status, business, address, nearby } = searchState
  const photos = business?.photos || []
  const canCopyPhotos = !!business?.canCopyPhotos && photos.length > 0
  const selectedCount = Object.keys(photoSelection).length

  const roleLabels = {
    gallery: t('GALLERY', 'Gallery'),
    header: t('BUSINESS_HEADER', 'Business header'),
    logo: t('BUSINESS_LOGO', 'Business logo')
  }
  const roleOptions = [
    { value: 'none', content: t('DO_NOT_USE', 'Do not use') },
    ...photoRoles.map(role => ({ value: role, content: roleLabels[role] }))
  ]
  const groupLabels = {
    name: t('EXPORT_BUSINESS_NAME', 'Business Name'),
    phone: t('PHONE_NUMBER', 'Phone number'),
    address: t('ADDRESS', 'Address'),
    schedule: t('SCHEDULE', 'Schedule')
  }
  const statusNotices = {
    CLOSED_PERMANENTLY: t('GOOGLE_BUSINESS_CLOSED_PERMANENTLY', 'Google lists this business as permanently closed.'),
    CLOSED_TEMPORARILY: t('GOOGLE_BUSINESS_CLOSED_TEMPORARILY', 'Google lists this business as temporarily closed.')
  }
  const suggestionGroups = Object.keys(suggestions).filter(group => groupLabels[group])

  return (
    <Container>
      {!hideTitle && <h2>{t('FIND_YOUR_BUSINESS_ON_GOOGLE', 'Find your business on Google')}</h2>}
      <p>{t('FIND_YOUR_BUSINESS_ON_GOOGLE_HINT', 'Search by business name or address. You can review and edit everything before saving.')}</p>
      {SEARCH_STATUSES.includes(status) && (
        <SearchControl>
          <GoogleAutocompleteInput
            name='google_business_search'
            className='input-autocomplete'
            aria-label={t('SEARCH_BUSINESS_BY_NAME_OR_ADDRESS', 'Business name or address')}
            apiKey={googleMapsApiKey}
            placeholder={t('SEARCH_BUSINESS_BY_NAME_OR_ADDRESS', 'Business name or address')}
            onSelectPlace={handleSelectPlace}
            fields={legacyFields}
            autoComplete='new-password'
            countryCode={configs?.country_autocomplete?.value || '*'}
            disabled={disabled}
          />
        </SearchControl>
      )}

      {status === 'loading' && <Status role='status'>{t('LOADING', 'Loading')}…</Status>}

      {status === 'error' && (
        <Notice role='alert'>
          <p>{t('GOOGLE_BUSINESS_SEARCH_ERROR', 'We could not get the details from Google. What you already entered was kept. Try again or fill in the form manually.')}</p>
          <Button type='button' color='primary' outline borderRadius='8px' onClick={handleRetry}>{t('RETRY', 'Retry')}</Button>
        </Notice>
      )}

      {status === 'nearby' && (
        <Card>
          <h3>{t('BUSINESSES_AT_THIS_ADDRESS', 'Businesses at this address')}</h3>
          <Hint>{address?.address}</Hint>
          {nearby.length > 0
            ? (
              <ResultList>
                {nearby.map(item => (
                  <li key={item.placeId}>
                    <ResultButton type='button' onClick={() => handleSelectNearby(item.placeId)}>
                      <strong>{item.name}</strong>
                      <span>{[item.category, item.address].filter(Boolean).join(' · ')}</span>
                    </ResultButton>
                  </li>
                ))}
              </ResultList>
              )
            : <p>{t('NO_BUSINESSES_AT_THIS_ADDRESS', 'We did not find businesses at this address. Search by the business name or fill in the form manually.')}</p>}
          <Hint>{t('ADDRESS_DOES_NOT_CONFIRM_BUSINESS', 'An address alone does not confirm a business. Pick your business from the list.')}</Hint>
        </Card>
      )}

      {status === 'confirm' && business && (
        <Card>
          <h3>{t('IS_THIS_YOUR_BUSINESS', 'Is this your business?')}</h3>
          <Summary>
            {photos[0] && <img src={photos[0].thumbnailUrl} alt='' loading='lazy' referrerPolicy={GOOGLE_PHOTO_REFERRER_POLICY} />}
            <SummaryInfo>
              <strong>{business.name}</strong>
              {business.category && <span>{business.category}</span>}
              {business.address && <span>{business.address}</span>}
              {business.phone && <span>{business.phone}</span>}
              {business.website && <a href={business.website} target='_blank' rel='noopener noreferrer'>{business.website}</a>}
              {business.mapsUrl && <a href={business.mapsUrl} target='_blank' rel='noopener noreferrer'>{t('VIEW_ON_GOOGLE_MAPS', 'View on Google Maps')}</a>}
            </SummaryInfo>
          </Summary>
          {statusNotices[business.status] && <Notice $warning role='status'><p>{statusNotices[business.status]}</p></Notice>}
          <Actions>
            <Button type='button' color='primary' borderRadius='8px' onClick={handleConfirm}>{t('YES_USE_THIS_DATA', 'Yes, use this data')}</Button>
            <Button type='button' color='primary' outline borderRadius='8px' onClick={handleReject}>{t('NO_SEARCH_ANOTHER', 'No, search another')}</Button>
          </Actions>
          <GoogleAttribution>{t('DATA_FROM_GOOGLE_MAPS', 'Data from Google Maps')}</GoogleAttribution>
        </Card>
      )}

      {status === 'applied' && business && (
        <Card>
          <AppliedHeader>
            <div>
              <strong>{t('USING_DATA_FROM_GOOGLE', 'Using data from Google')}</strong>
              <span>{[business.name, business.address].filter(Boolean).join(' · ')}</span>
            </div>
            <Button type='button' color='primary' outline borderRadius='8px' disabled={disabled} onClick={handleReset}>{t('CHANGE_BUSINESS', 'Change business')}</Button>
          </AppliedHeader>
          <Hint>{t('GOOGLE_DATA_REVIEW_HINT', 'Review the fields below and edit anything that is not right. Fields Google does not have stay empty for you to fill in.')}</Hint>

          {suggestionGroups.length > 0 && (
            <SuggestionList>
              {suggestionGroups.map(group => {
                const preview = Object.values(suggestions[group]).find(value => typeof value === 'string' && value)
                return (
                  <SuggestionItem key={group}>
                    <div>
                      <strong>{groupLabels[group]}</strong>
                      {' · '}
                      {t('GOOGLE_SUGGESTS', 'Google suggests')}{preview ? `: ${preview}` : ''}
                    </div>
                    <div>
                      <Button type='button' color='primary' borderRadius='8px' disabled={disabled} onClick={() => handleUseSuggestion(group)}>{t('USE', 'Use')}</Button>
                      <Button type='button' color='primary' outline borderRadius='8px' onClick={() => handleDismissSuggestion(group)}>{t('KEEP_MINE', 'Keep mine')}</Button>
                    </div>
                  </SuggestionItem>
                )
              })}
            </SuggestionList>
          )}

          {photoRoles.length > 0 && canCopyPhotos && (
            <PhotoSection>
              <h4>{t('PHOTOS_FROM_GOOGLE', 'Photos from Google')}</h4>
              <Hint>{t('PHOTOS_FROM_GOOGLE_HINT', 'Choose the photos you want to use. They will be copied to your business, so only pick photos you have the right to use.')}</Hint>
              <PhotoGrid>
                {photos.map(photo => (
                  <PhotoTile key={photo.id} $selected={!!photoSelection[photo.id]}>
                    <img src={photo.thumbnailUrl} alt='' loading='lazy' referrerPolicy={GOOGLE_PHOTO_REFERRER_POLICY} />
                    <div>
                      <PhotoCredits attributions={photo.attributions} />
                      {photoRoles.length > 1
                        ? (
                          <DefaultSelect
                            options={roleOptions}
                            defaultValue={photoSelection[photo.id] || 'none'}
                            onChange={value => handleChangePhotoRole(photo.id, value === 'none' ? null : value)}
                            isDisabled={disabled}
                          />
                          )
                        : (
                          <CheckLabel>
                            <Checkbox
                              checked={photoSelection[photo.id] === photoRoles[0]}
                              disabled={disabled}
                              onChange={e => handleChangePhotoRole(photo.id, e.target.checked ? photoRoles[0] : null)}
                            />
                            {roleLabels[photoRoles[0]]}
                          </CheckLabel>
                          )}
                    </div>
                  </PhotoTile>
                ))}
              </PhotoGrid>
              <CheckLabel>
                <Checkbox
                  checked={photoState.rightsConfirmed}
                  disabled={disabled}
                  onChange={e => handleConfirmRights(e.target.checked)}
                />
                {t('CONFIRM_GOOGLE_PHOTO_RIGHTS', 'I confirm these photos belong to my business or I have permission to use them.')}
              </CheckLabel>
              <Actions>
                <Button
                  type='button'
                  color='primary'
                  borderRadius='8px'
                  disabled={disabled || !selectedCount || !photoState.rightsConfirmed || photoState.loading}
                  onClick={handleImportPhotos}
                >
                  {photoState.loading ? `${t('LOADING', 'Loading')}…` : `${t('USE_SELECTED_PHOTOS', 'Use selected photos')} (${selectedCount})`}
                </Button>
              </Actions>
              {photoState.imported > 0 && <Status role='status'>{t('GOOGLE_PHOTOS_ADDED', 'Photos added: _number_').replace('_number_', photoState.imported)}</Status>}
              {photoState.failed > 0 && <Notice role='alert'><p>{t('GOOGLE_PHOTOS_FAILED', 'We could not copy _number_ photo(s). You can upload them manually.').replace('_number_', photoState.failed)}</p></Notice>}
            </PhotoSection>
          )}

          {photoRoles.length > 0 && !photos.length && (
            <Hint>{t('GOOGLE_NO_PHOTOS', 'Google has no photos for this business. You can upload your logo and photos yourself.')}</Hint>
          )}
          {photoRoles.length > 0 && photos.length > 0 && !canCopyPhotos && (
            <Hint>{t('GOOGLE_PHOTOS_UNAVAILABLE', 'Photos from Google are not available for this project. You can upload your logo and photos yourself.')}</Hint>
          )}
          <GoogleAttribution>{t('DATA_FROM_GOOGLE_MAPS', 'Data from Google Maps')}</GoogleAttribution>
        </Card>
      )}
    </Container>
  )
}

export const GoogleBusinessSearch = (props) => {
  const googleBusinessSearchProps = {
    ...props,
    UIComponent: GoogleBusinessSearchUI
  }
  return <GoogleBusinessSearchController {...googleBusinessSearchProps} />
}
