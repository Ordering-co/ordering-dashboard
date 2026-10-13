import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceCodeMarkdown, parseSourceCodeMarkdown } from '../SourceCodeMarkdown'
import { producerGuides, producerCommands, mixedFenceGuide, heredocCommands } from './producerGuideFixture'

const codeSegments = input => parseSourceCodeMarkdown(input).filter(segment => segment.type === 'code')

describe('Source-only fence-aware Markdown rendering', () => {
  it('renders D’s exact tilde heredoc without consuming its literal backtick line', () => {
    const { container } = render(<SourceCodeMarkdown text={mixedFenceGuide} />)
    const blocks = container.querySelectorAll('pre code')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].textContent).toBe(heredocCommands)
    expect(blocks[0]).toHaveAttribute('data-language', 'sh')
  })

  it.each(['es', 'ar'])('preserves the %s producer-format guide commands and leaves metadata untouched', locale => {
    const original = producerGuides[locale]
    const { container } = render(<SourceCodeMarkdown text={original} />)
    expect(container.querySelector('pre code').textContent).toBe(producerCommands)
    expect(container.textContent).not.toContain('~~~sh')
    expect(producerGuides[locale]).toBe(original)
  })

  it('preserves internal CRLF separators, indentation, language suffix and raw command whitespace', () => {
    const body = '  printf "%s" "a~~~b"\r\n\techo keep  '
    const original = 'Before\r\n \t~~~sh  \r\n' + body + '\r\n  ~~~  \r\nAfter\r\n'
    expect(parseSourceCodeMarkdown(original)).toEqual([
      { type: 'markdown', text: 'Before\r\n' },
      { type: 'code', text: body, info: 'sh  ' },
      { type: 'markdown', text: 'After\r\n' }
    ])
    const { container } = render(<SourceCodeMarkdown text={original} />)
    expect(container.querySelector('pre code').textContent).toBe(body)
  })

  it('retains shorter, differently marked and suffix-bearing fence lines as code until the matching closer', () => {
    const body = '~~~\n```\n~~~~shell-text\necho keep'
    const original = '~~~~sh\n' + body + '\n~~~~~ \nAfter'
    expect(codeSegments(original)).toEqual([{ type: 'code', text: body, info: 'sh' }])
    const { container } = render(<SourceCodeMarkdown text={original} />)
    expect(container.querySelector('pre code').textContent).toBe(body)
    expect(screen.getByText('After')).toBeInTheDocument()
  })

  it('respects marker and length in existing backtick blocks and then parses the next tilde block', () => {
    const body = '~~~sh\n~~~\n```\ncat keep'
    const original = '````sh\n' + body + '\n````\n~~~json\n{"raw":"~~~"}\n~~~'
    const { container } = render(<SourceCodeMarkdown text={original} />)
    const blocks = container.querySelectorAll('pre code')
    expect(blocks).toHaveLength(2)
    expect(blocks[0].textContent).toBe(body)
    expect(blocks[1].textContent).toBe('{"raw":"~~~"}')
  })

  it('escapes HTML in code as React text and delegates outside Markdown links to the shared renderer', () => {
    const body = '<script>untrusted()</script>\n<img src=x onerror="untrusted()">'
    const { container } = render(<SourceCodeMarkdown text={'## Before\n\n~~~html\n' + body + '\n~~~\n\n[Docs](https://docs.example.test)'} />)
    expect(container.querySelector('pre code').textContent).toBe(body)
    expect(container.querySelector('script, img')).toBeNull()
    expect(container.querySelector('pre code').innerHTML).toContain('&lt;script&gt;')
    expect(screen.getByText('Before')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('keeps intentional blank body lines and preserves all line endings when a block is unclosed', () => {
    expect(codeSegments('~~~sh\necho keep\n\n\n~~~')[0].text).toBe('echo keep\n\n')
    expect(codeSegments('~~~sh\r\npwd\r\n')[0].text).toBe('pwd\r\n')
  })

  it('leaves ordinary and inline-fence text in Markdown chunks without generic escaping', () => {
    expect(parseSourceCodeMarkdown('Run ~~~sh inline\rordinary text')).toEqual([{ type: 'markdown', text: 'Run ~~~sh inline\rordinary text' }])
  })
})
