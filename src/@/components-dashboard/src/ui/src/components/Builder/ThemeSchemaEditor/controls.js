import React, { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import { ArrowCounterclockwise, Link45deg } from 'react-bootstrap-icons'

import { Button } from '../../../styles'
import { Confirm } from '../../Shared'
import {
  ColorPopover,
  ColorValueButton,
  FieldError,
  NumberControl,
  OpacityRow,
  ResetButton,
  RowControls,
  Segmented,
  SelectControl,
  StyleOptions,
  SwatchLabel,
  Swatch,
  SwitchTrack,
  ThemeColorGrid,
  ToggleControl,
  ValueTag
} from '../BuilderWebTheme/styles'
import { alphaOf, formatColor, fromPickerColor, parseColor, toPickerColor, withAlpha } from './colors'
import { Drawing } from './drawings'
import { ScopeControl } from './ScopeControl'
import { CROPPABLE_FORMATS, fileFormat, planImage, readImage, renderCrop } from './imageResize'
import {
  childKeys,
  editorOf,
  engineOf,
  formatText,
  getAt,
  humanize,
  isNode,
  labelOf,
  levelsOf,
  optionsOf,
  parseAlias,
  parseRole,
  resolvedAt,
  resolveValue,
  scaleOf,
  toAlias,
  typeOf
} from './schemaNodes'

// The catalog of controls. Each one gets the node's
// `path`, its `value` as the theme has it now and `onChange`; what it offers
// comes from the schema. `ctx` brings the schema, `t` and the theme.

const metaOf = (ctx, path) => editorOf(getAt(ctx.schema, path))

/** An option's text: its label (on a platform, `label_platform` when it has one), else its value read as words. */
const optionText = (ctx, option, choose) => {
  const label = (ctx.platform && option.label_platform) || option.label
  if (label) return formatText(ctx.t, label, { choose })
  return option.value === null ? '—' : humanize(option.value)
}

/** Back to the default. */
export const ResetValue = ({ label, onClick }) => (
  <ResetButton type='button' aria-label={label} title={label} onClick={onClick}>
    <ArrowCounterclockwise aria-hidden='true' />
  </ResetButton>
)

/** Values of any kind as the value of an <option>. */
const encode = (value) => JSON.stringify(value ?? null)
const decode = (text) => JSON.parse(text)

/* color */

/** The theme's colors (`tokens.color`), named, as a color can follow them. */
const themeColors = (ctx) => childKeys(ctx.schema?.tokens?.color)
  .filter(name => isNode(ctx.schema.tokens.color[name]))
  .map(name => ({ name, label: formatText(ctx.t, labelOf(ctx.schema, `tokens.color.${name}`), { fallback: name }), value: resolveValue(ctx, toAlias('color', name)) }))

/** The opacity of a color that may be translucent, 0 to 100 % in steps of 1. */
const OpacityInput = ({ t, label, value, onChange }) => {
  const percent = Math.round(alphaOf(value) * 100)
  return (
    <OpacityRow>
      <span aria-hidden='true'>{t('BUILDER_THEME_OPACITY', 'Opacity')}</span>
      <input type='range' min={0} max={100} step={1} value={percent} aria-label={t('BUILDER_THEME_OPACITY_OF', '_name_ opacity').replace('_name_', label)} aria-valuetext={`${percent} %`} onChange={(e) => onChange(withAlpha(value, Number(e.target.value) / 100))} />
      <output aria-hidden='true'>{percent} %</output>
    </OpacityRow>
  )
}

/** A color picked with the browser's picker; with `alpha`, its opacity too (the schema's `alpha`). */
export const ColorSwatchInput = ({ t, label, value, onChange, invalid, describedBy, alpha = false }) => {
  const swatch = (
    <SwatchLabel invalid={invalid}>
      <input type='color' aria-label={label} aria-invalid={invalid ? 'true' : undefined} aria-describedby={describedBy} value={toPickerColor(value)} onChange={(e) => onChange(fromPickerColor(e.target.value, value, { alpha }))} />
      <Swatch color={value} aria-hidden='true' />
      <span aria-hidden='true' style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value === 'transparent' && t ? t('BUILDER_THEME_TRANSPARENT', 'Transparent') : formatColor(value)}</span>
    </SwatchLabel>
  )
  if (!alpha) return swatch
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', minWidth: 0 }}>
      {swatch}
      <OpacityInput t={t} label={label} value={value} onChange={onChange} />
    </div>
  )
}

const POPOVER_FLIP = { modifiers: [{ name: 'flip', options: { fallbackPlacements: ['top-start'] } }] }

/**
 * A color: a token's own value (picker only), or a component's, which may
 * follow a theme color (an alias) or have its own. A role (`{ink}`) is painted
 * from the component's colors and only reads. With the schema's `alpha` it may
 * be translucent: an alias stays while its opacity does; changing the opacity
 * saves the color it shows at that opacity (the API takes no alias plus alpha).
 */
