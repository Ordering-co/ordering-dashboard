import React, { useRef, useState } from 'react'

import { useLanguage, useToast, ToastType } from '../../../../../index'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { ColorField } from '../../Shared/Product/ColorField'
import { useKeepFocus } from './useKeepFocus'
import './app-builds.css'

// redesign my-products B4 (D3/D6, M-MP-02): Look › Colors. What main's Theme tab painted, as P/ColorField in a
// grid: each color is saved at once as main does (`updateBaseActions({ id, type: 'colors', body })`, `CORRECTLY_SAVED_THEME_COLOR`),
// the field disabled while that color saves, the app updated without mutating its list. What main swallowed is now said in the
// field (M-MP-02): the error of the API, translated, with the chosen color kept in the field until another is chosen.
// The editor paints the section's h2.

const omit = (map, id) => {
  const { [id]: _removed, ...rest } = map
  return rest
}

export const ColorsSection = (props) => {
  const { app, updateBaseActions, updateAppValues } = props

  const [, t] = useLanguage()
  const [, { showToast }] = useToast()
  // `changes`: the color chosen and not yet stored (it stays if saving fails); `saving`: ids being saved; `errors`: by id
  const [state, setState] = useState({ changes: {}, saving: [], errors: {} })
  // the answer of a save arrives after the render it was started in: the app it updates is the current one
  const appRef = useRef(app)
  appRef.current = app
  // redesign my-products R1-02: the field is disabled while its color saves, which drops the focus on <body>;
  // it goes back to the field that was being edited when the save ends, whether it worked or not (main's disabling is kept)
  const { remember, restore } = useKeepFocus()
  const fields = useRef({})

  const colors = (app?.baseActions ?? []).filter((action) => action?.group === 'colors')
  if (!colors.length) return null

  const finish = (id, { keep, error }) => setState((current) => ({
    changes: keep ? current.changes : omit(current.changes, id),
    saving: current.saving.filter((item) => item !== id),
    errors: error ? { ...current.errors, [id]: error } : omit(current.errors, id)
  }))

  const fail = (id, message) => finish(id, {
    keep: true,
    error: typeof message === 'string' && message.trim()
      ? translateApiMessage(t, message, message)
      : t('ERROR_UNKNOWN', 'An error has occurred')
  })

  const handleChange = async (id, color) => {
    remember()
    setState((current) => ({
      changes: { ...current.changes, [id]: color },
      saving: [...current.saving.filter((item) => item !== id), id],
      errors: omit(current.errors, id)
    }))
    try {
      const { error, result } = await updateBaseActions({ id, type: 'colors', body: JSON.stringify({ text_content: color }) })
      if (error) {
        fail(id, Array.isArray(result) ? result[0] : result)
        return
      }
      const current = appRef.current
      const actions = current?.baseActions ?? []
      const index = actions.findIndex((action) => Number(action.id) === Number(result?.id))
      if (index !== -1) {
        updateAppValues({ ...current, baseActions: actions.map((action, at) => (at === index ? { ...action, ...result } : action)) })
      }
      showToast(ToastType.Success, t('CORRECTLY_SAVED_THEME_COLOR', 'Correctly saved color'))
      finish(id, { keep: false })
    } catch (err) {
      fail(id, err?.message ?? err)
    } finally {
      // the picker of the field, if what had the focus is gone with the closed panel
      restore(() => fields.current[id]?.querySelector('.od-color-picker-trigger'))
    }
  }

  return (
    <div className='odc-api'>
      <div className='odc-api-colors'>
        {colors.map((color) => (
          <ColorField
            key={color.id}
            ref={(node) => { fields.current[color.id] = node }}
            label={t(`THEME_COLOR_${String(color.name ?? '').toUpperCase().replace(/ /g, '_')}`, color.name ?? '')}
            value={state.changes[color.id] ?? color.text_content}
            error={state.errors[color.id]}
            disabled={state.saving.includes(color.id)}
            onChange={(hex) => handleChange(color.id, hex)}
          />
        ))}
      </div>
    </div>
  )
}
