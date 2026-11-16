import styled from 'styled-components'

export const PlaceholderTitle = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  line-height:15px;
  font-size:var(--od-type-control-value-size);
`

export const Option = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  column-gap: 20px;

  svg {
    margin-inline-end: 5px;
  }
`

/* redesign F6d-1 (P4-04): «ID 34» after the name of a driver group: muted, one line, never shrunk. TODO(typography role): it keeps the size of the name; the coordinator
   decides whether it gets a `secondary` role and the matching guard rule. */
export const GroupId = styled.span`
  flex: none;
  color: var(--od-text-muted);
  white-space: nowrap;
`