export const ColorControl = ({ ctx, path, label, value, onChange, invalid, describedBy, compact }) => {
  const { t } = ctx
  const [open, setOpen] = useState(false)
  const target = useRef(null)
  const popoverId = useId()
  const alpha = metaOf(ctx, path).alpha === true
  if (String(path).startsWith('tokens.')) return <ColorSwatchInput t={t} label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} alpha={alpha} />
  const role = parseRole(value)
  const alias = parseAlias(value)
  const linked = alias?.[0] === 'color'
  const colors = themeColors(ctx)
  const shown = linked ? resolveValue(ctx, value) : value
  const opacity = alpha && linked && alphaOf(shown) < 1 ? ` · ${Math.round(alphaOf(shown) * 100)} %` : ''
  const name = role
    ? humanize(role)
    : linked
      ? `${colors.find(color => color.name === alias[1])?.label || humanize(alias[1])}${opacity}`
      : value === 'transparent' ? t('BUILDER_THEME_TRANSPARENT', 'Transparent') : formatColor(value)
  if (role) return <span>{name}</span>
  return (
    <>
      <ColorValueButton ref={target} type='button' invalid={invalid} aria-haspopup='dialog' aria-expanded={open ? 'true' : 'false'} aria-controls={open ? popoverId : undefined} aria-label={`${label}: ${name}`} aria-describedby={describedBy} title={compact ? name : undefined} onClick={() => setOpen(prev => !prev)}>
        <Swatch color={shown} aria-hidden='true' small />
        <span aria-hidden='true'>{name}</span>
        {compact
          ? linked && <ValueTag linked aria-hidden='true' title={t('BUILDER_THEME_LINKED', 'Theme')}><Link45deg /></ValueTag>
          : (
            <ValueTag linked={linked} aria-hidden='true'>
              {linked && <Link45deg />}
              {linked ? t('BUILDER_THEME_LINKED', 'Theme') : t('BUILDER_THEME_CUSTOM', 'Custom')}
            </ValueTag>
            )}
      </ColorValueButton>
      <Overlay target={target.current} show={open} placement='bottom-start' flip popperConfig={POPOVER_FLIP} rootClose onHide={() => setOpen(false)}>
        <Popover id={popoverId} role='dialog' aria-label={label} style={{ maxWidth: 'calc(100vw - 32px)' }}>
          <ColorPopover>
            <h4>{t('BUILDER_THEME_THEME_COLORS', 'Theme colors')}</h4>
            <ThemeColorGrid>
              {colors.map(color => (
                <button key={color.name} type='button' aria-pressed={linked && alias[1] === color.name ? 'true' : 'false'} aria-label={color.label} title={color.label} style={{ background: color.value }} onClick={() => { onChange(toAlias('color', color.name)); setOpen(false) }} />
              ))}
            </ThemeColorGrid>
            <h4>{t('BUILDER_THEME_CUSTOM_COLOR', 'Custom color')}</h4>
            <ColorSwatchInput t={t} label={t('BUILDER_THEME_PICK_COLOR', 'Pick a color')} value={shown} onChange={onChange} alpha={alpha} />
          </ColorPopover>
        </Popover>
      </Overlay>
    </>
  )
}

/**
 * A value the schema doesn't declare but the API works out (a button
 * color's tone the matrix computes): to read, not to change.
 */
export const ComputedValue = ({ t, label, value }) => {
  const color = typeof value === 'string' && parseColor(value) ? formatColor(value) : null
  const text = t('BUILDER_THEME_OPTION_AUTO', 'Automatic')
  return (
    <span role='img' aria-label={`${label}: ${text}${color ? ` (${color})` : ''}`} title={color || undefined} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, padding: '0 10px', fontSize: 13, color: '#5E6B7D' }}>
      {color && <Swatch color={value} aria-hidden='true' small />}
      <span aria-hidden='true' style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</span>
    </span>
  )
}

/* range */

/** A % of a value kept from 0 to 1: the field shows it ×100. */
const isFraction = (meta) => meta.unit === '%' && typeof meta.max === 'number' && meta.max <= 1

/** A ratio (`x`: a line height to its size) reads with two decimals and ×: 1.50×. */
const isRatio = (unit) => unit === 'x'
// What the API keeps of a typography style (ThemeFormat::isTypography)
const TYPOGRAPHY_FIELDS = ['size', 'line', 'weight', 'letter_spacing', 'transform']
const unitText = (unit) => (isRatio(unit) ? '×' : unit)

const rangeMessage = (t, unit) => {
  if (isRatio(unit)) return t('BUILDER_THEME_RATIO_RANGE', 'Use _min_× to _max_×.')
  if (unit === '%') return t('BUILDER_THEME_PERCENT_RANGE', 'Use _min_ to _max_ %.')
  if (unit === 'ms') return t('BUILDER_THEME_MS_RANGE', 'Use _min_ to _max_ ms.')
  if (unit === 'px') return t('BUILDER_THEME_HEIGHT_RANGE', 'Use _min_ to _max_ px.')
  return t('BUILDER_THEME_NUMBER_RANGE', 'Use _min_ to _max_.')
}

/**
 * A number in `min` to `max`, in `step`s, with its unit. What is typed
 * outside them shows the range and is not saved. A % of a 0–1 value shows ×100.
 */
export const NumberField = ({ t, label, value, min, max, step = 1, unit, onChange, invalid, describedBy, scale = 1 }) => {
  const shown = (number) => {
    if (number === null || number === undefined || number === '') return ''
    const rounded = Math.round(Number(number) * scale * 100) / 100
    return isRatio(unit) && Number.isFinite(rounded) ? rounded.toFixed(2) : rounded
  }
  const [draft, setDraft] = useState(shown(value))
  // What is being typed stays as typed while it is the value (1.5 isn't rewritten as 1.50 under the cursor)
  useEffect(() => { setDraft(prev => (prev !== '' && shown(value) !== '' && Number(prev) === Number(shown(value)) ? prev : shown(value))) }, [value])
  const number = Number(draft)
  const decimals = String(step).split('.')[1]?.length || 0
  const fitsStep = decimals > 0 || step * scale !== 1 || Number.isInteger(number)
  const outside = draft === '' || !Number.isFinite(number) || !fitsStep ||
    (typeof min === 'number' && number < min * scale) || (typeof max === 'number' && number > max * scale)
  const errorId = useId()
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, maxWidth: 160 }}>
      <span style={{ position: 'relative', display: 'block' }}>
        <NumberControl
          type='number'
          min={typeof min === 'number' ? min * scale : undefined}
          max={typeof max === 'number' ? max * scale : undefined}
          step={scale === 1 ? step : 'any'}
          aria-label={label}
          aria-invalid={outside || invalid ? 'true' : undefined}
          aria-describedby={[outside ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
          invalid={outside || invalid}
          value={draft}
          style={unit ? { paddingRight: 34 } : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            const next = Number(e.target.value)
            const inRange = (typeof min !== 'number' || next >= min * scale) && (typeof max !== 'number' || next <= max * scale)
            if (e.target.value !== '' && Number.isFinite(next) && inRange) onChange(Math.round((next / scale) * 10000) / 10000)
          }}
          onBlur={() => setDraft(shown(value))}
        />
        {unit && <span aria-hidden='true' style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#5E6B7D', pointerEvents: 'none' }}>{unitText(unit)}</span>}
      </span>
      {outside && typeof min === 'number' && typeof max === 'number' && (
        <FieldError id={errorId} role='alert' style={{ gridColumn: 'auto' }}>
          {rangeMessage(t, unit).replace('_min_', isRatio(unit) ? min.toFixed(2) : min * scale).replace('_max_', isRatio(unit) ? max.toFixed(2) : max * scale)}
        </FieldError>
      )}
    </span>
  )
}

