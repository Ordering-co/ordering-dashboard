import React from 'react'

/**
 * The small Markdown subset the assistant answers with: paragraphs, headings,
 * lists, tables, code, bold, italics and links. It builds React elements and
 * never HTML, so text coming from the project (a product name, an order note)
 * cannot inject markup; links open only when they are http(s).
 */

const INLINE_PATTERN = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\[[^\]\n]+\]\([^)\s]+\))|(\*[^*\n]+\*)|(_[^_\n]+_)/g
const SAFE_URL = /^https?:\/\//i
const WORD_CHAR = /[\p{L}\p{N}_]/u

/**
 * Whether `*` / `_` around `inner` are emphasis, as in CommonMark: the text
 * does not start or end with a space (`2 * 3 * 4`), and `_` does not touch a
 * letter or digit outside (`pizza_margherita_large`, `john_doe@mail.com`).
 */
const isEmphasis = (source, start, end, marker, inner) => {
  if (!inner.trim() || inner.trim() !== inner) return false
  if (marker !== '_') return true
  return !WORD_CHAR.test(source[start - 1] || '') && !WORD_CHAR.test(source[end] || '')
}

export const renderInline = (text, keyPrefix = 'i') => {
  const nodes = []
  let last = 0
  let index = 0
  const source = String(text ?? '')
  const pattern = new RegExp(INLINE_PATTERN.source, 'g')
  let match

  while ((match = pattern.exec(source))) {
    const token = match[0]
    const start = match.index
    const end = start + token.length
    const size = match[2] || match[3] ? 2 : 1
    if (!match[1] && !match[4] && !isEmphasis(source, start, end, token[0], token.slice(size, -size))) {
      // Plain text: look again from the next character
      pattern.lastIndex = start + 1
      continue
    }

    if (start > last) nodes.push(source.slice(last, start))
    const key = `${keyPrefix}-${index++}`

    if (match[1]) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>)
    } else if (size === 2) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), key)}</strong>)
    } else if (match[4]) {
      const [, label, url] = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      nodes.push(SAFE_URL.test(url)
        ? <a key={key} href={url} target='_blank' rel='noopener noreferrer'>{label}</a>
        : label)
    } else {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), key)}</em>)
    }
    last = end
  }
  if (last < source.length) nodes.push(source.slice(last))
  return nodes
}

const LIST_ITEM = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const HEADING = /^(#{1,6})\s+(.*)$/

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())

/**
 * Split Markdown into blocks: `{ type: 'p'|'h'|'ul'|'ol'|'table'|'code', ... }`
 */
export const parseBlocks = (markdown) => {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index++
      continue
    }

    if (line.trim().startsWith('```')) {
      const code = []
      index++
      while (index < lines.length && !lines[index].trim().startsWith('```')) code.push(lines[index++])
      index++
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    const heading = line.match(HEADING)
    if (heading) {
      blocks.push({ type: 'h', text: heading[2] })
      index++
      continue
    }

    if (line.includes('|') && TABLE_SEPARATOR.test(lines[index + 1] || '')) {
      const header = splitRow(line)
      const rows = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) rows.push(splitRow(lines[index++]))
      blocks.push({ type: 'table', header, rows })
      continue
    }

    const listItem = line.match(LIST_ITEM)
    if (listItem) {
      const ordered = !!listItem[1]
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(LIST_ITEM)
        if (item && !!item[1] === ordered) {
          items.push(item[2])
          index++
        } else if (lines[index].trim() && /^\s{2,}/.test(lines[index]) && items.length) {
          items[items.length - 1] += ` ${lines[index].trim()}`
          index++
        } else {
          break
        }
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items })
      continue
    }

    const paragraph = []
    while (
      index < lines.length && lines[index].trim() &&
      !lines[index].trim().startsWith('```') && !HEADING.test(lines[index]) && !LIST_ITEM.test(lines[index]) &&
      !(lines[index].includes('|') && TABLE_SEPARATOR.test(lines[index + 1] || ''))
    ) {
      paragraph.push(lines[index++])
    }
    blocks.push({ type: 'p', lines: paragraph })
  }

  return blocks
}

export const AssistantMarkdown = ({ text }) => {
  const blocks = parseBlocks(text)
  return (
    <>
      {blocks.map((block, index) => {
        const key = `b${index}`
        switch (block.type) {
          case 'code':
            return <pre key={key}><code>{block.text}</code></pre>
          case 'h':
            return <p key={key}><strong>{renderInline(block.text, key)}</strong></p>
          case 'ul':
            return <ul key={key}>{block.items.map((item, i) => <li key={i}>{renderInline(item, `${key}-${i}`)}</li>)}</ul>
          case 'ol':
            return <ol key={key}>{block.items.map((item, i) => <li key={i}>{renderInline(item, `${key}-${i}`)}</li>)}</ol>
          case 'table':
            return (
              <div key={key} className='assistant-table'>
                <table>
                  <thead>
                    <tr>{block.header.map((cell, i) => <th key={i}>{renderInline(cell, `${key}-h${i}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>{row.map((cell, i) => <td key={i}>{renderInline(cell, `${key}-${r}-${i}`)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          default:
            return (
              <p key={key}>
                {block.lines.map((line, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <br />}
                    {renderInline(line, `${key}-${i}`)}
                  </React.Fragment>
                ))}
              </p>
            )
        }
      })}
    </>
  )
}
