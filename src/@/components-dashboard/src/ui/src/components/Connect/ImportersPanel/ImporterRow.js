import React from 'react'
import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { useMenuImportRun } from '../Importers/useMenuImportRun'
import { ImportRunStatus } from './ImportRunStatus'

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
    business,
    project,
    onImportClick,
    hideRunStatus = false
  } = props

  const [, t] = useLanguage()
  const runRef = { project, businessId: business?.id, source: card.id }
  const run = useMenuImportRun(runRef)

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
            {run && !hideRunStatus && (
              <ImportRunStatus run={run} runRef={runRef} onRetry={handleImportClick} />
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
