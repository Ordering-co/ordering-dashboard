import styled, { css } from 'styled-components'
import { brandFocusRing, coarseHitArea } from '../../../styles/touchTarget'

export const LanguageDetailsContainer = styled.div`
  padding: 0px 15px 70px 15px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;

  h1 {
    font-weight: 700;
    font-size: var(--od-type-title-size);
    margin-bottom: 10px;
  }
`

export const FieldContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 10px 0;
  ${({ isHeader }) => isHeader && css`
    border-bottom: 1px solid ${props => props.theme.colors.borderColor};
    margin-bottom: 15px;
    > div {
      font-weight: 700;
      font-size: var(--od-type-control-size);
    }
  `}

  .name {
    flex: 1;
    font-size: var(--od-type-control-size);
  }

  .default {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;

    svg {
      cursor: pointer;
      font-size: 20px;
    }
  }

  .checked {
    svg {
      color: ${props => props.theme.colors.primary};
    }
  }

  .status {
    width: 80px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
`

// The Default mark is a real radio button: the reset keeps the bare icon box the div was, the hit area grows to 44px only for a
// coarse pointer (without moving it), and a language that is not enabled is disabled (it was pointer-events: none).
export const RadioWrapper = styled.button.attrs({ type: 'button' })`
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  ${coarseHitArea}
  ${brandFocusRing}

  &:disabled {
    cursor: not-allowed;
    svg {
      color: ${props => props.theme.colors.disabled};
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
`
