import React, { useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { BoxArrowUpRight, ExclamationCircle, Globe, InfoCircle, List as MenuIcon, Lock, Phone, Plus, Search } from 'react-bootstrap-icons'

import { BuilderProductsList as BuilderProductsListController, useEvent, useLanguage, useUtils } from '../../../../../index'
import { useInfoShare } from '../../../contexts/InfoShareContext'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'
import { Button, IconButton } from '../../../styles'
import { Pagination, SearchBar } from '../../Shared'
import { BuilderCreatePanel } from '../BuilderCreatePanel'
import { BuilderMessage, PlatformBuildIcon } from '../BuilderShared'
import {
  BUILDER_STATUS_OPTIONS,
  getDomainUrl,
  getPlatformBuilds,
  getProductApp,
  getProductDomains,
  getProductKind,
  getStatusLabel,
  getTypeLabel
} from '../utils'
import { TypeFilterMenu } from './TypeFilterMenu'
import {
  CreateButtonContent,
  DomainLink,
  FiltersRow,
  HeaderContainer,
  HeaderTitle,
  BannerAction,
  InfoBanner,
  NameCell,
  PageContainer,
  PaginationWrapper,
  Pill,
  PlatformList,
  SearchWrapper,
  SegmentButton,
  Segmented,
  SkeletonRow,
  Table,
  TableCard,
  MutedText
} from '../styles'

const BuilderProductsListUI = (props) => {
  const {
    productsState,
    pagination,
    filters,
    catalogState,
    createState,
    reloadProducts,
    reloadCatalog,
    handleChangeSearch,
    handleChangeType,
    handleChangeStatus,
    handleClearFilters,
    handleChangePage,
    handleChangePageSize,
    createProduct,
    resetCreateState
  } = props

  const [, t] = useLanguage()
  const [events] = useEvent()
  const [{ parseDate }] = useUtils()
  const [{ isCollapse }, { handleMenuCollapse }] = useInfoShare()
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const canCreate = !catalogState.loading && catalogState.canCreate
  const blockedKind = ['disabled', 'no_access'].includes(productsState.errorKind) ? productsState.errorKind : null
  const hasFilters = !!filters.search.trim() || filters.productTypes.length > 0 || filters.productStatus !== 'all'

  const openCreate = () => {
    resetCreateState()
    setIsCreateOpen(true)
  }

  // ⌘K "Create app" (`/builder?add=1`) opens the panel only when Create is offered
  useOpenFromQuery('add', openCreate, { ready: !catalogState.loading, accept: () => catalogState.canCreate })

  const goToProduct = (productId) => {
    events.emit('go_to_page', { page: 'builder_app', params: { productId } })
  }

  const handleProductLink = (e, productId) => {
    e.preventDefault()
    e.stopPropagation()
    goToProduct(productId)
  }

  const handleCreated = (product) => {
    setIsCreateOpen(false)
    goToProduct(product.id)
  }

  const formatDate = (value) => value ? parseDate(value, { outputFormat: 'MMM D, YYYY' }) : ''

  const renderBody = () => {
    if (productsState.loading) {
      return (
        <TableCard aria-busy='true'>
          {[...Array(5).keys()].map(i => (
            <SkeletonRow key={i}><Skeleton height={28} /></SkeletonRow>
          ))}
        </TableCard>
      )
    }
    if (productsState.errorKind) {
      return (
        <BuilderMessage
          role='alert'
          tone='error'
          icon={<ExclamationCircle aria-hidden='true' />}
          title={t('BUILDER_LOAD_ERROR', 'We couldn’t load your apps')}
          text={t('BUILDER_LOAD_ERROR_HELP', 'Check your connection and try again.')}
        >
          <Button color='primary' borderRadius='8px' onClick={reloadProducts}>{t('BUILDER_RETRY', 'Try again')}</Button>
        </BuilderMessage>
      )
    }
    if (!productsState.products.length) {
      return hasFilters
        ? (
          <BuilderMessage icon={<Search aria-hidden='true' />} title={t('BUILDER_NO_MATCHES', 'Nothing matches your search')}>
            <Button color='secundary' borderRadius='8px' onClick={handleClearFilters}>
              {t('BUILDER_CLEAR_FILTERS', 'Clear search and filters')}
            </Button>
          </BuilderMessage>
          )
        : (
          <BuilderMessage
            icon={<Phone aria-hidden='true' />}
            title={t('BUILDER_NO_PRODUCTS', 'Nothing here yet')}
            text={canCreate ? t('BUILDER_NO_PRODUCTS_HELP', 'Create an app or a website. It starts as a free draft.') : null}
          >
            {canCreate && (
              <Button color='primary' borderRadius='8px' onClick={openCreate}>{t('BUILDER_CREATE', 'Create')}</Button>
            )}
          </BuilderMessage>
          )
    }
    return (
      <TableCard>
        <Table>
          <thead>
            <tr>
              <th scope='col'>{t('NAME', 'Name')}</th>
              <th scope='col'>{t('TYPE', 'Type')}</th>
              <th scope='col'>{t('BUILDER_PLATFORMS', 'Platforms')}</th>
              <th scope='col'>{t('STATUS', 'Status')}</th>
              <th scope='col'>{t('CREATED', 'Created')}</th>
            </tr>
          </thead>
          <tbody>
            {productsState.products.map(product => {
              const app = getProductApp(product)
              const domain = getProductDomains(product)[0]
              return (
                <tr key={product.id} onClick={() => goToProduct(product.id)}>
                  <td>
                    <NameCell>
                      <a href={`/builder/${product.id}`} onClick={(e) => handleProductLink(e, product.id)}>{product.name}</a>
                      <span>{product.code}</span>
                    </NameCell>
                  </td>
                  <td>{getTypeLabel(product.product_type, t)}</td>
                  <td>
                    {getProductKind(product) === 'web'
                      ? (
                        <MutedText small style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Globe aria-hidden='true' />
                          {t('BUILDER_WEB', 'Web')}
                          {domain && (
                            <>
                              {' · '}
                              <DomainLink
                                href={getDomainUrl(domain.domain)}
                                target='_blank'
                                rel='noopener noreferrer'
                                onClick={(e) => e.stopPropagation()}
                              >
                                {domain.domain}
                                <BoxArrowUpRight aria-hidden='true' />
                                <span className='sr-only'>{t('BUILDER_OPENS_NEW_TAB', '(opens in a new tab)')}</span>
                              </DomainLink>
                            </>
                          )}
                        </MutedText>
                        )
                      : (
                        <PlatformList>
                          {getPlatformBuilds(app).map(item => (
                            <PlatformBuildIcon key={item.platform} platform={item.platform} status={item.status} />
                          ))}
                        </PlatformList>
                        )}
                  </td>
                  <td><Pill status={product.product_status}>{getStatusLabel(product.product_status, t)}</Pill></td>
                  <td><MutedText>{formatDate(product.created_at)}</MutedText></td>
                </tr>
              )
            })}
          </tbody>
        </Table>
        {pagination.totalPages > 0 && (
          <PaginationWrapper>
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              handleChangePage={handleChangePage}
              defaultPageSize={pagination.pageSize}
              handleChangePageSize={handleChangePageSize}
            />
          </PaginationWrapper>
        )}
      </TableCard>
    )
  }

  return (
    <PageContainer>
      <HeaderContainer>
        <HeaderTitle>
          {isCollapse && (
            <IconButton color='black' aria-label={t('OPEN_MENU', 'Open menu')} onClick={() => handleMenuCollapse(false)}>
              <MenuIcon />
            </IconButton>
          )}
          <div>
            <h1>{t('BUILDER', 'Builder')}</h1>
            <p>{t('BUILDER_SUBTITLE_WEBSITES', 'Create your apps and websites, edit them and follow their builds.')}</p>
          </div>
        </HeaderTitle>
        {canCreate && !blockedKind && (
          <Button color='primary' borderRadius='8px' onClick={openCreate}>
            <CreateButtonContent>
              <Plus aria-hidden='true' />
              {t('BUILDER_CREATE', 'Create')}
            </CreateButtonContent>
          </Button>
        )}
      </HeaderContainer>

      {blockedKind
        ? (
          <BuilderMessage
            icon={<Lock aria-hidden='true' />}
            title={blockedKind === 'disabled'
              ? t('BUILDER_DISABLED', 'Builder isn’t available here')
              : t('BUILDER_NO_ACCESS', 'You don’t have access to Builder')}
            text={blockedKind === 'disabled'
              ? t('BUILDER_DISABLED_HELP', 'Builder is turned off for this installation.')
              : t('BUILDER_NO_ACCESS_HELP', 'Only admins with edit permissions can create and manage apps. Ask a project owner for access.')}
          />
          )
        : (
          <>
            {!catalogState.loading && catalogState.unavailableReason === 'not_enabled' && (
              <InfoBanner>
                <InfoCircle aria-hidden='true' />
                <span>{t('BUILDER_CREATE_UNAVAILABLE', 'Creating apps from the dashboard isn’t turned on for this project yet. Contact Ordering support to turn it on.')}</span>
              </InfoBanner>
            )}
            {!catalogState.loading && catalogState.unavailableReason === 'empty' && (
              <InfoBanner>
                <InfoCircle aria-hidden='true' />
                <span>{t('BUILDER_CATALOG_EMPTY', 'There’s nothing to create right now. New app types will appear here when they’re available.')}</span>
              </InfoBanner>
            )}
            {!catalogState.loading && catalogState.unavailableReason === 'error' && (
              <InfoBanner role='alert'>
                <ExclamationCircle aria-hidden='true' />
                <span>{t('BUILDER_CATALOG_ERROR', 'We couldn’t check what you can create.')}</span>
                <BannerAction type='button' onClick={reloadCatalog}>{t('BUILDER_RETRY', 'Try again')}</BannerAction>
              </InfoBanner>
            )}

            <FiltersRow>
              <SearchWrapper>
                <SearchBar
                  lazyLoad
                  search={filters.search}
                  onSearch={handleChangeSearch}
                  placeholder={t('BUILDER_SEARCH', 'Search by name')}
                />
              </SearchWrapper>
              <TypeFilterMenu value={filters.productTypes} onChange={handleChangeType} />
              <Segmented role='group' aria-label={t('STATUS', 'Status')}>
                <SegmentButton type='button' active={filters.productStatus === 'all'} aria-pressed={filters.productStatus === 'all'} onClick={() => handleChangeStatus('all')}>
                  {t('ALL', 'All')}
                </SegmentButton>
                {BUILDER_STATUS_OPTIONS.map(option => (
                  <SegmentButton
                    key={option.value}
                    type='button'
                    active={filters.productStatus === option.value}
                    aria-pressed={filters.productStatus === option.value}
                    onClick={() => handleChangeStatus(option.value)}
                  >
                    {option.label(t)}
                  </SegmentButton>
                ))}
              </Segmented>
            </FiltersRow>

            {renderBody()}
          </>
          )}

      {isCreateOpen && (
        <BuilderCreatePanel
          catalogState={catalogState}
          createState={createState}
          createProduct={createProduct}
          onCreated={handleCreated}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </PageContainer>
  )
}

export const BuilderProducts = (props) => {
  const listProps = {
    ...props,
    UIComponent: BuilderProductsListUI
  }
  return <BuilderProductsListController {...listProps} />
}
