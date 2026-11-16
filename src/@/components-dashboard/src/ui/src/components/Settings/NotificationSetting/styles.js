import styled, { css } from 'styled-components'
import { brandFocusRing } from '../../../styles/touchTarget'

export const NotificationSettingContainer = styled.div``

export const AccordionTitle = styled.span`
  display: block;
  color: ${props => props.theme?.colors.headingColor};
  font-size: var(--od-type-section-title-size);
  font-weight: 600;
  cursor: pointer;
  border-bottom: 1px solid ${props => props.theme?.colors.borderColor};
  padding: 10px 5px;
`

export const GeneralWrapper = styled.div`
  padding-top: 20px;
`

// The accordion toggle is a real button now. The reset keeps it the full-width block the
// div was: it has no box of its own, the AccordionTitle inside carries the padding.
export const ToggleItemWrapper = styled.button.attrs({ type: 'button' })`
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  font-weight: inherit;
  color: inherit;
  text-align: inherit;
  cursor: auto;
  background: transparent;

  ${({ active }) => active && css`
    background: ${props => props.theme?.colors.borderColor};
  `}

  ${brandFocusRing}
`

export const TitleWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  label {
    margin-bottom: 0 !important;
    margin-bottom: 10px;
    font-size: var(--od-type-control-size);
    font-weight: 600;
  }
  button {
    height: 25px;
    svg {
      width: 16px;
      height: 16px;
    }
  }
`
