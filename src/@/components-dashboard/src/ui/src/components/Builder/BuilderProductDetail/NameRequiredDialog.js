import React, { useId } from 'react'
import { PencilSquare } from 'react-bootstrap-icons'

import { useLanguage } from '../../../../../index'
import { Button } from '../../../styles'
import { Modal } from '../../Shared'
import { DialogBody, DialogFooter, DialogIconTitle, MutedText } from '../styles'

/**
 * Activating a website was refused because it has no name
 * (`product.incomplete` with `missing: ['name']`). "Add a name" opens
 * the rename in the header.
 */
export const NameRequiredDialog = (props) => {
  const { onClose, onAddName } = props
  const [, t] = useLanguage()
  const titleId = useId()
  const bodyId = useId()

  return (
    <Modal
      open
      width='min(520px, calc(100vw - 32px))'
      padding='24px'
      onClose={onClose}
    >
      <DialogBody role='alertdialog' aria-labelledby={titleId} aria-describedby={bodyId}>
        <DialogIconTitle>
          <span aria-hidden='true'><PencilSquare /></span>
          <h2 id={titleId}>{t('BUILDER_NAME_REQUIRED_TITLE', 'Add a name to activate this website')}</h2>
        </DialogIconTitle>
        <p id={bodyId}>{t('BUILDER_NAME_REQUIRED_TEXT', 'A website needs a name before it goes active. It’s the name you see in Ordering; your customers don’t see it.')}</p>
        <MutedText as='p'>{t('BUILDER_NAME_REQUIRED_NEXT', 'After you save it, activate the website again.')}</MutedText>
        <DialogFooter>
          <Button type='button' color='secundary' borderRadius='8px' onClick={onClose}>{t('CLOSE', 'Close')}</Button>
          <Button type='button' color='primary' borderRadius='8px' onClick={onAddName}>{t('BUILDER_ADD_NAME', 'Add a name')}</Button>
        </DialogFooter>
      </DialogBody>
    </Modal>
  )
}
