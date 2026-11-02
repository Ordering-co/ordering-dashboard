import styled from 'styled-components'

export const EditorShell = styled.div`
  min-width: 0;
  border: 1px solid ${props => props.invalid ? '#C02642' : '#CED4DA'};
  border-radius: 8px;
  background: #FFFFFF;
  overflow: hidden;
`

export const ToolbarBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-bottom: 1px solid #CED4DA;
  background: #F8F9FA;
`

export const ToolGroup = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;

  & + & {
    padding-left: 4px;
    border-left: 1px solid #DEE2E6;
  }
`

export const ToolButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;

  &:hover:not(:disabled) {
    background: #E9ECEF;
  }

  &[aria-pressed='true'] {
    background: #E9ECEF;
    color: ${props => props.theme.colors.primary};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`

const selectCaret = (color) => encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1.5L6 6.5L11 1.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
)

export const ToolSelect = styled.select`
  height: 32px;
  padding: 0 10px;
  padding-${props => props.theme?.rtl ? 'left' : 'right'}: 32px;
  border: 1px solid #CED4DA;
  border-radius: 6px;
  appearance: none;
  background-color: #FFFFFF;
  background-image: url("data:image/svg+xml,${props => selectCaret(props.theme.colors.headingColor || '#1a1a1a')}");
  background-repeat: no-repeat;
  background-position: ${props => props.theme?.rtl ? 'left' : 'right'} 12px center;
  background-size: 10px 7px;
  color: ${props => props.theme.colors.headingColor};
  font: inherit;
  font-size: 13px;
  cursor: pointer;

  &::-ms-expand {
    display: none;
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`

export const ColorTool = styled.label`
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 32px;
  height: 32px;
  margin: 0;
  border-radius: 6px;
  color: ${props => props.theme.colors.headingColor};
  cursor: pointer;
  opacity: ${props => props.$disabled ? 0.4 : 1};

  &:hover {
    background: ${props => props.$disabled ? 'transparent' : '#E9ECEF'};
  }

  > span {
    width: 16px;
    height: 3px;
    border-radius: 2px;
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: inherit;
  }
`

export const Notice = styled.p`
  margin: 0;
  padding: 8px 14px;
  border-bottom: 1px solid #CED4DA;
  background: #FFF8E6;
  color: #5E6B7D;
  font-size: 12px;
`

export const VisualArea = styled.div`
  .ProseMirror {
    min-height: 200px;
    max-height: 480px;
    overflow-y: auto;
    padding: 12px 14px;
    outline: none;
    color: ${props => props.theme.colors.headingColor};
    font-size: 14px;
    line-height: 1.5;

    p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table {
      margin: 0 0 8px;
    }

    ul, ol {
      padding-left: 24px;
    }

    blockquote {
      padding-left: 12px;
      border-left: 3px solid #DEE2E6;
      color: #5E6B7D;
    }

    pre {
      padding: 8px 12px;
      border-radius: 6px;
      background: #F8F9FA;
      font-family: monospace;
    }

    img, iframe {
      max-width: 100%;
    }

    img {
      height: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    td, th {
      padding: 6px 8px;
      border: 1px solid #CED4DA;
      vertical-align: top;
    }

    .selectedCell {
      background: #E9ECEF;
    }
  }
`

export const CodeArea = styled.textarea`
  display: block;
  box-sizing: border-box;
  width: 100%;
  min-height: 200px;
  padding: 12px 14px;
  border: 0;
  outline: none;
  resize: vertical;
  background: #FFFFFF;
  color: ${props => props.theme.colors.headingColor};
  font-family: monospace;
  font-size: 13px;
`
