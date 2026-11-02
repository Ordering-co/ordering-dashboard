import styled, { css } from 'styled-components'
import { darken } from 'polished'

export const Container = styled.div`
  > h2 {
    font-weight: 600;
    font-size: 16px;
    line-height: 24px;
    margin: 0;
  }
  > p {
    font-size: 14px;
    line-height: 24px;
    margin: 4px 0 0;
    color: ${props => props.theme.colors.secundaryLight};
  }
`

export const SearchControl = styled.div`
  margin-top: 16px;
  .input-autocomplete {
    width: 100%;
    height: 44px;
    background: ${props => props.theme.colors?.backgroundPage || '#FFF'};
    border: 1px solid ${props => props.theme.colors.borderColor};
    border-radius: 8px;
    font-size: 14px;
    padding: 10px 15px;
    outline: none;
    ::placeholder {
      color: ${props => props.theme.colors.secundaryLight};
    }
    &:focus {
      border-color: ${() => darken(0.07, '#CCC')};
    }
  }
`

export const Status = styled.p`
  font-size: 14px;
  margin: 12px 0 0;
  color: ${props => props.theme.colors.secundaryLight};
`

export const Notice = styled.div`
  margin-top: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.$warning ? props.theme.colors.warning100 : props.theme.colors.danger100};
  p {
    margin: 0;
  }
  button {
    margin-top: 12px;
  }
`

export const Card = styled.div`
  margin-top: 16px;
  padding: 16px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  h3 {
    font-weight: 600;
    font-size: 14px;
    line-height: 24px;
    margin: 0 0 12px;
  }
`

export const Summary = styled.div`
  display: flex;
  gap: 16px;
  > img {
    width: 88px;
    height: 88px;
    object-fit: cover;
    border-radius: 8px;
    flex-shrink: 0;
  }
`

export const SummaryInfo = styled.div`
  min-width: 0;
  font-size: 14px;
  line-height: 22px;
  strong {
    display: block;
    font-size: 16px;
  }
  span, a {
    display: block;
    overflow-wrap: anywhere;
  }
  span {
    color: ${props => props.theme.colors.secundaryLight};
  }
  a {
    color: ${props => props.theme.colors.primary};
  }
`

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
  button {
    height: 44px;
    padding: 0 20px;
  }
`

export const ResultList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  li + li {
    border-top: 1px solid ${props => props.theme.colors.borderColor};
  }
`

export const ResultButton = styled.button`
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 10px 0;
  cursor: pointer;
  font-size: 14px;
  line-height: 22px;
  strong, span {
    display: block;
  }
  span {
    color: ${props => props.theme.colors.secundaryLight};
  }
  &:hover strong {
    color: ${props => props.theme.colors.primary};
  }
`

export const AppliedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
  line-height: 22px;
  strong, span {
    display: block;
  }
  span {
    color: ${props => props.theme.colors.secundaryLight};
  }
  button {
    flex-shrink: 0;
  }
`

export const Hint = styled.p`
  font-size: 13px;
  line-height: 20px;
  margin: 8px 0 0;
  color: ${props => props.theme.colors.secundaryLight};
`

export const SuggestionList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
`

export const SuggestionItem = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  background: ${props => props.theme.colors.backgroundInfo};
  & + & {
    margin-top: 8px;
  }
  > div {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  > div:last-child {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
`

export const PhotoSection = styled.div`
  margin-top: 20px;
  h4 {
    font-weight: 600;
    font-size: 14px;
    margin: 0;
  }
`

export const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 12px;
`

export const PhotoTile = styled.div`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  ${props => props.$selected && css`
    border-color: ${props.theme.colors.primary};
    box-shadow: 0 0 0 1px ${props.theme.colors.primary};
  `}
  img {
    display: block;
    width: 100%;
    height: 120px;
    object-fit: cover;
    border-radius: 7px 7px 0 0;
  }
  > div {
    padding: 8px;
  }
  .select {
    width: 100%;
    height: 36px;
    font-size: 13px;
    border: 1px solid ${props => props.theme.colors.borderColor};
    border-radius: 8px;
  }
`

export const PhotoAttribution = styled.small`
  display: block;
  font-size: 11px;
  line-height: 16px;
  margin-bottom: 6px;
  color: ${props => props.theme.colors.secundaryLight};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  a {
    color: inherit;
  }
`

export const CheckLabel = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 18px;
  margin: 12px 0 0;
  cursor: pointer;
  input {
    flex-shrink: 0;
  }
`

export const GoogleAttribution = styled.small`
  display: block;
  margin-top: 12px;
  font-size: 11px;
  color: ${props => props.theme.colors.secundaryLight};
`
