import React, { useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Dialog, TextField } from '../../Shared/Product'
import '../schools.css'
import '../SchoolGrades/grades.css'

// redesign SC-B2 (decision 4; M-SC06): add and edit a classroom in a Product Dialog (main: a legacy Modal with a bare Input). It owns what
// is typed (a failed save leaves the dialog open with it) and the check of the name; saving is the tab's. The tab mounts a new dialog
// (a new `key`) each time it opens, so the form starts from the classroom (or empty).
//
// @param {boolean}  props.open
// @param {object|null} props.classroom   The classroom being edited (`{ id, name }`), or null to add one.
// @param {boolean}  props.saving         The save is running: «Save» is busy and the dialog cannot be left.
// @param {Function} props.onSave         `({ name }) => void`: the tab calls the API and closes on success.
// @param {Function} props.onClose        `() => void`
export const ClassroomDialog = ({ open = false, classroom = null, saving = false, onSave, onClose }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const isEdit = Boolean(classroom && classroom.id)
  const [name, setName] = useState(classroom ? (classroom.name ?? '') : '')
  const [nameError, setNameError] = useState(null)
  const nameRef = useRef(null)

  const submit = () => {
    if (saving) return
    if (!name.trim()) {
      // redesign SC-B2 (M-SC06): the error is on the field too, not only in a toast that goes away; the focus goes to it
      const message = t('SCHOOL_NAME_REQUIRED', 'Name is required')
      setNameError(message)
      showToast(ToastType.Error, message)
      nameRef.current?.focus()
      return
    }
    onSave?.({ name })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !saving) onClose?.() }}
      size='sm'
      title={isEdit ? t('SCHOOL_EDIT_CLASSROOM', 'Edit classroom') : t('SCHOOL_ADD_CLASSROOM', 'Add classroom')}
      closeLabel={t('CLOSE', 'Close')}
      closeDisabled={saving}
      footer={(
        <>
          <Button disabled={saving} onClick={() => onClose?.()}>{t('CANCEL', 'Cancel')}</Button>
          <Button variant='primary' busy={saving} onClick={submit}>{t('SAVE', 'Save')}</Button>
        </>
      )}
    >
      <div className='odc-school-dialog-form'>
        <TextField
          ref={nameRef}
          label={t('NAME', 'Name')}
          required
          requiredLabel={t('REQUIRED', 'Required')}
          value={name}
          error={nameError || undefined}
          placeholder={t('SCHOOL_CLASSROOM_NAME_HINT', 'e.g. Ms. Smith - Grade 1')}
          autoComplete='off'
          onChange={(next) => { setName(next); if (nameError) setNameError(null) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent?.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
        />
      </div>
    </Dialog>
  )
}
