import React from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Dialog } from '../../Shared/Product'
import './builder-detail.css'

// redesign B2: on P/Dialog, still an `alertdialog` named by its title and described by its text

/**
 * Activating a website was refused because it has no name
 * (`product.incomplete` with `missing: ['name']`). "Add a name" opens
 * the rename in the header.
 */
export const NameRequiredDialog = (props) => {
  const { onClose, onAddName } = props
  const [, t] = useLanguage()

  return (
    <Dialog
      open
      onOpenChange={(next) => { if (!next) onClose() }}
      role='alertdialog'
      size='sm'
      title={t('BUILDER_NAME_REQUIRED_TITLE', 'Add a name to activate this website')}
      closeLabel={t('CLOSE', 'Close')}
      description={t('BUILDER_NAME_REQUIRED_TEXT', 'A website needs a name before it goes active. It’s the name you see in Ordering; your customers don’t see it.')}
      footer={(
        <>
          <Button onClick={onClose}>{t('CLOSE', 'Close')}</Button>
          <Button variant='primary' onClick={onAddName}>{t('BUILDER_ADD_NAME', 'Add a name')}</Button>
        </>
      )}
    >
      <p className='odc-bd-small'>{t('BUILDER_NAME_REQUIRED_NEXT', 'After you save it, activate the website again.')}</p>
    </Dialog>
  )
}
