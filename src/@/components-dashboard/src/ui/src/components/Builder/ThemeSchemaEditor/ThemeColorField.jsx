import React, { useEffect, useId, useRef, useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { Link } from '../../Shared/Icon'
import { TextField, cx, tokenOffset, tokenPx, useProductDir } from '../../Shared/Product'
import { useOverlayLayer } from '../../Shared/Product/Dialog'
import { usePopoverTabOut } from '../../Shared/Product/FilterPopover'
import { getValueErrorMessage } from '../utils'
import { alphaOf, formatColor, fromPickerColor, toPickerColor, withAlpha } from './colors'
import './theme-color-field.css'

// redesign B3b (decision 2): the theme's colour, a local piece. P/ColorField takes a hex only (no alias to a theme
// colour, no alpha), so the old react-bootstrap Overlay/Popover becomes a Base UI Popover in the overlay host, non-modal like
// P/FilterPopover: no focus trap, Tab out of it goes on, Escape closes it and the focus goes back to the swatch button.

const sideOffset = tokenOffset('--od-space-1')
const collisionAvoidance = { side: 'flip', align: 'shift' }
const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i
const HEX6 = /^#?[0-9a-f]{6}$/i
const asHex = (text) => (text.startsWith('#') ? text : `#${text}`)

/** A colour over a checkerboard, so a translucent one shows as one. */
export const ColorSwatch = ({ color, small = false }) => (
  <span className='odc-tcf-swatch' data-size={small ? 'sm' : undefined} style={{ '--odc-tcf-color': color || 'transparent' }} aria-hidden='true' />
)

/** The opacity of a colour that may be translucent, 0 to 100 % in steps of 1: a native range. */
const OpacityInput = ({ t, label, value, onChange }) => {
  const percent = Math.round(alphaOf(value) * 100)
  return (
    <label className='odc-tcf-opacity'>
      <span aria-hidden='true'>{t('BUILDER_THEME_OPACITY', 'Opacity')}</span>
      <input type='range' min={0} max={100} step={1} value={percent} aria-label={t('BUILDER_THEME_OPACITY_OF', '_name_ opacity').replace('_name_', label)} aria-valuetext={`${percent} %`} onChange={(e) => onChange(withAlpha(value, Number(e.target.value) / 100))} />
      <output aria-hidden='true' className='odc-figure'>{percent} %</output>
    </label>
  )
}

/** A colour picked with the browser's picker; with `alpha`, its opacity too (the schema's `alpha`). */
export const ColorSwatchInput = ({ t, label, value, onChange, invalid, describedBy, alpha = false }) => (
  <span className='odc-tcf-input'>
    <label className='odc-tcf-picker' data-invalid={invalid ? '' : undefined}>
      <input type='color' aria-label={label} aria-invalid={invalid ? 'true' : undefined} aria-describedby={describedBy} value={toPickerColor(value)} onChange={(e) => onChange(fromPickerColor(e.target.value, value, { alpha }))} />
      <ColorSwatch color={value} />
      <span aria-hidden='true' className='odc-tcf-text'>{value === 'transparent' && t ? t('BUILDER_THEME_TRANSPARENT', 'Transparent') : formatColor(value)}</span>
    </label>
    {alpha && <OpacityInput t={t} label={label} value={value} onChange={onChange} />}
  </span>
)

/**
 * The custom colour typed as hex: six digits save as they are typed; three (#00a) save on leaving the field or on Enter, so a
 * colour on its way isn't saved. One that isn't a hex says so on leaving or Enter, stays as typed and isn't saved.
 */
const HexField = ({ t, label, value, alpha, onChange }) => {
  const shown = toPickerColor(value).toUpperCase()
  const [draft, setDraft] = useState(shown)
  const [checked, setChecked] = useState(false)
  useEffect(() => { setDraft(prev => (HEX.test(prev) && toPickerColor(asHex(prev)) === toPickerColor(value) ? prev : shown)) }, [value])
  const wrong = checked && draft !== '' && !HEX.test(draft)
  const settle = () => {
    if (draft === '') return setDraft(shown)
    if (HEX.test(draft)) {
      if (!HEX6.test(draft)) onChange(fromPickerColor(asHex(draft), value, { alpha }))
      return
    }
    setChecked(true)
  }
  return (
    <TextField
      aria-label={label}
      value={draft}
      placeholder='#RRGGBB'
      spellCheck={false}
      autoComplete='off'
      className='odc-figure'
      fieldClassName='odc-tcf-hex'
      invalid={wrong}
      error={wrong ? getValueErrorMessage([], 'color', t) : undefined}
      onChange={(text) => {
        setDraft(text)
        setChecked(false)
        if (HEX6.test(text)) onChange(fromPickerColor(asHex(text), value, { alpha }))
      }}
      onBlur={settle}
      onKeyDown={(e) => { if (e.key === 'Enter') settle() }}
    />
  )
}

/**
 * A component's colour: the swatch button shows what it is (a theme colour, with its opacity, or its own) and opens the
 * popover with the theme's colours (`colors`: `{ name, label, value, alias }`, pressed while `selected` is its name; a pick
 * saves its `alias` and closes) and a custom colour (the browser's picker and its hex; with `alpha`, its opacity).
 */
export const ThemeColorField = ({ t, label, valueText, color, linked, compact, invalid, describedBy, colors, selected, alpha, onChange }) => {
  const dir = useProductDir()
  const triggerRef = useRef(null)
  const popupId = useId()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const { layer, popupRef, lastFocusedRef, portalStyle, onOpenChangeComplete } = useOverlayLayer(open, { modal: false })
  const close = () => setOpen(false)
  const tabOut = usePopoverTabOut({ getOpener: () => triggerRef.current, close, layer })

  const handleOpenChange = (next, details) => {
    if (next) return
    // a press on the swatch button is its own toggle, not an outside press
    if (details?.reason === 'outside-press' && triggerRef.current?.contains(details.event?.target)) return details.cancel()
    if (details?.reason === 'escape-key' && !layer.isActive) return details.cancel()
    close()
  }

  const linkedText = t('BUILDER_THEME_LINKED', 'Theme')
  const pickLabel = t('BUILDER_THEME_PICK_COLOR', 'Pick a color')
  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className='odc-tcf-trigger'
        data-invalid={invalid ? '' : undefined}
        aria-haspopup='dialog'
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? popupId : undefined}
        aria-label={`${label}: ${valueText}`}
        aria-describedby={describedBy}
        title={compact ? valueText : undefined}
        onClick={() => { tabOut.reset(); setOpen(prev => !prev) }}
      >
        <ColorSwatch color={color} small />
        <span aria-hidden='true' className='odc-tcf-text'>{valueText}</span>
        {compact
          ? linked && <span className='odc-tcf-tag' data-linked='' aria-hidden='true' title={linkedText}><Link className='odc-icon' /></span>
          : (
            <span className='odc-tcf-tag' data-linked={linked ? '' : undefined} aria-hidden='true'>
              {linked && <Link className='odc-icon' />}
              {linked ? linkedText : t('BUILDER_THEME_CUSTOM', 'Custom')}
            </span>
            )}
      </button>
      {layer.ready && (
        <PopoverPrimitive.Root open={open} modal={false} onOpenChange={handleOpenChange} onOpenChangeComplete={onOpenChangeComplete}>
          <PopoverPrimitive.Portal container={layer.host} className='odc-root odc-overlay-portal' style={portalStyle} dir={dir}>
            <PopoverPrimitive.Positioner
              anchor={triggerRef}
              side='bottom'
              align='start'
              sideOffset={sideOffset}
              collisionAvoidance={collisionAvoidance}
              collisionPadding={tokenPx('--od-x-viewport-gap')}
              className='odc-orders-popover-positioner'
            >
              <PopoverPrimitive.Popup
                ref={popupRef}
                id={popupId}
                aria-label={label}
                dir={dir}
                className={cx('odc-orders-popover', 'odc-tcf-popup')}
                finalFocus={tabOut.finalFocus}
                onKeyDown={tabOut.onKeyDown}
                onFocusCapture={event => { lastFocusedRef.current = event.target }}
              >
                <h4 className='odc-tcf-heading'>{t('BUILDER_THEME_THEME_COLORS', 'Theme colors')}</h4>
                <div className='odc-tcf-grid'>
                  {colors.map(item => (
                    <button
                      key={item.name}
                      type='button'
                      className='odc-tcf-color'
                      style={{ '--odc-tcf-color': item.value || 'transparent' }}
                      aria-pressed={selected === item.name ? 'true' : 'false'}
                      aria-label={item.label}
                      title={item.label}
                      onClick={() => { onChange(item.alias); tabOut.reset(); close() }}
                    />
                  ))}
                </div>
                <h4 id={titleId} className='odc-tcf-heading'>{t('BUILDER_THEME_CUSTOM_COLOR', 'Custom color')}</h4>
                <div role='group' aria-labelledby={titleId} className='odc-tcf-custom'>
                  <div className='odc-tcf-custom-row'>
                    <label className='odc-tcf-picker' data-bare=''>
                      <input type='color' aria-label={pickLabel} value={toPickerColor(color)} onChange={(e) => onChange(fromPickerColor(e.target.value, color, { alpha }))} />
                      <ColorSwatch color={color} />
                    </label>
                    <HexField t={t} label={t('BUILDER_THEME_CUSTOM_COLOR', 'Custom color')} value={color} alpha={alpha} onChange={onChange} />
                  </div>
                  {alpha && <OpacityInput t={t} label={pickLabel} value={color} onChange={onChange} />}
                </div>
              </PopoverPrimitive.Popup>
            </PopoverPrimitive.Positioner>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      )}
    </>
  )
}
