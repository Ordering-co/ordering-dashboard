import styled, { css } from 'styled-components'
import { ButtonLink, IconButton } from '../../../styles/Buttons'

export const FreeProductsListContainer = styled.div`
  flex: 1;
  min-width: 0;
  padding: 25px 20px;
  box-sizing: border-box;
  max-height: 100vh;
  overflow: auto;
  color: ${props => props.theme.colors.headingColor};
  background: ${props => props.theme.colors.backgroundPage};
  direction: ${props => props.theme.rtl ? 'rtl' : 'ltr'};
`
export const HeaderTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  h1 {
    font-size: 20px;
    font-weight: 700;
    line-height: 32px;
    margin: 0;
  }
`
export const MenuButton = styled(IconButton)`
  min-width: 44px;
  min-height: 44px;
  flex-shrink: 0;
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 3px;
  }
`
export const Intro = styled.p`
  font-size: 14px;
  line-height: 22px;
  margin: 8px 0 20px;
`
export const SignInNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  background: ${props => props.theme.colors.lightPrimary};
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 20px;
  svg {
    flex-shrink: 0;
    margin-top: 3px;
    color: ${props => props.theme.colors.primary};
  }
`
export const ProductsList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
`
export const ProductCard = styled.li`
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) 180px;
  align-items: center;
  gap: 24px;
  padding: 20px;
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 8px;
  @media (max-width: 1100px) {
    grid-template-columns: 112px minmax(0, 1fr) 160px;
    gap: 16px;
  }
  @media (max-width: 900px) {
    grid-template-columns: 112px minmax(0, 1fr);
  }
  @media (max-width: 600px) {
    grid-template-columns: minmax(0, 1fr);
    padding: 16px;
  }
`
export const ProductImage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  border-radius: 6px;
  background: ${props => props.theme.colors.secundary};
  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  > svg {
    width: 40px;
    height: 40px;
    color: ${props => props.theme.colors.primary};
  }
  @media (max-width: 600px) {
    height: 100px;
  }
`
export const ProductDescription = styled.div`
  min-width: 0;
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
  .brand, .platforms {
    font-size: 12px;
  }
  p {
    margin: 12px 0 8px;
  }
`
export const ProductTitle = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
  h2 {
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
    margin: 0;
  }
`
export const FreeBadge = styled.span`
  border: 1px solid ${props => props.theme.colors.borderColor};
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 22px;
  background: ${props => props.theme.colors.secundary};
`
export const ProductActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  @media (min-width: 601px) and (max-width: 900px) {
    grid-column: 2;
  }
  @media (max-width: 600px) {
    flex-direction: row;
    flex-wrap: wrap;
  }
`
export const DownloadLink = styled(ButtonLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 4px;
  line-height: 20px;
  white-space: normal;
  overflow: visible;
  color: ${props => props.theme.colors.headingColor};
  svg {
    flex-shrink: 0;
    font-size: 16px;
  }
  &:hover, &:active {
    color: ${props => props.theme.colors.headingColor};
    background: ${props => props.theme.colors.lightPrimary};
  }
  &:focus-visible {
    outline: 2px solid ${props => props.theme.colors.primary};
    outline-offset: 3px;
  }
  ${({ $web }) => $web && css`
    background: ${props => props.theme.colors.btnSecondary};
    border-color: ${props => props.theme.colors.btnSecondary};
    color: ${props => props.theme.colors.btnSecondaryContrast};
    &:hover, &:active {
      background: ${props => props.theme.colors.btnSecondary};
      color: ${props => props.theme.colors.btnSecondaryContrast};
    }
  `}
  @media (max-width: 600px) {
    flex: 1 1 120px;
  }
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
export const BrandNote = styled.p`
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 20px;
`
