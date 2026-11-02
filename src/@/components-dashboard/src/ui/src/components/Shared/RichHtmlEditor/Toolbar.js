import React, { useState } from 'react'
import { useEditorState } from '@tiptap/react'
import {
  ArrowBarDown,
  ArrowBarRight,
  ArrowsCollapse,
  ArrowsCollapseVertical,
  CameraVideo,
  CodeSlash,
  Eraser,
  Fonts,
  Highlighter,
  Image,
  Justify,
  Link45deg,
  ListOl,
  ListUl,
  Table,
  TextCenter,
  TextLeft,
  TextRight,
  Trash3,
  TypeBold,
  TypeItalic,
  TypeUnderline
} from 'react-bootstrap-icons'

import { ColorTool, ToolButton, ToolGroup, ToolSelect, ToolbarBar } from './styles'

const HEADINGS = [1, 2, 3, 4, 5, 6]
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 36]
const ALIGNMENTS = ['left', 'center', 'right', 'justify']

const blockOf = (editor) => {
  if (editor.isActive('codeBlock')) return 'pre'
  if (editor.isActive('blockquote')) return 'blockquote'
  const level = HEADINGS.find(heading => editor.isActive('heading', { level: heading }))
  return level ? `h${level}` : 'p'
}

const setBlock = (editor, block) => {
  const chain = editor.chain().focus()
  if (editor.isActive('blockquote') && block !== 'blockquote') chain.unsetBlockquote()
  if (block === 'pre') return chain.setCodeBlock().run()
  if (block === 'blockquote') return chain.setParagraph().setBlockquote().run()
  if (block.startsWith('h')) return chain.setHeading({ level: Number(block.slice(1)) }).run()
  return chain.setParagraph().run()
}

const ColorPicker = ({ label, Icon, color, disabled, onChange }) => (
  <ColorTool title={label} $disabled={disabled}>
    <Icon />
    <span style={{ background: color }} />
    <input type='color' aria-label={label} value={color} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
  </ColorTool>
)