/**
 * A node's `min` and `max`, narrowed to its neighbours' values in a card that
 * keeps them in order (`ctx.bounds`, GroupCard). Neighbours already out of
 * order narrow nothing.
 */
export const limitsOf = (ctx, path, { min, max }) => {
  const bounds = ctx.bounds?.[String(path)]
  const low = typeof bounds?.min === 'number' && (typeof min !== 'number' || bounds.min > min) ? bounds.min : min
  const high = typeof bounds?.max === 'number' && (typeof max !== 'number' || bounds.max < max) ? bounds.max : max
  return typeof low === 'number' && typeof high === 'number' && low > high ? { min, max } : { min: low, max: high }
}

export const RangeControl = ({ ctx, path, label, value, onChange, invalid, describedBy }) => {
  const meta = metaOf(ctx, path)
  const { min, max } = limitsOf(ctx, path, meta)
  return <NumberField t={ctx.t} label={label} value={value} min={min} max={max} step={meta.step ?? 1} unit={meta.unit} scale={isFraction(meta) ? 100 : 1} onChange={onChange} invalid={invalid} describedBy={describedBy} />
}

/* level */

/** A level's amount as the editor shows it next to its name: px, ms, %. */
const amountOf = (scale, amount) => {
  if (typeof amount !== 'number') return null
  if (scale === 'opacity') return `${Math.round(amount * 100)}%`
  if (scale === 'motion') return `${amount} ms`
  if (scale === 'typography') return null
  return String(amount)
}

/**
 * A level of a scale (`{size.md}`), named with its amount, or Custom: a
 * number in the node's `min` to `max`, for the types that take one. With
 * `labels.unset`, the default the API works out (a pill tab's rounding) is an
 * option of its own.
 */
export const LevelControl = ({ ctx, path, label, value, own, fallback, onChange, invalid, describedBy }) => {
  const { t, schema } = ctx
  const meta = metaOf(ctx, path)
  const scale = scaleOf(schema, path)
  const type = typeOf(schema, path)
  const alias = parseAlias(value)
  const takesNumber = ['dimension', 'duration', 'opacity'].includes(type) && scale !== 'radius' && typeof meta.min === 'number'
  // A text style of its own (`custom`): the scale's fields, starting as the level it had
  const takesStyle = type === 'typography' && meta.custom === true
  if (takesStyle) return <TextStyleLevelControl ctx={ctx} path={path} label={label} value={value} fallback={fallback} onChange={onChange} invalid={invalid} describedBy={describedBy} />
  const custom = value !== null && value !== undefined && !alias
  const levels = optionsOf(schema, path)
  // A level the node doesn't offer still shows while the theme has it
  const shown = alias && !levels.some(level => level.value === value) ? [...levels, { value, label: null }] : levels
  const unset = meta.labels?.unset && !own
  const amount = (level) => amountOf(scale, resolveValue(ctx, level.value))
  const selected = unset ? 'unset' : custom ? 'custom' : encode(value)
  return (
    <span style={{ display: 'flex', gap: 6, minWidth: 0 }}>
      <SelectControl
        aria-label={label}
        invalid={invalid && !custom}
        aria-describedby={describedBy}
        value={selected}
        style={{ flex: 1, minWidth: 0 }}
        onChange={(e) => {
          if (e.target.value === 'unset') return onChange(null)
          if (e.target.value !== 'custom') return onChange(decode(e.target.value))
          const from = Number(resolveValue(ctx, value ?? fallback))
          const start = Number.isFinite(from) ? from : meta.min
          onChange(Math.min(Math.max(start, meta.min), meta.max ?? start))
        }}
      >
        {unset && <option value='unset'>{formatText(t, meta.labels.unset, { values: { _px_: resolveValue(ctx, fallback) ?? 0 } })}</option>}
        {/* A text style of its own the node no longer offers (`custom` off) has no value to name */}
        {custom && !takesNumber && <option value='custom'>{typeof value === 'object' ? t('BUILDER_THEME_CUSTOM', 'Custom') : t('BUILDER_THEME_CUSTOM_NUMBER', 'Custom (_value_)').replace('_value_', value)}</option>}
        {shown.map(level => {
          const name = level.label ? formatText(t, level.label) : humanize(parseAlias(level.value)?.[1] ?? level.value)
          const extra = amount(level)
          return <option key={encode(level.value)} value={encode(level.value)}>{extra ? `${name} · ${extra}` : name}</option>
        })}
        {takesNumber && <option value='custom'>{t('BUILDER_THEME_CUSTOM', 'Custom')}</option>}
      </SelectControl>
      {custom && takesNumber && (
        <span style={{ width: meta.unit === 'ms' ? 100 : 90, flex: 'none' }}>
          <NumberField t={t} label={t('BUILDER_THEME_CUSTOM_OF', '_name_: custom').replace('_name_', label)} value={value} min={meta.min} max={meta.max} step={meta.step ?? (type === 'opacity' ? 0.01 : 1)} unit={meta.unit} scale={type === 'opacity' ? 100 : 1} invalid={invalid} onChange={onChange} />
        </span>
      )}
    </span>
  )
}

