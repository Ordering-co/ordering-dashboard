import React from 'react'
import { AssistantMarkdown } from '../../Assistant/AssistantMarkdown'

const FENCE_LINE = /^([ \t]*)(`{3,}|~{3,})(.*)$/

// Source guides can contain Markdown literals inside shell heredocs. Keep code
// out of the shared parser: only non-code chunks are delegated to it.
export const parseSourceCodeMarkdown = markdown => {
  const parts = String(markdown ?? '').split(/(\r\n|\n|\r)/)
  const segments = []
  let prose = ''
  let fence = null
  const appendProse = () => {
    if (prose) segments.push({ type: 'markdown', text: prose })
    prose = ''
  }
  const appendCode = closed => {
    // The newline separating the last body line from a closing delimiter is
    // structural. Keep all intervening separators, whitespace and commands.
    const text = fence.lines.map((line, index) => line.text + (closed && index === fence.lines.length - 1 ? '' : line.ending)).join('')
    segments.push({ type: 'code', text, info: fence.info })
  }

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index]
    const ending = parts[index + 1] || ''
    const match = FENCE_LINE.exec(line)
    if (fence) {
      const closes = match && match[2][0] === fence.character && match[2].length >= fence.length && /^[ \t]*$/.test(match[3])
      if (closes) {
        appendCode(true)
        fence = null
      } else {
        fence.lines.push({ text: line, ending })
      }
    } else if (match) {
      appendProse()
      fence = { character: match[2][0], length: match[2].length, info: match[3], lines: [] }
    } else {
      prose += line + ending
    }
  }
  if (fence) appendCode(false)
  appendProse()
  return segments
}

export const SourceCodeMarkdown = ({ text }) => (
  <>
    {parseSourceCodeMarkdown(text).map((segment, index) => segment.type === 'code'
      ? <pre key={index}><code data-language={segment.info || undefined}>{segment.text}</code></pre>
      : <AssistantMarkdown key={index} text={segment.text} />)}
  </>
)
