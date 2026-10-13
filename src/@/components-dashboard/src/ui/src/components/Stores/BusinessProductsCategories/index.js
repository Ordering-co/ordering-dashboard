import React, { useRef, useState, useEffect, useMemo } from 'react'
import { useLanguage } from '../../../../../index'
import { SingleBusinessSubCateogries } from '../SingleBusinessSubCateogries'
import { SingleBusinessSubCateogries as SingleBusinessSubCateogriesProductLayout } from '../SingleBusinessSubCateogries/ProductLayout'
import { LinkButton } from '../../../styles'
import { Pencil, Search } from 'react-bootstrap-icons'
import {
  CategoryListContainer,
  HeaderContainer,
  ListContent,
  AddCategoryWrapper,
  SelectedCategoriesWrapper,
  SearchWrapper
} from './styles'

export const BusinessProductsCategories = (props) => {
  const {
    businessState,
    categorySelected,
    handleChangeCategory,
    handleOpenCategoryDetails,
    categoryListRef,
    productLayout,
    product,
    handleUpdateClickProduct,
    productCategorySelected,
    handleCloseExtraOpen
  } = props

  const [, t] = useLanguage()
  const [dataSelected, setDataSelected] = useState('')
  const containerRef = useRef()
  const listRef = useRef()
  const addButtonRef = useRef()
  const [showCategories, setShowCategories] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const sortedCategories = useMemo(() => {
    return businessState?.business?.categories
      ? [...businessState.business.categories].sort((a, b) => a.rank - b.rank)
      : []
  }, [businessState?.business?.categories, categorySelected])

  const filterCategories = (categories, search) => {
    if (!search) return categories

    return categories.filter(category => {
      const matchesName = category?.name?.toLowerCase().includes(search.toLowerCase())
      const matchesSubcategories = category?.subcategories?.some(sub =>
        sub?.name?.toLowerCase().includes(search.toLowerCase())
      )
      return matchesName || matchesSubcategories
    })
  }

  const filteredCategories = useMemo(() => {
    return filterCategories(sortedCategories, searchValue)
  }, [sortedCategories, searchValue])

  useEffect(() => {
    let listener
    if (containerRef?.current && categoryListRef) {
      listener = window.addEventListener('click', (e) => {
        if (!containerRef?.current?.contains(e.target) && !addButtonRef?.current?.contains(e.target) && categoryListRef?.contains(e.target)) {
          handleChangeCategory(null, null)
        }
      })
    }
    return () => {
      window.removeEventListener('click', listener)
    }
  }, [containerRef?.current, categoryListRef])

  useEffect(() => {
    if (!productLayout) return

    const handleClickOutside = (e) => {
      if (containerRef?.current && !containerRef.current.contains(e.target)) {
        setShowCategories(false)
      }
    }

    if (showCategories) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCategories, productLayout])

  const SingleBusinessSubCateogriesComponent = productLayout ? SingleBusinessSubCateogriesProductLayout : SingleBusinessSubCateogries

  return (
    <>
      <CategoryListContainer ref={containerRef}>
        {!productLayout && (
          <HeaderContainer>
            <h1>{t('BUSINESS_CATEGORY', 'Business category')}</h1>
          </HeaderContainer>
        )}
        {
          productLayout && (
            <>
              <SelectedCategoriesWrapper onClick={() => setShowCategories(!showCategories)}>
                <p>{productCategorySelected?.name}</p>
                <Pencil />
              </SelectedCategoriesWrapper>
            </>
          )
        }
        {(showCategories || !productLayout) && (
          <>
            {productLayout && (
              <SearchWrapper>
                <Search />
                <input
                  type="text"
                  placeholder={t('SEARCH', 'Search')}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </SearchWrapper>
            )}
            <ListContent ref={listRef} productLayout={productLayout}>
              {businessState?.loading && (
                [...Array(6).keys()].map(i => (
                  <SingleBusinessSubCateogries key={i} isSkeleton />
                ))
              )}
              {!businessState?.loading && filteredCategories.length > 0 && (
                filteredCategories.map((category, i) => (
                  <SingleBusinessSubCateogriesComponent
                    {...props}
                    index={0}
                    key={category.id}
                    category={category}
                    categorySelected={categorySelected}
                    handleChangeCategory={handleChangeCategory}
                    business={businessState?.business}
                    dataSelected={dataSelected}
                    setDataSelected={setDataSelected}
                    isLastCategory={filteredCategories.length - 1 === i}
                    product={product}
                    handleUpdateClickProduct={handleUpdateClickProduct}
                    handleCloseExtraOpen={handleCloseExtraOpen}
                    />
                ))
              )}
              {!businessState?.loading && filteredCategories.length === 0 && searchValue && (
                <p style={{ padding: '20px', textAlign: 'center', color: '#909BA9' }}>
                  {t('NO_RESULTS_FOUND', 'No results found')}
                </p>
              )}
            </ListContent>
          </>
        )}
      </CategoryListContainer>
      {!productLayout && (
        <AddCategoryWrapper>
          <LinkButton
            ref={addButtonRef}
            onClick={() => handleOpenCategoryDetails()}
          >
            {t('ADD_NEW_CATEGORY', 'Add new category')}
          </LinkButton>
        </AddCategoryWrapper>
      )}
    </>
  )
}