/* select, segmented, cards, toggle */

/** The option for no value (`labels.unset`): not a JSON value, so it never meets an option's. */
const UNSET = 'unset'

/**
 * Its options; with `labels.unset` one more for no value ("Same as
 * pressed"), which sends null and takes the value out.
 */
export const SelectOptionControl = ({ ctx, path, label, value, onChange, invalid, describedBy, choose }) => {
  const options = optionsOf(ctx.schema, path)
  const unsetLabel = metaOf(ctx, path).labels?.unset
  const unset = !!unsetLabel && (value === null || value === undefined)
  const known = unset || options.some(option => encode(option.value) === encode(value))
  return (
    <SelectControl aria-label={label} invalid={invalid} aria-describedby={describedBy} value={unset ? UNSET : encode(value)} onChange={(e) => onChange(e.target.value === UNSET ? null : decode(e.target.value))}>
      {unsetLabel && <option value={UNSET}>{formatText(ctx.t, unsetLabel)}</option>}
      {!known && <option value={encode(value)}>{value === null || value === undefined ? '—' : humanize(value)}</option>}
      {options.map(option => <option key={encode(option.value)} value={encode(option.value)}>{optionText(ctx, option, choose)}</option>)}
    </SelectControl>
  )
}

/** The options, and the theme's value as one more while the node no longer offers it, so it shows chosen. */
const withValue = (options, value) => (value === null || value === undefined || options.some(option => encode(option.value) === encode(value))
  ? options
  : [...options, { value }])

export const SegmentedControl = ({ ctx, path, label, value, onChange, choose }) => {
  const name = useId()
  return (
    <Segmented role='radiogroup' aria-label={label}>
      {withValue(optionsOf(ctx.schema, path), value).map(option => (
        <label key={encode(option.value)}>
          <input type='radio' name={name} value={encode(option.value)} checked={encode(value) === encode(option.value)} onChange={() => onChange(option.value)} />
          <Drawing name={option.drawing} />
          {optionText(ctx, option, choose)}
        </label>
      ))}
    </Segmented>
  )
}

/** Options as cards, each with its drawing and what it's for. */
export const CardsControl = ({ ctx, path, label, value, onChange }) => {
  const name = useId()
  if (typeOf(ctx.schema, path) === 'slot') return <SlotControl ctx={ctx} path={path} label={label} value={value} onChange={onChange} />
  return (
    <StyleOptions role='radiogroup' aria-label={label} style={{ padding: 0 }}>
      {withValue(optionsOf(ctx.schema, path), value).map((option, index) => (
        <label key={encode(option.value)}>
          <strong>
            <input type='radio' name={name} value={encode(option.value)} aria-label={optionText(ctx, option)} aria-describedby={option.info ? `${name}-${index}` : undefined} checked={encode(value) === encode(option.value)} onChange={() => onChange(option.value)} />
            {optionText(ctx, option)}
          </strong>
          <Drawing name={option.drawing} />
          {option.info && <small id={`${name}-${index}`}>{formatText(ctx.t, option.info)}</small>}
        </label>
      ))}
    </StyleOptions>
  )
}

/**
 * A piece of a group (`slot`): always the same component, with a select per
 * choice it has (`fields`: size, style, color, shape). It is written whole.
 */
export const SlotControl = ({ ctx, path, label, value, onChange }) => {
  const fields = metaOf(ctx, path).fields || {}
  const piece = value || {}
  const axes = Object.keys(fields).filter(axis => axis in piece)
  return (
    <RowControls columns={`repeat(${Math.max(axes.length, 1)}, minmax(0, 1fr))`}>
      {axes.map(axis => {
        const field = fields[axis]
        const fieldLabel = `${label}: ${formatText(ctx.t, field.label, { fallback: axis })}`
        return (
          <SelectControl key={axis} aria-label={fieldLabel} value={encode(piece[axis])} onChange={(e) => onChange({ ...piece, [axis]: decode(e.target.value) })}>
            {!(field.options || []).some(option => encode(option.value) === encode(piece[axis])) && <option value={encode(piece[axis])}>{piece[axis] === null ? '—' : humanize(piece[axis])}</option>}
            {(field.options || []).map(option => <option key={encode(option.value)} value={encode(option.value)}>{optionText(ctx, option)}</option>)}
          </SelectControl>
        )
      })}
    </RowControls>
  )
}

export const Toggle = ({ label, checked, onChange, disabled }) => (
  <ToggleControl>
    <input type='checkbox' role='switch' aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <SwitchTrack checked={checked} aria-hidden='true' />
  </ToggleControl>
)

export const ToggleNodeControl = ({ label, value, onChange }) => <Toggle label={label} checked={value !== false && value !== null && value !== undefined} onChange={onChange} />

/* border, shadow */

const BORDER_STYLES = ['solid', 'dashed', 'dotted']
const isNoBorder = (value) => value === null || value === undefined || value === 'none' || value?.width === 0

/**
 * Width, style and color of a border. "No border" saves `none` (the API
 * serves it as null). With `labels.unset` (a state's border) null is that
 * option, and a width starts solid in the focus color. A border painted in a
 * role (an appearance's `{ink}`, in the value or its default) keeps it: width
 * and style only.
 */
