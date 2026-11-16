import React, { useMemo, useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { Button, Dialog, Field, TextField } from '../../Shared/Product'
import { useFieldFrame } from '../../Shared/Product/Field'
import { FirstSelect } from '../../Shared/UI/FirstSelect'
import { SelectSurfaceContext } from '../../Shared/UI/selectPlacement'
import { gradeCodeOptions } from '../schoolDisplay'
import '../schools.css'
import './grades.css'

// redesign SC-B2 (decision 4; M-SC06): add and edit a grade in a Product Dialog (main: a legacy Modal with a bare Input and the select).
// It owns what is typed (a failed save leaves the dialog open with it) and the check of the name; saving is the tab's. The tab mounts a
// new dialog (a new `key`) each time it opens, so the form starts from the grade (or empty) without an effect that resets it.
//
// @param {boolean}  props.open
// @param {object|null} props.grade   The grade being edited (`{ id, name, code }`), or null to add one.
// @param {boolean}  props.saving     The save is running: «Save» is busy and the dialog cannot be left.
// @param {Function} props.onSave     `({ name, code }) => void`: the tab calls the API and closes on success.
// @param {Function} props.onClose    `() => void`

// C18 (the anatomy of every dropdown of the redesigned pages): the list starts at the trigger and is as wide as it
const FIT_TRIGGER = { fitTrigger: true }

// The code select, named by the visible label of its P/Field (the trigger reads «Code Grade 1»). No search box, as in main.
const CodeSelect = ({ value, onChange }) => {
  const [, t] = useLanguage()
  const frame = useFieldFrame()
  const options = useMemo(() => gradeCodeOptions(t), [t])
  return (
    <FirstSelect
      portal // the list is an overlay over the dialog, not part of its body (redesign F6d-2)
      ariaLabelledBy={frame?.labelId || undefined}
      ariaLabel={t('SCHOOL_GRADE_CODE', 'Code')}
      options={options}
      defaultValue={value}
      placeholder={t('SELECT_OPTION', 'Select option')}
      onChange={onChange}
    />
  )
}

export const GradeDialog = ({ open = false, grade = null, saving = false, onSave, onClose }) => {
  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  const isEdit = Boolean(grade && grade.id)
  // as main: a new grade starts with an empty code; an edited one keeps the code it has, whatever it is
  const [name, setName] = useState(grade ? (grade.name ?? '') : '')
  const [code, setCode] = useState(grade ? grade.code : '')
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
    onSave?.({ name, code })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next && !saving) onClose?.() }}
      size='sm'
      title={isEdit ? t('SCHOOL_EDIT_GRADE', 'Edit grade') : t('SCHOOL_ADD_GRADE', 'Add grade')}
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
          autoComplete='off'
          onChange={(next) => { setName(next); if (nameError) setNameError(null) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent?.isComposing) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <SelectSurfaceContext.Provider value={FIT_TRIGGER}>
          <Field label={t('SCHOOL_GRADE_CODE', 'Code')}>
            <CodeSelect value={code} onChange={setCode} />
          </Field>
        </SelectSurfaceContext.Provider>
      </div>
    </Dialog>
  )
}
