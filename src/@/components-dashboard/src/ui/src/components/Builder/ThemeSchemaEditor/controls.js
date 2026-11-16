import React, { Suspense, lazy, useEffect, useId, useRef, useState } from 'react'

import { RotateCcw } from '../../Shared/Icon'
import { Button, ConfirmDialog, IconButton, RadioGroup, Select, Switch, TextArea, TextField, cx } from '../../Shared/Product'
import { alphaOf, formatColor, parseColor } from './colors'
import { Drawing } from './drawings'
import { ScopeControl } from './ScopeControl'
import { ColorSwatch, ColorSwatchInput, ThemeColorField } from './ThemeColorField'
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
import './theme-controls.css'

// The catalog of controls. Each one gets the node's
// `path`, its `value` as the theme has it now and `onChange`; what it offers
// comes from the schema. `ctx` brings the schema, `t` and the theme.
// redesign B3b: on Product pieces. Selects → P/Select (the control of P/SelectField, without its frame: the row
// draws the label), segmented and cards → P/RadioGroup `cards`, toggles → P/Switch, numbers and texts → P/TextField, html →
// P/TextArea, the colour → ThemeColorField (local), buttons → P/Button, the small-image question → P/ConfirmDialog.

export { ColorSwatchInput }

const metaOf = (ctx, path) => editorOf(getAt(ctx.schema, path))

/** An option's text: its label (on a platform, `label_platform` when it has one), else its value read as words. */
const optionText = (ctx, option, choose) => {
  const label = (ctx.platform && option.label_platform) || option.label
  if (label) return formatText(ctx.t, label, { choose })
  return option.value === null ? '—' : humanize(option.value)
}

/** Back to the default. */
export const ResetValue = ({ label, onClick }) => <IconButton icon={RotateCcw} label={label} className='odc-tc-reset' onClick={onClick} />

/** Values of any kind as the value of an option (P/Select and P/RadioGroup compare text). */
const encode = (value) => JSON.stringify(value ?? null)
const decode = (text) => JSON.parse(text)

/* color */

/** The theme's colors (`tokens.color`), named, as a color can follow them. */
const themeColors = (ctx) => childKeys(ctx.schema?.tokens?.color)
  .filter(name => isNode(ctx.schema.tokens.color[name]))
  .map(name => ({ name, alias: toAlias('color', name), label: formatText(ctx.t, labelOf(ctx.schema, `tokens.color.${name}`), { fallback: name }), value: resolveValue(ctx, toAlias('color', name)) }))

/**
 * A color: a token's own value (picker only), or a component's, which may
 * follow a theme color (an alias) or have its own. A role (`{ink}`) is painted
 * from the component's colors and only reads. With the schema's `alpha` it may
 * be translucent: an alias stays while its opacity does; changing the opacity
 * saves the color it shows at that opacity (the API takes no alias plus alpha).
 */