export const BorderControl = ({ ctx, path, label, value, fallback, onChange, invalid }) => {
  const { t, schema } = ctx
  const meta = metaOf(ctx, path)
  const unsetLabel = meta.labels?.unset
  const unset = !!unsetLabel && (value === null || value === undefined)
  const none = isNoBorder(value)
  const roleColor = [value?.color, fallback?.color].find(parseRole) || null
  const widthAlias = parseAlias(value?.width)
  const widthValue = unset ? 'unset' : none ? 'none' : widthAlias ? value.width : 'custom'
  const color = roleColor || value?.color || '{color.border}'
  const widths = levelsOf(schema, 'border')
  const changeWidth = (next) => {
    if (next === 'custom') return
    if (next === 'unset') return onChange(null)
    if (unset) return onChange({ width: next, color: '{color.focus}', style: 'solid' })
    if (next === 'none') return onChange('none')
    onChange({ width: next, color: none ? (roleColor || fallback?.color || '{color.border}') : color, style: value?.style || 'solid' })
  }
  const styleLabel = (style) => ({ solid: t('BUILDER_THEME_BORDER_SOLID', 'Solid'), dashed: t('BUILDER_THEME_BORDER_DASHED', 'Dashed'), dotted: t('BUILDER_THEME_BORDER_DOTTED', 'Dotted') }[style])
  return (
    <RowControls columns={(roleColor || none) && !unset ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))'}>
      <SelectControl aria-label={t('BUILDER_THEME_BORDER_WIDTH_OF', '_name_ width').replace('_name_', label)} invalid={invalid} value={widthValue} onChange={(e) => changeWidth(e.target.value)}>
        {unsetLabel
          ? <option value='unset'>{formatText(t, unsetLabel)}</option>
          : <option value='none'>{meta.labels?.none ? formatText(t, meta.labels.none) : t('BUILDER_THEME_NO_BORDER', 'No border')}</option>}
        {widthValue === 'custom' && <option value='custom'>{typeof value.width === 'number' ? `${value.width} px` : t('BUILDER_THEME_CUSTOM_NUMBER', 'Custom (_value_)').replace('_value_', value.width)}</option>}
        {widths.map(level => <option key={level.value} value={level.value}>{formatText(t, level.label, { fallback: level.name })}</option>)}
      </SelectControl>
      <SelectControl aria-label={t('BUILDER_THEME_BORDER_STYLE_OF', '_name_ style').replace('_name_', label)} disabled={none} value={none ? '' : value?.style || 'solid'} onChange={(e) => onChange({ ...value, style: e.target.value })}>
        {none && <option value=''>—</option>}
        {BORDER_STYLES.map(style => <option key={style} value={style}>{styleLabel(style)}</option>)}
      </SelectControl>
      {unset && (
        <SelectControl aria-label={t('BUILDER_THEME_BORDER_COLOR_OF', '_name_ color').replace('_name_', label)} disabled value=''>
          <option value=''>—</option>
        </SelectControl>
      )}
      {!roleColor && !none && (
        <ColorControl ctx={ctx} path={`${path}.color`} label={t('BUILDER_THEME_BORDER_COLOR_OF', '_name_ color').replace('_name_', label)} value={color} compact onChange={(next) => onChange({ ...value, color: next })} />
      )}
    </RowControls>
  )
}

/**
 * The size of a shadow, by level. Not set, it shows the default it gets; a
 * shadow of its own shows as Custom until a level is chosen. With
 * `labels.unset` no value has that name ("Same as resting", not the level
 * none) and can be chosen again: it sends null.
 */
export const ShadowControl = ({ ctx, path, label, value, onChange, invalid }) => {
  const { t, schema } = ctx
  const levels = levelsOf(schema, scaleOf(schema, path) || 'shadow')
  const unsetLabel = metaOf(ctx, path).labels?.unset
  const unset = value === null || value === undefined
  const alias = parseAlias(value)
  const selected = unset ? 'unset' : alias ? value : 'custom'
  const none = levels.find(level => level.name === 'none')
  const change = (next) => {
    if (next === 'unset') return unsetLabel && !unset && onChange(null)
    if (next !== 'custom') onChange(next)
  }
  return (
    <SelectControl aria-label={label} invalid={invalid} value={selected} onChange={(e) => change(e.target.value)}>
      {(unset || unsetLabel) && (
        <option value='unset'>
          {unsetLabel ? formatText(t, unsetLabel) : t('BUILDER_THEME_DEFAULT_VALUE', 'Default (_value_)').replace('_value_', formatText(t, none?.label, { fallback: 'none' }))}
        </option>
      )}
      {selected === 'custom' && <option value='custom'>{t('BUILDER_THEME_CUSTOM_SHADOW', 'Custom')}</option>}
      {levels.map(level => <option key={level.value} value={level.value}>{formatText(t, level.label, { fallback: level.name })}</option>)}
    </SelectControl>
  )
}

/* typography, font */

/** The heading font's levels by name, where their group doesn't say (display to h4). */
const HEADING_LEVEL = /^(display|h[1-6])$/

/**
 * The font a text style is shown in, `heading` or `body`: a level's
 * (`tokens.typography.<level>`) by its group, Headings or not; a component's
 * style of its own, its container's: the component's `base.font_role` when it
 * has one, else the text font.
 */
export const fontRoleOf = (ctx, path) => {
  const keys = String(path).split('.')
  if (keys[0] === 'tokens' && keys[1] === 'typography') {
    return editorOf(getAt(ctx.schema, keys.slice(0, 3))).group === 'headings' || HEADING_LEVEL.test(keys[2]) ? 'heading' : 'body'
  }
  const rolePath = `components.${keys[1]}.base.font_role`
  return keys[0] === 'components' && isNode(getAt(ctx.schema, rolePath)) && resolvedAt(ctx, rolePath) === 'heading' ? 'heading' : 'body'
}

