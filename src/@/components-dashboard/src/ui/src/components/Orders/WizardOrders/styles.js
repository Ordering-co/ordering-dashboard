import styled from 'styled-components'

import { getOrderingAction } from '~/brand/adapter'

export const HelperContent = styled.div`
  display: flex;
  align-items: center;

  > span {
    color: ${props => getOrderingAction(props.theme) ?? props.theme.colors.primary};
    font-size: var(--od-type-identifier-size);
    font-family: var(--od-type-identifier-font);
    font-variant-ligatures: var(--od-type-identifier-ligatures);
    line-height: 30px;
    font-weight: 600;
    margin-inline-end: 13px;
  }
  p {
    flex: 1;
    font-size: var(--od-type-content-size);
    line-height: 24px;
    margin: 0;

    span {
      font-weight: 600;
    }
  }

  > svg {
    color: #FFC700;
    font-size: 30px;
    margin-inline-end: 20px;
  }
`
