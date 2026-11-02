import React from 'react'
import { useLanguage, useEvent } from '../../../../../index'
import { InfoCircleFill } from 'react-bootstrap-icons'
import { IconButton } from '../../../styles'
import { GoogleBusinessSearch } from '../GoogleBusinessSearch'
import {
  Container,
  FormControl,
  Label,
  ButtonGroup,
  InfoWrapper,
  InfoContent
} from './styles'

export const BusinessAddStore = () => {
  const [, t] = useLanguage()
  const [events] = useEvent()

  const handleConfirm = (business) => {
    events.emit('go_to_page', {
      page: 'business_add',
      search: `?${new URLSearchParams({ placeId: business.placeId })}`,
      state: { googleBusiness: business }
    })
  }

  const handleSkip = (e) => {
    e.preventDefault()
    events.emit('go_to_page', { page: 'business_add' })
  }

  return (
    <Container>
      <h2>{t('ADD_NEW_STORE', 'Add new store')}</h2>
      <FormControl>
        <Label>
          <p>{t('FIND_YOUR_BUSINESS_ON_GOOGLE', 'Find your business on Google')}</p>
          <InfoWrapper>
            <IconButton
              color='primary'
            >
              <InfoCircleFill />
            </IconButton>
            <InfoContent>
              {t('ADD_NEW_STORE_INFO', 'If you can’t find your restaurant in the results, try adding your city at the end of your restaurant name (For example: “Pizza Place New York City”)')}
            </InfoContent>
          </InfoWrapper>
        </Label>
        <GoogleBusinessSearch
          hideTitle
          onConfirm={handleConfirm}
        />
      </FormControl>
      <ButtonGroup>
        <a onClick={handleSkip} href='/stores/add' role='link'>{t('SKIP_AND_ADD_MANUALLY', 'Skip and  Add manually')}</a>
      </ButtonGroup>
    </Container>
  )
}