/** The weights the font of a text style has (the font control's `options[].weights`), or null when it doesn't say. */
export const weightsOf = (ctx, path) => {
  const fontPath = `tokens.font.${fontRoleOf(ctx, path)}`
  const font = resolvedAt(ctx, fontPath)
  const option = (metaOf(ctx, fontPath).options || []).find(item => item?.value === font)
  return Array.isArray(option?.weights) ? option.weights : null
}

/**
 * A typography style, written whole: its `fields` (size, line height, weight,
 * letter spacing, capitals), the node's or the ones given. Its weights are
 * those its font has; its size stays between its neighbours' in a card that
 * keeps them in order.
 */
export const TypographyControl = ({ ctx, path, label, value, onChange, invalid, fields: givenFields, defaults: givenDefaults }) => {
  const { t } = ctx
  const fields = givenFields || metaOf(ctx, path).fields || {}
  const node = givenDefaults || getAt(ctx.schema, path)?.$value
  const defaults = node && typeof node === 'object' ? node : {}
  // Only what a style is made of: a resolved one also names its family
  const ownOf = (style) => Object.fromEntries(Object.entries(style).filter(([key]) => TYPOGRAPHY_FIELDS.includes(key)))
  const style = ownOf(value && typeof value === 'object' ? value : {})
  // Written whole: what a style leaves out comes from its default
  const change = (field, next) => onChange(ownOf({ ...defaults, ...style, [field]: next }))
  const fieldLabel = (field) => `${label}: ${formatText(t, fields[field]?.label, { fallback: field })}`
  const number = (field) => {
    if (!fields[field]) return null
    const { min, max } = field === 'size' ? limitsOf(ctx, path, fields[field]) : fields[field]
    return <NumberField key={field} t={t} label={fieldLabel(field)} value={style[field] ?? ''} min={min} max={max} step={fields[field].step ?? 1} unit={fields[field].unit} invalid={invalid} onChange={(next) => change(field, next)} />
  }
  const extras = ['letter_spacing', 'transform'].some(key => key in style || key in defaults)
  const weights = weightsOf(ctx, path)
  const weight = style.weight ?? 400
  // The font's weights; one it doesn't have still shows while the style has it
  const weightOptions = (fields.weight?.options || []).filter(option => !weights || weights.includes(option.value) || option.value === weight)
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
      {number('size')}
      {number('line')}
      {isRatio(fields.line?.unit) && typeof style.size === 'number' && typeof style.line === 'number' && (
        <small aria-label={t('BUILDER_THEME_LINE_HEIGHT_PX', '_px_ px between lines').replace('_px_', Math.round(style.size * style.line))} style={{ alignSelf: 'center', fontSize: 12, color: '#5E6B7D' }}>
          {`= ${Math.round(style.size * style.line)} px`}
        </small>
      )}
      {fields.weight && (
        <SelectControl aria-label={fieldLabel('weight')} value={weight} style={{ maxWidth: 180 }} onChange={(e) => change('weight', Number(e.target.value))}>
          {weightOptions.map(option => <option key={option.value} value={option.value}>{`${optionText(ctx, option)} ${option.value}`}</option>)}
        </SelectControl>
      )}
      {extras && number('letter_spacing')}
      {extras && fields.transform && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle label={fieldLabel('transform')} checked={style.transform === 'uppercase'} onChange={(next) => change('transform', next ? 'uppercase' : 'none')} />
          <span aria-hidden='true'>{formatText(t, fields.transform.label, { fallback: 'transform' })}</span>
        </span>
      )}
    </span>
  )
}

/** Takes out what a style of a component keeps of no level: its family. */
const withoutFamily = (style) => {
  if (!style || typeof style !== 'object') return {}
  const { family, ...rest } = style
  return rest
}

/**
 * A component's text style (`custom`): a level of the type scale, or Custom,
 * a style of its own with the scale's fields (`tokens.typography`'s, the
 * widest limits), starting as the level it had. It saves without a family.
 */
export const TextStyleLevelControl = ({ ctx, path, label, value, fallback, onChange, invalid, describedBy }) => {
  const { t, schema } = ctx
  const levels = optionsOf(schema, path)
  const alias = parseAlias(value)
  const custom = value !== null && value !== undefined && typeof value === 'object'
  const shown = alias && !levels.some(level => level.value === value) ? [...levels, { value, label: null }] : levels
  const fields = editorOf(schema?.tokens?.typography).fields || {}
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <SelectControl
        aria-label={label}
        invalid={invalid && !custom}
        aria-describedby={describedBy}
        value={custom ? 'custom' : encode(value)}
        onChange={(e) => {
          if (e.target.value !== 'custom') return onChange(decode(e.target.value))
          onChange(withoutFamily(resolveValue(ctx, value ?? fallback)))
        }}
      >
        {shown.map(level => <option key={encode(level.value)} value={encode(level.value)}>{level.label ? formatText(t, level.label) : humanize(parseAlias(level.value)?.[1] ?? level.value)}</option>)}
        <option value='custom'>{t('BUILDER_THEME_CUSTOM', 'Custom')}</option>
      </SelectControl>
      {custom && <TypographyControl ctx={ctx} path={path} label={label} value={value} fields={fields} defaults={withoutFamily(resolveValue(ctx, fallback))} invalid={invalid} onChange={(next) => onChange(withoutFamily(next))} />}
    </span>
  )
}

/** A font's family as people read it: `open_sans` is Open Sans. */
export const fontFamily = (id) => String(id || '').split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')

