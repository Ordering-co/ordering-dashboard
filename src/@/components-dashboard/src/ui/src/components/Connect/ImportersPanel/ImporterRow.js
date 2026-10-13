import React from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'

import {
  ImporterRowContainer,
  ImporterInfo,
  ImporterLogo,
  ImporterText,
  ImporterNote
} from './styles'

export const ImporterRow = (props) => {
  const {
    card,
    onImportClick
  } = props

  const [, t] = useLanguage()

  const handleImportClick = (event) => {
    event.stopPropagation()
    onImportClick?.(card)
  }

  return (
    <ImporterRowContainer data-testid={`importer-row-${card.id}`}>
      <ImporterInfo className='connect-pos-wrapper'>
        <div className='connect-pos'>
          <ImporterLogo $color={card.logoColor} aria-hidden='true'>
            {card.logoLabel}
          </ImporterLogo>
          <ImporterText>
            <p className='title'>{t(card.titleKey, card.titleDefault)}</p>
            <p className='description'>
              {t(card.descriptionKey, card.descriptionDefault)}
            </p>
            {card.showImagesNote && (
              <ImporterNote data-testid='gloriafood-images-note'>
                {t(
                  'IMPORTER_GLORIAFOOD_IMAGES_NOTE',
                  'Product images cannot be migrated via the GloriaFood API.'
                )}
              </ImporterNote>
            )}
          </ImporterText>
        </div>
        <Button
          color='primary'
          borderRadius='8px'
          onClick={handleImportClick}
        >
          {t(card.importButtonKey, card.importButtonDefault)}
        </Button>
      </ImporterInfo>
    </ImporterRowContainer>
  )
}
