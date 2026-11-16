import React, { useId } from 'react'
import { useLanguage } from '~components'
import { Button } from '../../Shared/Product'
import './clone-order.css'

// redesign fix-qa E5: the content of the clone dialog on the brand. The panel opens it inside a Product
// Dialog that already carries the title «Clone order», so there is no second one here; the two choices are
// a radio group (they were pressed-state buttons with legacy icons) and the actions end with Cancel · Clone.
export const CloneOrder = (props) => {
  const {
    handleCloneOrder,
    setCloneState,
    cloneState,
    // How to close the dialog. The panel does not pass one today, so Cancel presses the close button of the
    // dialog it sits in, which runs the dialog's own close path (including the URL it rewrites).
    onCancel
  } = props
  const [, t] = useLanguage()
  const groupName = useId()

  const handleCancel = (event) => {
    if (onCancel) {
      onCancel()
      return
    }
    event.currentTarget.closest('[role="dialog"]')?.querySelector('.odc-overlay-close')?.click()
  }

  const options = [
    { value: 1, title: t('CLONE_FULL_ORDER', 'Clone full order') },
    { value: 2, title: t('CLONE_ORDER_WITHOUT_PRODUCTS', 'Clone order without products') }
  ]

  return (
    <div className='odc-clone'>
      <div role='radiogroup' aria-label={t('CLONE_ORDER', 'Clone order')} className='odc-clone-options'>
        {options.map(option => (
          <label key={option.value} className='odc-clone-option'>
            <input
              type='radio'
              name={groupName}
              value={option.value}
              checked={cloneState.type === option.value}
              onChange={() => setCloneState({ ...cloneState, type: option.value })}
            />
            <span className='odc-clone-mark' aria-hidden='true' />
            <span>{option.title}</span>
          </label>
        ))}
      </div>
      <div className='odc-clone-actions'>
        <Button onClick={handleCancel}>{t('CANCEL', 'Cancel')}</Button>
        <Button
          variant='primary'
          busy={!!cloneState.loading}
          disabled={!!cloneState.loading}
          onClick={() => handleCloneOrder()}
        >
          {t('CLONE', 'Clone')}
        </Button>
      </div>
    </div>
  )
}
