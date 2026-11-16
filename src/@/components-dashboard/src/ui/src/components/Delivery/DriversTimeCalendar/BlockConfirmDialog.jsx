import React, { useRef } from 'react'

import { useLanguage } from '../../../../../index'
import { Button, Dialog, RadioGroup } from '../../Shared/Product'
import './block-dialog.css'

// redesign DT-B2 (decision 12 | DT-15, C8): the confirmation of saving or deleting a block, with the propagation of the change (none, all,
// from now, from this event). One question per action, in the page's own words: it names WHICH block in `summary` (driver · hours · day) and
// the focus starts on Cancel, never on the action. Deleting is the danger tone; saving is the primary. While `busy` nothing closes it.
// (row 34, drivers-time-display P-3): `repeats` is false for a block with no rrule. There is no series to ask about, so the
// propagation question goes; the dialog stays (it is also the confirmation of a destructive delete) and the propagation stays 'none'.
export const BlockConfirmDialog = ({ open, kind = 'edit', summary, propagation = 'none', onPropagationChange, onConfirm, onCancel, busy = false, repeats = true }) => {
  const [, t] = useLanguage()
  const cancelRef = useRef(null)
  const deleting = kind === 'delete'

  const cancel = () => {
    if (!busy) onCancel?.()
  }

  const options = [
    { value: 'none', label: t('NONE', 'None'), description: t('DRIVER_BLOCKS_PROPAGATION_NONE_HINT', 'Only this shift') },
    { value: 'all', label: t('ALL', 'All'), description: t('DRIVER_BLOCKS_PROPAGATION_ALL_HINT', 'Every shift of the series') },
    { value: 'from_now', label: t('FROM_NOW', 'From now'), description: t('DRIVER_BLOCKS_PROPAGATION_FROM_NOW_HINT', 'From today on') },
    { value: 'from_event', label: t('FROM_EVENT', 'From event'), description: t('DRIVER_BLOCKS_PROPAGATION_FROM_EVENT_HINT', 'This shift and the ones after it') }
  ]

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) cancel() }}
      title={deleting ? t('DRIVER_BLOCKS_DELETE_TITLE', 'Delete this shift?') : t('DRIVER_BLOCKS_SAVE_TITLE', 'Save changes to this shift?')}
      description={summary}
      closeLabel={t('CLOSE', 'Close')}
      size='sm'
      initialFocus={cancelRef}
      footer={(
        <>
          <Button ref={cancelRef} disabled={busy} onClick={cancel}>{t('CANCEL', 'Cancel')}</Button>
          <Button
            variant={deleting ? 'danger' : 'primary'}
            busy={busy}
            onClick={() => onConfirm?.()}
          >
            {deleting ? t('DELETE_BLOCK', 'Delete shift') : t('DRIVER_BLOCKS_SAVE_BLOCK', 'Save shift')}
          </Button>
        </>
      )}
    >
      {repeats && (
        <RadioGroup
          label={t('SELECT_PROPAGATION', 'Select a propagation option')}
          options={options}
          value={propagation}
          onValueChange={(next) => onPropagationChange?.(next)}
          disabled={busy}
        />
      )}
    </Dialog>
  )
}