/** A font of the catalog, named by its family (`format.fonts`, else its id read as one). */
export const FontControl = ({ ctx, path, label, value, onChange, invalid }) => {
  const fonts = engineOf(getAt(ctx.schema, path)).options || []
  const family = (id) => ctx.format?.fonts?.[id] || fontFamily(id)
  // A font the catalog no longer has still shows while the theme has it
  const shown = value && !fonts.includes(value) ? [...fonts, value] : fonts
  return (
    <SelectControl aria-label={label} invalid={invalid} value={value || ''} style={{ fontFamily: value ? `'${family(value)}', sans-serif` : undefined }} onChange={(e) => onChange(e.target.value)}>
      {shown.map(font => <option key={font} value={font}>{family(font)}</option>)}
    </SelectControl>
  )
}

/* image */

const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || '').trim())

// cropperjs loads only when an image needs cropping
const ImageCropDialog = lazy(() => import('./ImageCropDialog'))

/**
 * An image: a file uploaded to the theme (`ctx.uploadImage`) or a link. Its
 * formats come from the schema; the server checks the rest.
 */
/** How a format reads: its usual capitals. */
const FORMAT_NAMES = { webp: 'WebP' }

/**
 * What an image takes, as one line: its formats, and its `hints` (size,
 * proportion, weight, transparency), leaving out what it doesn't say.
 */
export const imageHints = (t, formats, hints = {}) => {
  const [width, height] = Array.isArray(hints?.size) ? hints.size : []
  return [
    formats.map(format => FORMAT_NAMES[format] || String(format).toUpperCase()).join(', '),
    width && height ? `${width} × ${height} px${hints.ratio ? ` (${hints.ratio})` : ''}` : hints?.ratio && t('BUILDER_THEME_IMAGE_RATIO', 'Proportion _ratio_').replace('_ratio_', hints.ratio),
    hints?.max_kb && t('BUILDER_THEME_IMAGE_MAX_KB', 'Up to _size_').replace('_size_', `${hints.max_kb} KB`),
    hints?.alpha && t('BUILDER_THEME_IMAGE_ALPHA', 'Transparent background'),
    hints?.safe && t('BUILDER_THEME_IMAGE_SAFE', 'Keep what matters in the middle _ratio_: the edges may be cut').replace('_ratio_', hints.safe)
  ].filter(Boolean).join(' · ')
}

export const ImageControl = ({ ctx, path, label, value, onChange }) => {
  const { t } = ctx
  const key = String(path).replace(/^images\./, '')
  const engine = engineOf(getAt(ctx.schema, path))
  // The image's own formats, else the ones every image takes (the schema's `format`)
  const formats = engine.formats || ctx.format?.images?.default_formats || ['jpg', 'png', 'webp', 'avif']
  const hintsId = useId()
  const fileInput = useRef(null)
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  // The picked image while the crop dialog is open: `{ file, url, image, width, height, plan }`
  const [crop, setCrop] = useState(null)
  // A picked image under the recommended size, waiting for "Upload anyway": `{ file, width, height }`
  const [small, setSmall] = useState(null)
  const uploadButton = useRef(null)
  const refocus = useRef(false)
  const limits = ctx.format?.images
  const uploading = ctx.editorAction === `upload:${key}`
  // Back on the upload button once the dialog is closed and the button is enabled again
  useEffect(() => {
    if (!refocus.current || crop || small || uploading) return
    refocus.current = false
    uploadButton.current?.focus()
  }, [crop, small, uploading])
  const upload = async (file) => {
    if (!file || !ctx.uploadImage) return
    setError(null)
    const result = await ctx.uploadImage(key, file)
    if (!result.ok) setError(t('BUILDER_THEME_IMAGE_UPLOAD_ERROR', 'We couldn’t upload the image. Try again.'))
  }
  /**
   * A picked file: an image off its proportion, bigger than the recommended
   * size or over the API's limits opens the crop dialog; one under the
   * recommended size asks first (it may look blurry); any other one (and
   * SVG, ICO, GIF, or one the browser can't read: the API says what's wrong)
   * is uploaded as it is.
   */
  const choose = async (file) => {
    if (!file || !ctx.uploadImage) return
    setError(null)
    if (!CROPPABLE_FORMATS.includes(fileFormat(file))) return upload(file)
    let read
    try {
      read = await readImage(file)
    } catch {
      return upload(file)
    }
    const plan = planImage({ width: read.width, height: read.height, bytes: file.size, hints: engine.hints, limits })
    if (!plan.needsDialog) {
      URL.revokeObjectURL(read.url)
      if (plan.small) return setSmall({ file, width: read.width, height: read.height, recommended: plan.recommended })
      return upload(file)
    }
    setCrop({ file, ...read, plan })
  }
  const closeCrop = () => {
    if (!crop) return
    URL.revokeObjectURL(crop.url)
    refocus.current = true
    setCrop(null)
  }
  const uploadCrop = async (rect) => {
    const picked = crop
    let file
    try {
      file = await renderCrop({ file: picked.file, image: picked.image, rect, hints: engine.hints, limits, formats })
    } catch {
      file = null
    }
    closeCrop()
    if (!file) return setError(t('BUILDER_THEME_CROP_ERROR', 'We couldn’t crop the image. Upload it as is or try another one.'))
    return upload(file)
  }
  const uploadAsIs = () => {
    const picked = crop.file
    closeCrop()
    upload(picked)
  }
  const closeSmall = (accept) => {
    const picked = small?.file
    refocus.current = true
    setSmall(null)
    if (accept && picked) upload(picked)
  }
  const applyLink = () => {
    if (!isHttpUrl(link)) return setError(t('BUILDER_THEME_IMAGE_LINK_INVALID', 'Enter a link that starts with https://'))
    onChange(link.trim())
    setLink(null)
    setError(null)
  }
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {value && <img src={value} alt='' style={{ width: 64, height: 40, objectFit: 'contain', borderRadius: 6, background: '#F1F3F5' }} />}
        <input ref={fileInput} type='file' hidden accept={formats.map(format => `.${format}`).join(',')} aria-label={`${t('BUILDER_THEME_IMAGE_FILE', 'Image file')}: ${label}`} aria-describedby={hintsId} onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />
        <Button ref={uploadButton} type='button' color='primary' outline borderRadius='8px' disabled={uploading} aria-describedby={hintsId} onClick={() => fileInput.current?.click()}>
          {uploading ? t('BUILDER_THEME_UPLOADING', 'Uploading…') : value ? t('BUILDER_THEME_IMAGE_REPLACE', 'Replace') : t('BUILDER_THEME_IMAGE_UPLOAD', 'Upload')}
        </Button>
        {link === null && <Button type='button' color='secundary' borderRadius='8px' onClick={() => setLink('')}>{t('BUILDER_THEME_IMAGE_USE_LINK', 'Use a link')}</Button>}
      </span>
      {link !== null && (
        <span style={{ display: 'flex', gap: 8 }}>
          <NumberControl type='url' value={link} placeholder='https://' aria-label={`${t('BUILDER_THEME_IMAGE_LINK', 'Image link')}: ${label}`} onChange={(e) => { setLink(e.target.value); setError(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }} />
          <Button type='button' color='primary' borderRadius='8px' onClick={applyLink}>{t('BUILDER_THEME_IMAGE_USE', 'Use')}</Button>
        </span>
      )}
      <small id={hintsId} style={{ fontSize: 12, color: '#5E6B7D' }}>{imageHints(t, formats, engine.hints)}</small>
      {error && <FieldError role='alert' style={{ gridColumn: 'auto' }}>{error}</FieldError>}
      {small && (
        <Confirm
          open
          width='min(440px, calc(100vw - 72px))'
          title={t('BUILDER_THEME_IMAGE_SMALL_TITLE', 'This image is smaller than recommended')}
          acceptText={t('BUILDER_THEME_CROP_AS_IS_CONFIRM', 'Upload anyway')}
          cancelText={t('CANCEL', 'Cancel')}
          onAccept={() => closeSmall(true)}
          onCancel={() => closeSmall(false)}
          onClose={() => closeSmall(false)}
        >
          <p>
            {t('BUILDER_THEME_IMAGE_SMALL_TEXT', 'Yours is _yours_ and the recommended size is _size_, so it may look blurry on large screens.')
              .replace('_yours_', `${small.width} × ${small.height} px`)
              .replace('_size_', `${small.recommended.width} × ${small.recommended.height} px`)}
          </p>
        </Confirm>
      )}
      {crop && (
        <Suspense fallback={null}>
          <ImageCropDialog
            t={t}
            label={label}
            url={crop.url}
            width={crop.width}
            height={crop.height}
            plan={crop.plan}
            hints={engine.hints}
            limits={limits}
            onCrop={uploadCrop}
            onUploadAsIs={uploadAsIs}
            onCancel={closeCrop}
          />
        </Suspense>
      )}
    </span>
  )
}

