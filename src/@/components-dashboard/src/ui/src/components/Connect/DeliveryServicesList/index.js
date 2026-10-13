import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import FaStoreAlt from '@meronex/icons/fa/FaStoreAlt'
import { Button, Switch } from '../../../styles'
import { Pagination } from '../../Shared'
import { addQueryToUrl, optimizeImage } from '../../../utils'

import {
  DeliveryServicesContainer,
  TableWrapper,
  GroupsTable,
  GroupNameContainer,
  ConnectToContainer,
  WrapperImage,
  Image,
  InfoBlock,
  ActionsContainer,
  EnableWrapper,
  PagesBottomContainer,
  GroupIdWrapper
} from './styles'
import { useTheme } from 'styled-components'
import FaUserAlt from '@meronex/icons/fa/FaUserAlt'

export const DeliveryServicesList = (props) => {
  const {
    deliveryServicesState,
    searchValue,
    handleOpenDetails,
    handleUpdateDeliveryService,
    actionDisabled,
    isUseQuery,
    deliveryServiceId,
    handleInstallSysPlugin
  } = props

  const [, t] = useLanguage()
  const theme = useTheme()
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10

  // Change page
  const [currentPage, setCurrentPage] = useState(Number(defaultPage) || 1)
  const [companiesPerPage, setCompaniesPerPage] = useState(Number(defaultPageSize) || 10)

  // Get current groups
  const [currentCompanies, setCurrentCompanies] = useState([])
  const [totalPages, setTotalPages] = useState(null)

  const handleChangePage = (page) => {
    setCurrentPage(page)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(((currentPage - 1) * companiesPerPage + 1) / pageSize)
    setCurrentPage(expectedPage)
    setCompaniesPerPage(pageSize)
  }

  useEffect(() => {
    if (deliveryServicesState.loading) return
    let _totalPages
    let companies = []
    if (searchValue) {
      companies = deliveryServicesState.companies.filter(plugin => plugin.name?.toLowerCase().includes(searchValue?.toLowerCase()))
    } else {
      companies = [...deliveryServicesState.companies]
    }
    if (companies.length > 0) {
      _totalPages = Math.ceil(companies.length / companiesPerPage)
    }
    const indexOfLastPost = currentPage * companiesPerPage
    const indexOfFirstPost = indexOfLastPost - companiesPerPage
    const _currentcompanies = companies.slice(indexOfFirstPost, indexOfLastPost)
    setTotalPages(_totalPages)
    setCurrentCompanies(_currentcompanies)
  }, [deliveryServicesState, currentPage, companiesPerPage, searchValue])

  const handleClickDeliveryService = (e, group) => {
    const isInvalid = e.target.closest('.group-checkbox') || e.target.closest('.group-enabled')
    if (isInvalid) return
    handleOpenDetails(group)
  }

  useEffect(() => {
    if (!isUseQuery || !currentPage || !companiesPerPage || !totalPages) return
    addQueryToUrl({
      page: currentPage,
      pageSize: companiesPerPage
    })
  }, [currentPage, companiesPerPage, totalPages])

  return (
    <>
      <DeliveryServicesContainer>
        <TableWrapper>
          <GroupsTable data-tour='tour_delivery_completed'>
            <thead>
              <tr>
                <th>
                  <GroupIdWrapper>
                    <span>{t('ID', 'ID')}</span>
                  </GroupIdWrapper>
                </th>
                <th>
                  <GroupNameContainer isHeader>
                    <p>{t('DELIVERY_COMPANY', 'Delivery Company')}</p>
                  </GroupNameContainer>
                </th>
                <th>
                  <ConnectToContainer isHeader>
                    {t('CONNECT_TO', 'Connect to')}
                  </ConnectToContainer>
                </th>
                <th>
                  <ActionsContainer>
                    {t('ACTIONS', 'Actions')}
                  </ActionsContainer>
                </th>
              </tr>
            </thead>
            {deliveryServicesState.loading
              ? (
                  [...Array(companiesPerPage).keys()].map(i => (
                  <tbody key={i}>
                    <tr>
                      <td>
                        <GroupIdWrapper>
                          <Skeleton width={40} style={{ margin: '0px 5px' }} />
                        </GroupIdWrapper>
                      </td>
                      <td>
                        <ConnectToContainer>
                          <Skeleton width={36} height={36} style={{ marginRight: 5 }} />
                          <InfoBlock>
                            <p><Skeleton width={100} /></p>
                            <p><Skeleton width={80} /></p>
                          </InfoBlock>
                        </ConnectToContainer>
                      </td>
                      <td>
                        <GroupNameContainer>
                          <Skeleton width={100} />
                        </GroupNameContainer>
                      </td>
                      <td>
                        <ActionsContainer>
                          <EnableWrapper>
                            <Skeleton width={50} />
                          </EnableWrapper>
                        </ActionsContainer>
                      </td>
                    </tr>
                  </tbody>
                  ))
                )
              : (
                  currentCompanies.map(company => (
                  <tbody
                    key={company.id}
                    className={company.id === parseInt(deliveryServiceId) ? 'active' : null}
                    onClick={e => handleClickDeliveryService(e, company)}
                  >
                    <tr>
                      <td>
                        <GroupIdWrapper>
                          <span>{company?.id}</span>
                        </GroupIdWrapper>
                      </td>
                      <td>
                        <GroupNameContainer>
                          <WrapperImage>
                            {company?.logo
                              ? (
                                <Image bgimage={optimizeImage(company?.logo || theme.images?.dummies?.businessLogo, 'h_200,c_limit')} />
                                )
                              : (
                                <FaUserAlt />
                                )}
                          </WrapperImage>
                          <p>{company?.name}</p>
                        </GroupNameContainer>
                      </td>
                      <td>
                        <ConnectToContainer>
                          {company?.driver_groups?.[0]?.business?.slice(0, 5).map(business => (
                            <div key={business?.id}>
                              <WrapperImage>
                                {business?.logo
                                  ? (
                                    <Image bgimage={business.logo} />
                                    )
                                  : (
                                    <FaStoreAlt />
                                    )}
                              </WrapperImage>
                            </div>
                          ))}
                          {company?.connect_to?.length > 5 && (
                            <div>
                              {t('LENGTH_BUSINESS_MORE', '...(_length_ business more)').replace('_length_', company?.connect_to?.length - 5)}
                            </div>
                          )}
                        </ConnectToContainer>
                      </td>
                      <td>
                        <ActionsContainer>
                          <EnableWrapper className='group-enabled'>
                            <span>{t('ENABLE', 'Enable')}</span>
                            <Switch
                              disabled={actionDisabled || !company?.plugin_id}
                              defaultChecked={company?.enabled}
                              onChange={enabled => handleUpdateDeliveryService?.(deliveryServiceId, { enabled })}
                            />
                          </EnableWrapper>
                        </ActionsContainer>
                      </td>
                      <td>
                        <ActionsContainer>
                          {company?.plugin_id
                            ? (
                              <span>{t('SYSTEM_PLUGIN_INSTALLED', 'Installed')}</span>
                              )
                            : (
                              <Button
                                borderRadius='8px'
                                color='lightPrimary'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleInstallSysPlugin(company.plugin_root, () => window.location.reload())
                                }}
                              >
                                <span>{t('INSTALL', 'Install')}</span>
                              </Button>
                              )}
                        </ActionsContainer>
                      </td>
                    </tr>
                  </tbody>
                  ))
                )}
          </GroupsTable>
        </TableWrapper>
        {!deliveryServicesState.loading && (
          <PagesBottomContainer>
            {currentCompanies?.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                handleChangePage={handleChangePage}
                defaultPageSize={companiesPerPage}
                handleChangePageSize={handleChangePageSize}
              />
            )}
          </PagesBottomContainer>
        )}
      </DeliveryServicesContainer>
    </>
  )
}
