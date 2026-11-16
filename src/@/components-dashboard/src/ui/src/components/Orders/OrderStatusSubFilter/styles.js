import styled from 'styled-components'

export const SubFilterContainer = styled.div`
  padding: 15px 0;

  button {
    margin-inline-end: 10px;
    font-size: var(--od-type-control-size);
    white-space: nowrap;

    /* : a touch target, like the status Tab beside it (it measured 25.5px at 320 with a coarse pointer). */
    @media (pointer: coarse) {
      min-height: 44px;
    }

    svg {
      font-size: 20px;

      margin-inline-start: 5px;
    }
  }
`