/* text, html */

const patternOf = (source) => {
  try {
    return source ? new RegExp(source) : null
  } catch {
    return null
  }
}

/**
 * A text: up to its `max_length`, and with its `pattern` (the engine's), with
 * the editor's `placeholder` and `multiline`. Empty, it is unset (null); a text
 * off its pattern says so and isn't saved.
 */
export const TextControl = ({ ctx, path, label, value, onChange, invalid, describedBy }) => {
  const meta = ctx && path ? metaOf(ctx, path) : {}
  const engine = ctx && path ? engineOf(getAt(ctx.schema, path)) : {}
  const pattern = patternOf(engine.pattern)
  const maxLength = typeof engine.max_length === 'number' ? engine.max_length : undefined
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])
  const errorId = useId()
  const wrong = draft !== '' && !!pattern && !pattern.test(draft)
  const placeholder = meta.placeholder ? formatText(ctx.t, meta.placeholder) : undefined
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <NumberControl
        as={meta.multiline ? 'textarea' : undefined}
        rows={meta.multiline ? 3 : undefined}
        type={meta.multiline ? undefined : 'text'}
        aria-label={label}
        aria-invalid={wrong || invalid ? 'true' : undefined}
        aria-describedby={[wrong ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined}
        invalid={wrong || invalid}
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        style={meta.multiline ? { height: 'auto' } : undefined}
        onChange={(e) => {
          const text = e.target.value
          setDraft(text)
          if (text === '') return onChange(null)
          if (!pattern || pattern.test(text)) onChange(text)
        }}
        onBlur={() => wrong && setDraft(value ?? '')}
      />
      {maxLength !== undefined && <small aria-hidden='true' style={{ alignSelf: 'flex-end', fontSize: 12, color: '#5E6B7D' }}>{`${draft.length}/${maxLength}`}</small>}
      {wrong && <FieldError id={errorId} role='alert' style={{ gridColumn: 'auto' }}>{ctx.t('BUILDER_THEME_TEXT_PATTERN', 'This doesn’t look right, so it isn’t saved. Check it against the example.')}</FieldError>}
    </span>
  )
}

const RichHtmlEditor = lazy(() => import('../../Shared/RichHtmlEditor'))

export const HtmlControl = ({ label, value, onChange, invalid, describedBy }) => (
  <Suspense fallback={null}>
    <RichHtmlEditor label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />
  </Suspense>
)

/** Every control of the catalog by its name; `sortable_sections` and `matrix` lay out more than one value (SchemaGroup). */
export const CONTROLS = {
  color: ColorControl,
  level: LevelControl,
  range: RangeControl,
  select: SelectOptionControl,
  segmented: SegmentedControl,
  toggle: ToggleNodeControl,
  border: BorderControl,
  shadow: ShadowControl,
  typography: TypographyControl,
  font: FontControl,
  image: ImageControl,
  text: TextControl,
  html: HtmlControl,
  cards: CardsControl,
  scope: ScopeControl
}
