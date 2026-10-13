import React, { useState, useEffect } from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'
import { Switch, LinkButton } from '../../../styles'
import { ColumnAllowSettingPopover, Pagination, Modal } from '../../Shared'
import { addQueryToUrl } from '../../../utils'

import {
  Container,
  Table,
  Tbody,
  PagesBottomContainer,
  SwitchWrapper,
  StatusWrapper,
  StatusPoint,
  LinkText
} from './styles'
import { CampaignUserList } from '../CampaignUsersList'

export const CampaignList = (props) => {
  const {
    campaignList,
    getCampaignList,
    paginationProps,
    setPaginationProps,
    handleOpenDetail,
    selectedCampaign,
    handleUpdateCampaign,
    setSelectedCampaign,
    isUseQuery
  } = props

  const hideUnsubscribedAndBouncesColumns = true

  const [, t] = useLanguage()
  const [openModal, setOpenModal] = useState(false)
  const [openUnsubscribed, setOpenUnsubscribed] = useState(false)
  const [openBounced, setOpenBounced] = useState(false)

  const [allowColumns, setAllowColumns] = useState({
    campaign: true,
    contact_type: true,
    audience: true,
    in_queue: true,
    sent_count: true,
    open_count: true,
    unsubscribed_count: !hideUnsubscribedAndBouncesColumns,
    bounced_count: !hideUnsubscribedAndBouncesColumns
    // update: true,
    // actions: true
  })

  const optionsDefault = [
    {
      value: 'campaign',
      content: t('CAMPAIGN', 'Campaign')
    },
    {
      value: 'contact_type',
      content: t('CONTACT_TYPE', 'Contact type')
    },
    {
      value: 'audience',
      content: t('AUDIENCE', 'Audience')
    },
    {
      value: 'in_queue',
      content: t('IN_QUEUE', 'In Queue')
    },
    {
      value: 'sent_count',
      content: t('SENT', 'Sent')
    },
    {
      value: 'open_count',
      content: t('OPENS', 'Opens')
    },
    ...(!hideUnsubscribedAndBouncesColumns
      ? [
          {
            value: 'unsubscribed_count',
            content: t('UNSUBSCRIBED', 'Unsubscribed')
          },
          {
            value: 'bounced_count',
            content: t('BOUNCES', 'Bounces')
          }
        ]
      : [])
    // {
    //   value: 'update',
    //   content: t('UPDATE', 'Update')
    // },
    // {
    //   value: 'actions',
    //   content: t('ACTIONS', 'Actions')
    // }
  ]

  const checkColor = (status) => {
    const index = status.toLocaleLowerCase()
    if (index === 'ended') return '#00D27A'
    else if (index === 'scheduled') return '#FFC700'
    else if (index === 'draft') return '#E9ECEF'
    else return '#E9ECEF'
  }

  const handleChangeAllowColumns = (type) => {
    setAllowColumns({
      ...allowColumns,
      [type]: !allowColumns[type]
    })
  }

  const handleChangePage = (page) => {
    getCampaignList(page, paginationProps?.pageSize)
  }

  const handleChangePageSize = (pageSize) => {
    const expectedPage = Math.ceil(paginationProps.from / pageSize)
    setPaginationProps({ ...paginationProps, pageSize })
    getCampaignList(expectedPage, pageSize)
  }

  const handleClickCampaign = (e, campaign) => {
    const inValid = e.target.closest('.enable_control') || e.target.closest('.opens')
    if (inValid) return
    handleOpenDetail(campaign)
  }

  const handleOpens = (campaign) => {
    setSelectedCampaign(campaign)
    setOpenModal(true)
  }

  const handleOpenUnsubscribed = (campaign) => {
    setSelectedCampaign(campaign)
    setOpenUnsubscribed(true)
  }

  const handleOpenBounced = (campaign) => {
    setSelectedCampaign(campaign)
    setOpenBounced(true)
  }

  useEffect(() => {
    if (campaignList?.loading || campaignList?.campaigns?.length > 0 || paginationProps?.totalPages <= 1) return
    if (paginationProps?.currentPage !== paginationProps?.totalPages) {
      handleChangePage(paginationProps?.currentPage)
    } else {
      handleChangePage(paginationProps?.currentPage - 1)
    }
  }, [campaignList?.campaigns, paginationProps])

  useEffect(() => {
    if (!isUseQuery || !paginationProps?.currentPage || !paginationProps?.pageSize || !paginationProps?.totalPages) return
    addQueryToUrl({
      page: paginationProps.currentPage,
      pageSize: paginationProps.pageSize
    })
  }, [paginationProps?.currentPage, paginationProps?.pageSize, paginationProps?.totalPages])

  return (
    <>
      <Container>
        <Table isRelative={campaignList?.campaigns?.length > 5}>
          <thead>
            <tr>
              {allowColumns?.campaign && (
                <th>{t('CAMPAIGN', 'Campaign')}</th>
              )}
              {allowColumns?.contact_type && (
                <th>{t('CONTACT_TYPE', 'Contact type')}</th>
              )}
              {allowColumns?.audience && (
                <th>{t('AUDIENCE', 'Audience')}</th>
              )}
              {allowColumns?.in_queue && (
                <th>{t('IN_QUEUE', 'In Queue')}</th>
              )}
              {allowColumns?.sent_count && (
                <th>{t('SENT', 'Sent')}</th>
              )}
              {allowColumns?.open_count && (
                <th>{t('OPENS', 'Opens')}</th>
              )}
              {!hideUnsubscribedAndBouncesColumns && allowColumns?.unsubscribed_count && (
                <th>{t('UNSUBSCRIBED', 'Unsubscribed')}</th>
              )}
              {!hideUnsubscribedAndBouncesColumns && allowColumns?.bounced_count && (
                <th>{t('BOUNCES', 'Bounces')}</th>
              )}
              <th className='allow-colums action'>
                <ColumnAllowSettingPopover
                  allowColumns={allowColumns}
                  optionsDefault={optionsDefault}
                  handleChangeAllowColumns={handleChangeAllowColumns}
                  title={t('DISPLAYED_DATA_THE_ORDER', 'Displayed data the order')}
                />
              </th>
            </tr>
          </thead>
          {campaignList?.loading
            ? (
                [...Array(8).keys()].map(i => (
              <Tbody key={i}>
                <tr>
                  {allowColumns?.campaign && (
                    <td>
                      <Skeleton width={120} height={20} />
                    </td>
                  )}
                  {allowColumns?.contact_type && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {allowColumns?.audience && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {allowColumns?.in_queue && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {allowColumns?.sent_count && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {allowColumns?.open_count && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {!hideUnsubscribedAndBouncesColumns && allowColumns?.unsubscribed_count && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  {!hideUnsubscribedAndBouncesColumns && allowColumns?.bounced_count && (
                    <td>
                      <Skeleton width={100} height={20} />
                    </td>
                  )}
                  <td>
                    <SwitchWrapper>
                      <p className='campaign-enabled'><Skeleton width={80} height={20} /></p>
                      <Skeleton width={40} height={20} />
                    </SwitchWrapper>
                  </td>
                </tr>
              </Tbody>
                ))
              )
            : (
                campaignList?.campaigns.map((campaign, i) => (
              <Tbody
                key={i}
                className={selectedCampaign?.id === campaign.id && campaign?.status !== 'ended' ? 'active' : ''}
                onClick={(e) => campaign?.status === 'ended' ? null : handleClickCampaign(e, campaign)}
                isDisabled={campaign?.status === 'ended'}
              >
                <tr>
                  {allowColumns?.campaign && (
                    <td className='right-border'>
                      <div>
                        <p className='bold'>{campaign?.name}</p>
                      </div>
                    </td>
                  )}
                  {allowColumns?.contact_type && (
                    <td>{campaign?.contact_type}</td>
                  )}
                  {allowColumns?.audience && (
                    <td>{campaign?.audience_type}</td>
                  )}
                  {allowColumns?.in_queue && (
                    <td>
                      {
                        ((typeof campaign?.audience_count !== 'undefined') && (typeof campaign?.sent_count !== 'undefined'))
                          ? (campaign?.audience_count - campaign?.sent_count)
                          : 0
                      }
                    </td>
                  )}
                  {allowColumns?.sent_count && (
                    <td>{(campaign?.contact_type === 'sms' || campaign?.contact_type === 'push') ? t('NA', 'N/A') : (campaign?.sent_count || 0)}</td>
                  )}
                  {allowColumns?.open_count && (
                    <td>
                      {(campaign?.contact_type === 'sms' || campaign?.contact_type === 'push')
                        ? t('NA', 'N/A')
                        : (
                          <LinkText isDisabled={campaign?.open_count < 1} onClick={() => campaign?.open_count > 0 && handleOpens(campaign)} className='opens'>
                            {campaign?.open_count || 0}
                          </LinkText>
                          )}
                    </td>
                  )}
                  {!hideUnsubscribedAndBouncesColumns && allowColumns?.unsubscribed_count && (
                    <td>
                      {(campaign?.contact_type === 'sms' || campaign?.contact_type === 'push')
                        ? t('NA', 'N/A')
                        : (
                          <LinkText isDisabled={campaign?.unsubscribed_count < 1} onClick={() => campaign?.unsubscribed_count > 0 && handleOpenUnsubscribed(campaign)} className='opens'>
                            {campaign?.unsubscribed_count || 0}
                          </LinkText>
                          )}
                    </td>
                  )}
                  {!hideUnsubscribedAndBouncesColumns && allowColumns?.bounced_count && (
                    <td>
                      {(campaign?.contact_type === 'sms' || campaign?.contact_type === 'push')
                        ? t('NA', 'N/A')
                        : (
                          <LinkText isDisabled={campaign?.bounced_count < 1} onClick={() => campaign?.bounced_count > 0 && handleOpenBounced(campaign)} className='opens'>
                            {campaign?.bounced_count || 0}
                          </LinkText>
                          )}
                    </td>
                  )}
                  <td>
                    {campaign?.audience_type === 'dynamic' && campaign?.status !== 'ended' && (
                      <SwitchWrapper>
                        <p className='campaign-enabled'>{t('ENABLE', 'Enable')}</p>
                        <Switch
                          defaultChecked={campaign?.enabled}
                          onChange={val => handleUpdateCampaign(campaign.id, { enabled: val })}
                          className='enable_control'
                        />
                      </SwitchWrapper>
                    )}
                    {(campaign?.audience_type === 'fixed' || campaign?.status === 'ended') && (
                      <StatusWrapper>
                        <p>{campaign?.status}</p>
                        <StatusPoint style={{ background: checkColor(campaign?.status) }} />
                      </StatusWrapper>
                    )}
                  </td>
                </tr>
              </Tbody>
                ))
              )}
        </Table>
      </Container>
      {!campaignList.loading && (
        <PagesBottomContainer>
          <LinkButton
            onClick={() => handleOpenDetail({})}
          >
            {t('ADD_NEW_CAMPAIGN', 'Add new campaign')}
          </LinkButton>
          {campaignList?.campaigns?.length > 0 && (
            <Pagination
              currentPage={paginationProps?.currentPage}
              totalPages={paginationProps?.totalPages}
              handleChangePage={handleChangePage}
              defaultPageSize={paginationProps?.pageSize}
              handleChangePageSize={handleChangePageSize}
            />
          )}
        </PagesBottomContainer>
      )}
      {openModal && (
        <Modal
          width='700px'
          height='80vh'
          padding='30px'
          open={openModal}
          onClose={() => setOpenModal(false)}
        >
          <CampaignUserList
            isOpens
            title={t('OPENS', 'Opens')}
            campaignId={selectedCampaign?.id}
          />
        </Modal>
      )}
      {openUnsubscribed && (
        <Modal
          width='700px'
          height='80vh'
          padding='30px'
          open={openUnsubscribed}
          onClose={() => setOpenUnsubscribed(false)}
        >
          <CampaignUserList
            title={t('UNSUBSCRIBED', 'Unsubscribed')}
            campaignId={selectedCampaign?.id}
          />
        </Modal>
      )}
      {openBounced && (
        <Modal
          width='700px'
          height='80vh'
          padding='30px'
          open={openBounced}
          onClose={() => setOpenBounced(false)}
        >
          <CampaignUserList
            isBounces
            title={t('BOUNCES', 'Bounces')}
            campaignId={selectedCampaign?.id}
          />
        </Modal>
      )}
    </>
  )
}
