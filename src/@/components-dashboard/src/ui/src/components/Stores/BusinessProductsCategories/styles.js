import styled, { css } from 'styled-components'

export const CategoryListContainer = styled.div`
  width: 100%;
`

export const HeaderContainer = styled.div`
  display: flex;
  align-items: center;

  h1 {
    font-weight: 600;
    font-size: 14px;
    margin: 0;
  }
`
export const ListContent = styled.div`
    margin-top: 35px;
    max-height: calc(100vh - 380px);
  ${props => props.productLayout && css`
    margin-top: 0px;
    max-height: 40vh;
    height: 40vh;
  `}
  overflow: auto;

  ${props => props.theme.rtl
? css`
      padding-left: 18px;`
    : css`
      padding-right: 18px;`
  }

  @media (max-width: 576px) {
    padding: 0px;
  }

  @media (min-width: 768px) {
    max-height: calc(100vh - 240px);
  }
`

export const AddCategoryWrapper = styled.div`
  margin: 15px 10px;
`

export const CategoryTab = styled.div`
  padding: 10px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-left: ${props => props.categorySpace ?? 0}px;
  border-radius: 8px;

  ${({ active }) => active && css`
    background: ${props => props.theme.colors.lightPrimary};
    border: 1px solid ${props => props.theme.colors.primary};
    box-sizing: border-box;
    .actions-btn {
      display: block;
    }
  `}

  &:hover {
    background: ${props => props.theme.colors.lightPrimary};
  }
`

export const CategoryEnableWrapper = styled.div`
  display: flex;
  align-items: center;
  width: fit-content;
  span {
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};
    font-size: 12px;
    margin: 0px;
    ${props => props.theme?.rtl
? css`
      padding-left: 10px;
    `
: css`
      padding-right: 10px;
    `}
  }
`

export const SelectedCategoriesWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: #F8F9FA;
  border-radius: 8px;
  height: 44px;
  padding: 15px;
  cursor: pointer;
  margin-bottom: 10px;
  p {
    margin: 0px;
    font-size: 14px;
  }
`

export const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  background: #F8F9FA;
  border-radius: 8px;
  padding: 10px 15px;
  margin-bottom: 15px;
  gap: 10px;

  svg {
    color: ${props => props.theme.colors.secundaryLight};
    font-size: 18px;
    flex-shrink: 0;
  }

  input {
    border: none;
    background: transparent;
    outline: none;
    width: 100%;
    font-size: 14px;
    color: ${props => props.theme.colors.headingColor};

    &::placeholder {
      color: ${props => props.theme.colors.secundaryLight};
    }
  }
`