export const ColorControl = ({ ctx, path, label, value, onChange, invalid, describedBy, compact }) => {
  const { t } = ctx
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
    <ThemeColorField
      t={t}
      label={label}
      valueText={name}
      color={shown}
      linked={linked}
      compact={compact}
      invalid={invalid}
      describedBy={describedBy}
      colors={colors}
      selected={linked ? alias[1] : null}
      alpha={alpha}
      onChange={onChange}
    />
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
    <span role='img' aria-label={`${label}: ${text}${color ? ` (${color})` : ''}`} title={color || undefined} className='odc-tc-computed'>
      {color && <ColorSwatch color={value} small />}
      <span aria-hidden='true' className='odc-tc-ellipsis'>{text}</span>
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
 * redesign B3b (decision 3): a P/TextField of type number, not P/NumberField. Base UI's NumberField reformats and
 * clamps what is typed on blur, so a value off the range would be saved at its limit without the message; this one keeps
 * the draft as typed (1.5 isn't rewritten as 1.50 under the cursor), says the range and saves nothing outside it.
 */
export const NumberField = ({ t, label, value, min, max, step = 1, unit, onChange, invalid, describedBy, scale = 1, className }) => {
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
  const message = outside && typeof min === 'number' && typeof max === 'number'
    ? rangeMessage(t, unit).replace('_min_', isRatio(unit) ? min.toFixed(2) : min * scale).replace('_max_', isRatio(unit) ? max.toFixed(2) : max * scale)
    : undefined
  return (
    <span className={cx('odc-tc-number', className)}>
      <TextField
        type='number'
        min={typeof min === 'number' ? min * scale : undefined}
        max={typeof max === 'number' ? max * scale : undefined}
        step={scale === 1 ? step : 'any'}
        aria-label={label}
        aria-describedby={describedBy}
        invalid={outside || !!invalid}
        error={message}
        value={draft}
        className='odc-figure'
        fieldClassName='odc-tc-number-field'
        onChange={(text) => {
          setDraft(text)
          const next = Number(text)
          const inRange = (typeof min !== 'number' || next >= min * scale) && (typeof max !== 'number' || next <= max * scale)
          if (text !== '' && Number.isFinite(next) && inRange) onChange(Math.round((next / scale) * 10000) / 10000)
        }}
        onBlur={() => setDraft(shown(value))}
      />
      {unit && <span aria-hidden='true' className='odc-tc-unit'>{unitText(unit)}</span>}
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
  const options = [
    ...(unset ? [{ value: 'unset', label: formatText(t, meta.labels.unset, { values: { _px_: resolveValue(ctx, fallback) ?? 0 } }) }] : []),
    // A text style of its own the node no longer offers (`custom` off) has no value to name
    ...(custom && !takesNumber ? [{ value: 'custom', label: typeof value === 'object' ? t('BUILDER_THEME_CUSTOM', 'Custom') : t('BUILDER_THEME_CUSTOM_NUMBER', 'Custom (_value_)').replace('_value_', value) }] : []),
    ...shown.map(level => {
      const name = level.label ? formatText(t, level.label) : humanize(parseAlias(level.value)?.[1] ?? level.value)
      const extra = amount(level)
      return { value: encode(level.value), label: extra ? `${name} · ${extra}` : name }
    }),
    ...(takesNumber ? [{ value: 'custom', label: t('BUILDER_THEME_CUSTOM', 'Custom') }] : [])
  ]
  return (
    <span className='odc-tc-level'>
      <Select
        label={label}
        invalid={invalid && !custom}
        aria-describedby={describedBy}
        value={selected}
        options={options}
        onValueChange={(next) => {
          if (next === 'unset') return onChange(null)
          if (next !== 'custom') return onChange(decode(next))
          const from = Number(resolveValue(ctx, value ?? fallback))
          const start = Number.isFinite(from) ? from : meta.min
          onChange(Math.min(Math.max(start, meta.min), meta.max ?? start))
        }}
      />
      {custom && takesNumber && (
        <NumberField t={t} className='odc-tc-level-number' label={t('BUILDER_THEME_CUSTOM_OF', '_name_: custom').replace('_name_', label)} value={value} min={meta.min} max={meta.max} step={meta.step ?? (type === 'opacity' ? 0.01 : 1)} unit={meta.unit} scale={type === 'opacity' ? 100 : 1} invalid={invalid} onChange={onChange} />
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
    <Select
      label={label}
      invalid={invalid}
      aria-describedby={describedBy}
      value={unset ? UNSET : encode(value)}
      options={[
        ...(unsetLabel ? [{ value: UNSET, label: formatText(ctx.t, unsetLabel) }] : []),
        ...(!known ? [{ value: encode(value), label: value === null || value === undefined ? '—' : humanize(value) }] : []),
        ...options.map(option => ({ value: encode(option.value), label: optionText(ctx, option, choose) }))
      ]}
      onValueChange={(next) => onChange(next === UNSET ? null : decode(next))}
    />
  )
}

/** The options, and the theme's value as one more while the node no longer offers it, so it shows chosen. */
const withValue = (options, value) => (value === null || value === undefined || options.some(option => encode(option.value) === encode(value))
  ? options
  : [...options, { value }])

/**
 * Options side by side, each with its drawing (any number of them).
 * redesign B3b (decision 1): a P/RadioGroup `cards` (P/SegmentedControl takes up to 4 and no drawings); the
 * row names it, so the group's title is hidden. `odc-tc-segmented` narrows the cards so 5–6 fit in a row.
 */
export const SegmentedControl = ({ ctx, path, label, value, onChange, choose }) => (
  <RadioGroup
    label={label}
    hideLabel
    variant='cards'
    className='odc-tc-choices odc-tc-segmented'
    value={encode(value)}
    onValueChange={(next) => onChange(decode(next))}
    options={withValue(optionsOf(ctx.schema, path), value).map(option => ({
      value: encode(option.value),
      label: optionText(ctx, option, choose),
      media: option.drawing ? <Drawing name={option.drawing} /> : undefined
    }))}
  />
)

/** Options as cards, each with its drawing and what it's for. */
export const CardsControl = ({ ctx, path, label, value, onChange }) => {
  if (typeOf(ctx.schema, path) === 'slot') return <SlotControl ctx={ctx} path={path} label={label} value={value} onChange={onChange} />
  return (
    <RadioGroup
      label={label}
      hideLabel
      variant='cards'
      className='odc-tc-choices'
      value={encode(value)}
      onValueChange={(next) => onChange(decode(next))}
      options={withValue(optionsOf(ctx.schema, path), value).map(option => ({
        value: encode(option.value),
        label: optionText(ctx, option),
        description: option.info ? formatText(ctx.t, option.info) : undefined,
        media: option.drawing ? <Drawing name={option.drawing} /> : undefined
      }))}
    />
  )
}

/** Controls side by side (one column on a narrow screen). */
const Row = ({ columns, children }) => <div className='odc-tc-row' style={{ '--odc-tc-columns': columns }}>{children}</div>

/**
 * A piece of a group (`slot`): always the same component, with a select per
 * choice it has (`fields`: size, style, color, shape). It is written whole.
 */
export const SlotControl = ({ ctx, path, label, value, onChange }) => {
  const fields = metaOf(ctx, path).fields || {}
  const piece = value || {}
  const axes = Object.keys(fields).filter(axis => axis in piece)
  return (
    <Row columns={`repeat(${Math.max(axes.length, 1)}, minmax(0, 1fr))`}>
      {axes.map(axis => {
        const field = fields[axis]
        const fieldLabel = `${label}: ${formatText(ctx.t, field.label, { fallback: axis })}`
        const offered = field.options || []
        return (
          <Select
            key={axis}
            label={fieldLabel}
            value={encode(piece[axis])}
            options={[
              ...(!offered.some(option => encode(option.value) === encode(piece[axis])) ? [{ value: encode(piece[axis]), label: piece[axis] === null ? '—' : humanize(piece[axis]) }] : []),
              ...offered.map(option => ({ value: encode(option.value), label: optionText(ctx, option) }))
            ]}
            onValueChange={(next) => onChange({ ...piece, [axis]: decode(next) })}
          />
        )
      })}
    </Row>
  )
}

export const Toggle = ({ label, checked, onChange, disabled }) => <Switch label={label} checked={checked} disabled={disabled} onCheckedChange={(next) => onChange(next)} />

export const ToggleNodeControl = ({ label, value, onChange }) => <Toggle label={label} checked={value !== false && value !== null && value !== undefined} onChange={onChange} />

/* border, shadow */

const BORDER_STYLES = ['solid', 'dashed', 'dotted']
const isNoBorder = (value) => value === null || value === undefined || value === 'none' || value?.width === 0
const EMPTY_OPTION = [{ value: '', label: '—' }]

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
  const colorLabel = t('BUILDER_THEME_BORDER_COLOR_OF', '_name_ color').replace('_name_', label)
  return (
    <Row columns={(roleColor || none) && !unset ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))'}>
      <Select
        label={t('BUILDER_THEME_BORDER_WIDTH_OF', '_name_ width').replace('_name_', label)}
        invalid={invalid}
        value={widthValue}
        options={[
          unsetLabel
            ? { value: 'unset', label: formatText(t, unsetLabel) }
            : { value: 'none', label: meta.labels?.none ? formatText(t, meta.labels.none) : t('BUILDER_THEME_NO_BORDER', 'No border') },
          ...(widthValue === 'custom' ? [{ value: 'custom', label: typeof value.width === 'number' ? `${value.width} px` : t('BUILDER_THEME_CUSTOM_NUMBER', 'Custom (_value_)').replace('_value_', value.width) }] : []),
          ...widths.map(level => ({ value: level.value, label: formatText(t, level.label, { fallback: level.name }) }))
        ]}
        onValueChange={changeWidth}
      />
      <Select
        label={t('BUILDER_THEME_BORDER_STYLE_OF', '_name_ style').replace('_name_', label)}
        disabled={none}
        value={none ? '' : value?.style || 'solid'}
        options={[...(none ? EMPTY_OPTION : []), ...BORDER_STYLES.map(style => ({ value: style, label: styleLabel(style) }))]}
        onValueChange={(next) => onChange({ ...value, style: next })}
      />
      {unset && <Select label={colorLabel} disabled value='' options={EMPTY_OPTION} />}
      {!roleColor && !none && (
        <ColorControl ctx={ctx} path={`${path}.color`} label={colorLabel} value={color} compact onChange={(next) => onChange({ ...value, color: next })} />
      )}
    </Row>
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
    <Select
      label={label}
      invalid={invalid}
      value={selected}
      options={[
        ...(unset || unsetLabel
          ? [{ value: 'unset', label: unsetLabel ? formatText(t, unsetLabel) : t('BUILDER_THEME_DEFAULT_VALUE', 'Default (_value_)').replace('_value_', formatText(t, none?.label, { fallback: 'none' })) }]
          : []),
        ...(selected === 'custom' ? [{ value: 'custom', label: t('BUILDER_THEME_CUSTOM_SHADOW', 'Custom') }] : []),
        ...levels.map(level => ({ value: level.value, label: formatText(t, level.label, { fallback: level.name }) }))
      ]}
      onValueChange={change}
    />
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
    <span className='odc-tc-typography'>
      {number('size')}
      {number('line')}
      {isRatio(fields.line?.unit) && typeof style.size === 'number' && typeof style.line === 'number' && (
        <small aria-label={t('BUILDER_THEME_LINE_HEIGHT_PX', '_px_ px between lines').replace('_px_', Math.round(style.size * style.line))} className='odc-tc-line-px'>
          {`= ${Math.round(style.size * style.line)} px`}
        </small>
      )}
      {fields.weight && (
        <span className='odc-tc-weight'>
          <Select label={fieldLabel('weight')} value={weight} options={weightOptions.map(option => ({ value: option.value, label: `${optionText(ctx, option)} ${option.value}` }))} onValueChange={(next) => change('weight', Number(next))} />
        </span>
      )}
      {extras && number('letter_spacing')}
      {extras && fields.transform && (
        <span className='odc-tc-switch'>
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
    <span className='odc-tc-stack'>
      <Select
        label={label}
        invalid={invalid && !custom}
        aria-describedby={describedBy}
        value={custom ? 'custom' : encode(value)}
        options={[
          ...shown.map(level => ({ value: encode(level.value), label: level.label ? formatText(t, level.label) : humanize(parseAlias(level.value)?.[1] ?? level.value) })),
          { value: 'custom', label: t('BUILDER_THEME_CUSTOM', 'Custom') }
        ]}
        onValueChange={(next) => {
          if (next !== 'custom') return onChange(decode(next))
          onChange(withoutFamily(resolveValue(ctx, value ?? fallback)))
        }}
      />
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
    <Select
      label={label}
      invalid={invalid}
      value={value || ''}
      // The chosen font shows in itself
      style={value ? { fontFamily: `'${family(value)}', sans-serif` } : undefined}
      options={shown.map(font => ({ value: font, label: family(font) }))}
      onValueChange={(next) => onChange(next)}
    />
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
    <span className='odc-tc-stack'>
      <span className='odc-tc-image-row'>
        {value && <img src={value} alt='' className='odc-tc-thumb' />}
        <input ref={fileInput} type='file' hidden accept={formats.map(format => `.${format}`).join(',')} aria-label={`${t('BUILDER_THEME_IMAGE_FILE', 'Image file')}: ${label}`} aria-describedby={hintsId} onChange={(e) => { choose(e.target.files?.[0]); e.target.value = '' }} />
        <Button ref={uploadButton} disabled={uploading} aria-describedby={hintsId} onClick={() => fileInput.current?.click()}>
          {uploading ? t('BUILDER_THEME_UPLOADING', 'Uploading…') : value ? t('BUILDER_THEME_IMAGE_REPLACE', 'Replace') : t('BUILDER_THEME_IMAGE_UPLOAD', 'Upload')}
        </Button>
        {link === null && <Button variant='ghost' onClick={() => setLink('')}>{t('BUILDER_THEME_IMAGE_USE_LINK', 'Use a link')}</Button>}
      </span>
      {link !== null && (
        <span className='odc-tc-link'>
          <TextField type='url' value={link} placeholder='https://' fieldClassName='odc-tc-link-field' aria-label={`${t('BUILDER_THEME_IMAGE_LINK', 'Image link')}: ${label}`} onChange={(text) => { setLink(text); setError(null) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }} />
          <Button variant='primary' onClick={applyLink}>{t('BUILDER_THEME_IMAGE_USE', 'Use')}</Button>
        </span>
      )}
      <small id={hintsId} className='odc-tc-hint'>{imageHints(t, formats, engine.hints)}</small>
      {error && <span role='alert' className='odc-tc-error'>{error}</span>}
      {small && (
        <ConfirmDialog
          open
          tone='primary'
          title={t('BUILDER_THEME_IMAGE_SMALL_TITLE', 'This image is smaller than recommended')}
          confirmLabel={t('BUILDER_THEME_CROP_AS_IS_CONFIRM', 'Upload anyway')}
          cancelLabel={t('CANCEL', 'Cancel')}
          closeLabel={t('CLOSE', 'Close')}
          // The upload button takes the focus back once it is enabled again (the effect above), not the dialog
          finalFocus={false}
          onConfirm={() => closeSmall(true)}
          onCancel={() => closeSmall(false)}
        >
          <p className='odc-tc-text'>
            {t('BUILDER_THEME_IMAGE_SMALL_TEXT', 'Yours is _yours_ and the recommended size is _size_, so it may look blurry on large screens.')
              .replace('_yours_', `${small.width} × ${small.height} px`)
              .replace('_size_', `${small.recommended.width} × ${small.recommended.height} px`)}
          </p>
        </ConfirmDialog>
      )}
      {crop && (
        <Suspense fallback={null}>
          <ImageCropDialog
            t={t}
            kind={ctx.kind}
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
  const wrong = draft !== '' && !!pattern && !pattern.test(draft)
  const Field = meta.multiline ? TextArea : TextField
  return (
    <span className='odc-tc-stack'>
      <Field
        aria-label={label}
        aria-describedby={describedBy}
        invalid={wrong || !!invalid}
        error={wrong ? ctx.t('BUILDER_THEME_TEXT_PATTERN', 'This doesn’t look right, so it isn’t saved. Check it against the example.') : undefined}
        value={draft}
        placeholder={meta.placeholder ? formatText(ctx.t, meta.placeholder) : undefined}
        maxLength={maxLength}
        onChange={(text) => {
          setDraft(text)
          if (text === '') return onChange(null)
          if (!pattern || pattern.test(text)) onChange(text)
        }}
        onBlur={() => wrong && setDraft(value ?? '')}
      />
      {maxLength !== undefined && <small aria-hidden='true' className='odc-tc-counter odc-figure'>{`${draft.length}/${maxLength}`}</small>}
    </span>
  )
}

const RichHtmlEditor = lazy(() => import('../../Shared/RichHtmlEditor'))

export const HtmlControl = ({ label, value, onChange, invalid, describedBy }) => (
  <Suspense fallback={null}>
    <RichHtmlEditor codeTabs label={label} value={value} onChange={onChange} invalid={invalid} describedBy={describedBy} />
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