export const Toolbar = ({ editor, t, codeView, onToggleCode, onInsert }) => {
  const [textColor, setTextColor] = useState('#000000')
  const [background, setBackground] = useState('#FFFF00')
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => current
      ? {
          block: blockOf(current),
          bold: current.isActive('bold'),
          italic: current.isActive('italic'),
          underline: current.isActive('underline'),
          bulletList: current.isActive('bulletList'),
          orderedList: current.isActive('orderedList'),
          align: ALIGNMENTS.find(align => current.isActive({ textAlign: align })) || 'left',
          fontSize: current.getAttributes('textStyle').fontSize || '',
          table: current.isActive('table')
        }
      : {}
  }) || {}
  const disabled = codeView || !editor

  const tool = (label, Icon, command, pressed) => (
    <ToolButton
      type='button'
      aria-label={label}
      title={label}
      aria-pressed={pressed === undefined ? undefined : !!pressed}
      disabled={disabled}
      onClick={() => command(editor.chain().focus()).run()}
    >
      <Icon />
    </ToolButton>
  )

  return (
    <ToolbarBar role='toolbar' aria-label={t('HTML_EDITOR_TOOLBAR', 'Formatting')}>
      <ToolGroup>
        <ToolSelect
          aria-label={t('HTML_EDITOR_TEXT_STYLE', 'Text style')}
          value={state.block || 'p'}
          disabled={disabled}
          onChange={(event) => setBlock(editor, event.target.value)}
        >
          <option value='p'>{t('HTML_EDITOR_NORMAL', 'Normal')}</option>
          {HEADINGS.map(level => <option key={level} value={`h${level}`}>{t('HTML_EDITOR_HEADING', 'Heading _level_').replace('_level_', level)}</option>)}
          <option value='blockquote'>{t('HTML_EDITOR_QUOTE', 'Quote')}</option>
          <option value='pre'>{t('HTML_EDITOR_CODE_BLOCK', 'Code')}</option>
        </ToolSelect>
      </ToolGroup>
      <ToolGroup>
        {tool(t('HTML_EDITOR_BOLD', 'Bold'), TypeBold, chain => chain.toggleBold(), state.bold)}
        {tool(t('HTML_EDITOR_ITALIC', 'Italic'), TypeItalic, chain => chain.toggleItalic(), state.italic)}
        {tool(t('HTML_EDITOR_UNDERLINE', 'Underline'), TypeUnderline, chain => chain.toggleUnderline(), state.underline)}
        {tool(t('HTML_EDITOR_CLEAR', 'Clear formatting'), Eraser, chain => chain.unsetAllMarks())}
      </ToolGroup>
      <ToolGroup>
        <ToolSelect
          aria-label={t('HTML_EDITOR_FONT_SIZE', 'Font size')}
          value={state.fontSize || ''}
          disabled={disabled}
          onChange={(event) => {
            const size = event.target.value
            const chain = editor.chain().focus()
            return (size ? chain.setFontSize(size) : chain.unsetFontSize()).run()
          }}
        >
          <option value=''>{t('HTML_EDITOR_FONT_SIZE_DEFAULT', 'Size')}</option>
          {FONT_SIZES.map(size => <option key={size} value={`${size}px`}>{size}</option>)}
        </ToolSelect>
        <ColorPicker
          label={t('HTML_EDITOR_TEXT_COLOR', 'Text color')}
          Icon={Fonts}
          color={textColor}
          disabled={disabled}
          onChange={(color) => {
            setTextColor(color)
            editor.chain().focus().setColor(color).run()
          }}
        />
        <ColorPicker
          label={t('HTML_EDITOR_BACKGROUND_COLOR', 'Background color')}
          Icon={Highlighter}
          color={background}
          disabled={disabled}
          onChange={(color) => {
            setBackground(color)
            editor.chain().focus().setBackgroundColor(color).run()
          }}
        />
      </ToolGroup>
      <ToolGroup>
        {tool(t('HTML_EDITOR_BULLET_LIST', 'Bulleted list'), ListUl, chain => chain.toggleBulletList(), state.bulletList)}
        {tool(t('HTML_EDITOR_ORDERED_LIST', 'Numbered list'), ListOl, chain => chain.toggleOrderedList(), state.orderedList)}
        {tool(t('HTML_EDITOR_ALIGN_LEFT', 'Align left'), TextLeft, chain => chain.setTextAlign('left'), state.align === 'left')}
        {tool(t('HTML_EDITOR_ALIGN_CENTER', 'Center'), TextCenter, chain => chain.setTextAlign('center'), state.align === 'center')}
        {tool(t('HTML_EDITOR_ALIGN_RIGHT', 'Align right'), TextRight, chain => chain.setTextAlign('right'), state.align === 'right')}
        {tool(t('HTML_EDITOR_ALIGN_JUSTIFY', 'Justify'), Justify, chain => chain.setTextAlign('justify'), state.align === 'justify')}
      </ToolGroup>
      <ToolGroup>
        {tool(t('HTML_EDITOR_INSERT_TABLE', 'Insert table'), Table, chain => chain.insertTable({ rows: 3, cols: 3, withHeaderRow: false }))}
        {state.table && (
          <>
            {tool(t('HTML_EDITOR_ADD_ROW', 'Add row'), ArrowBarDown, chain => chain.addRowAfter())}
            {tool(t('HTML_EDITOR_ADD_COLUMN', 'Add column'), ArrowBarRight, chain => chain.addColumnAfter())}
            {tool(t('HTML_EDITOR_DELETE_ROW', 'Delete row'), ArrowsCollapse, chain => chain.deleteRow())}
            {tool(t('HTML_EDITOR_DELETE_COLUMN', 'Delete column'), ArrowsCollapseVertical, chain => chain.deleteColumn())}
            {tool(t('HTML_EDITOR_DELETE_TABLE', 'Delete table'), Trash3, chain => chain.deleteTable())}
          </>
        )}
      </ToolGroup>
      <ToolGroup>
        <ToolButton type='button' aria-label={t('INSERT_LINK', 'Insert link')} title={t('INSERT_LINK', 'Insert link')} disabled={disabled} onClick={() => onInsert('link')}><Link45deg /></ToolButton>
        <ToolButton type='button' aria-label={t('INSERT_IMAGE', 'Insert image')} title={t('INSERT_IMAGE', 'Insert image')} disabled={disabled} onClick={() => onInsert('image')}><Image /></ToolButton>
        <ToolButton type='button' aria-label={t('INSERT_VIDEO', 'Insert video')} title={t('INSERT_VIDEO', 'Insert video')} disabled={disabled} onClick={() => onInsert('video')}><CameraVideo /></ToolButton>
      </ToolGroup>
      <ToolGroup>
        <ToolButton
          type='button'
          aria-label={t('HTML_EDITOR_CODE_VIEW', 'Edit as HTML')}
          title={t('HTML_EDITOR_CODE_VIEW', 'Edit as HTML')}
          aria-pressed={codeView}
          disabled={!editor}
          onClick={onToggleCode}
        >
          <CodeSlash />
        </ToolButton>
      </ToolGroup>
    </ToolbarBar>
  )
}
