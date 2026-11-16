import React, { useState } from 'react'
import { useEditorState } from '@tiptap/react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  CodeXml,
  Eraser as EraserIcon,
  FoldHorizontal,
  FoldVertical,
  Highlighter as HighlighterIcon,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Table as TableIcon,
  Trash2,
  Type,
  Underline,
  Video
} from 'lucide-react'

import { ColorTool, ToolButton, ToolGroup, ToolSelect, ToolbarBar } from './styles'

// The icons take the size of the button's text, as the toolbar is laid out for.
const sized = (Icon) => function ToolIcon (props) {
  return <Icon size='1em' aria-hidden='true' {...props} />
}

const ArrowBarDown = sized(BetweenHorizontalEnd)
const ArrowBarRight = sized(BetweenVerticalEnd)
const ArrowsCollapse = sized(FoldVertical)
const ArrowsCollapseVertical = sized(FoldHorizontal)
const CameraVideo = sized(Video)
const CodeSlash = sized(CodeXml)
const Eraser = sized(EraserIcon)
const Fonts = sized(Type)
const Highlighter = sized(HighlighterIcon)
const Image = sized(ImageIcon)
const Justify = sized(AlignJustify)
const Link45deg = sized(LinkIcon)
const ListOl = sized(ListOrdered)
const ListUl = sized(List)
const Table = sized(TableIcon)
const TextCenter = sized(AlignCenter)
const TextIndentLeft = sized(IndentIncrease)
const TextIndentRight = sized(IndentDecrease)
const TextLeft = sized(AlignLeft)
const TextRight = sized(AlignRight)
const Trash3 = sized(Trash2)
const TypeBold = sized(Bold)
const TypeItalic = sized(Italic)
const TypeUnderline = sized(Underline)

const HEADINGS = [1, 2, 3, 4, 5, 6]
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 36]
const ALIGNMENTS = ['left', 'center', 'right', 'justify']
const INDENT_STEP = 25
const INDENTED = ['paragraph', 'heading']

// Inside a list it nests the item; elsewhere it moves the block by the margin Summernote used, so pages written with it keep their steps.
const indent = (chain, editor, step) => {
  if (editor.isActive('listItem')) return step > 0 ? chain.sinkListItem('listItem') : chain.liftListItem('listItem')
  return chain.command(({ tr, state }) => {
    const { from, to } = state.selection
    state.doc.nodesBetween(from, to, (node, position) => {
      if (!INDENTED.includes(node.type.name)) return
      const margin = Math.max(0, (parseInt(node.attrs.marginLeft, 10) || 0) + step)
      tr.setNodeMarkup(position, undefined, { ...node.attrs, marginLeft: margin ? `${margin}px` : null })
    })
    return true
  })
}

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

export const Toolbar = ({ editor, t, codeView, video = true, onToggleCode, onCodeIntent, onInsert }) => {
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
        {tool(t('HTML_EDITOR_OUTDENT', 'Decrease indent'), TextIndentRight, chain => indent(chain, editor, -INDENT_STEP))}
        {tool(t('HTML_EDITOR_INDENT', 'Increase indent'), TextIndentLeft, chain => indent(chain, editor, INDENT_STEP))}
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
        {video && <ToolButton type='button' aria-label={t('INSERT_VIDEO', 'Insert video')} title={t('INSERT_VIDEO', 'Insert video')} disabled={disabled} onClick={() => onInsert('video')}><CameraVideo /></ToolButton>}
      </ToolGroup>
      <ToolGroup>
        <ToolButton
          type='button'
          aria-label={t('HTML_EDITOR_CODE_VIEW', 'Edit as HTML')}
          title={t('HTML_EDITOR_CODE_VIEW', 'Edit as HTML')}
          aria-pressed={codeView}
          disabled={!editor}
          // Pointing at or focusing the button starts loading the code editor, so the click rarely has to wait for it.
          onMouseEnter={onCodeIntent}
          onFocus={onCodeIntent}
          onClick={onToggleCode}
        >
          <CodeSlash />
        </ToolButton>
      </ToolGroup>
    </ToolbarBar>
  )
}
