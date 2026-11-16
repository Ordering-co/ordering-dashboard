import React, { useState, useEffect } from 'react'
import { useEvent, useLanguage, useSession } from '../../../../../index'
import { groupName, managerText, typeLabel } from '../../Delivery/DriversGroupsDirectory/groupData'
import { Button, DataTable, EmptyState, Pagination, RecordCardList, Status } from '../../Shared/Product'
import { useIsPhone } from '../../Shared/Product/useIsPhone'
import { TriangleAlert, Users } from '../../Shared/Icon'
import { translateApiMessage } from '../../../../../utils/translateApiMessage'
import { useStoreDriverGroups } from './useStoreDriverGroups'
import './business-delivery-groups-details.css'

// redesign stores 5.7 (G3-27): «This business is in the following driver groups» lists the groups the store is in, and only those
// (the old list drew every group of the project). It is read-only: the groups are managed in Delivery > Driver groups, so there is
// no selection, no switch, no add button and no row or card that opens anything (`?id=` is the store here, not a group).
// J2 row 19 (stores-5-7-delivery-forms P-1): «Manage driver groups» leads there, for the levels that may open that page (App.js:
// /delivery/drivers-groups is [0, 5]).
const MANAGE_GROUPS_LEVELS = [0, 5]
const PAGE_SIZE = 10

const fill = (text, values) => Object.keys(values).reduce((result, key) => result.replace(`_${key}_`, values[key]), text)

export const DriversGroupsListingDetails = (props) => {
  const { business } = props
  const [, t] = useLanguage()
  const isPhone = useIsPhone()
  const [{ user } = {}] = useSession() || []
  const [events] = useEvent() || []
  const canManageGroups = MANAGE_GROUPS_LEVELS.includes(user?.level)
  const { groups, loading, error, reload } = useStoreDriverGroups(business)
  const [page, setPage] = useState(1)
  // A new answer (the first one, or a retry) starts on page 1: the old page may no longer exist
  useEffect(() => { setPage(1) }, [groups])

  const listLabel = t('DELIVERY_GROUPS', 'Delivery groups')
  const loadingLabel = t('DRIVERS_GROUPS_LOADING', 'Loading groups')
  const pageGroups = groups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const statusCell = (group) => (group.enabled
    ? <Status family='done' label={t('ENABLED', 'Enabled')} />
    : <Status family='cancel' label={t('DISABLED', 'Disabled')} />)

  const groupCell = (group) => {
    const name = groupName(group, t)
    return (
      <span className='odc-sdg-who'>
        <strong className='odc-sdg-name' dir='auto' title={name}>{name}</strong>
        <span className='odc-sdg-sub'>
          <bdi dir='ltr' className='odc-figure'>{`#${group.id}`}</bdi>
          {' · '}
          <span dir='auto'>{managerText(group, t)}</span>
        </span>
      </span>
    )
  }

  const columns = [
    { id: 'group', header: t('GROUP', 'Group'), rowHeader: true, wrap: true, locked: true, skeleton: { lines: 2 }, cell: groupCell },
    { id: 'type', header: t('TYPE', 'Type'), skeleton: { lines: 1 }, cell: group => <span className='odc-sdg-type'>{typeLabel(group, t)}</span> },
    { id: 'status', header: t('STATUS', 'Status'), skeleton: { lines: 1, lead: 'dot' }, cell: statusCell }
  ]

  // Cards (under 768px): the same data, non-interactive. No `href` and no `onOpen`: the card is not a link.
  const toCard = (group) => {
    const name = groupName(group, t)
    return {
      id: group.id,
      label: name,
      title: <span className='odc-sdg-card-name' dir='auto' title={name}>{name}</span>,
      status: statusCell(group),
      from: (
        <span className='odc-sdg-card-meta'>
          <bdi dir='ltr' className='odc-figure'>{`#${group.id}`}</bdi>
          {typeLabel(group, t) && ` · ${typeLabel(group, t)}`}
        </span>
      ),
      assignee: <span dir='auto'>{managerText(group, t)}</span>
    }
  }

  let content
  if (!loading && error) {
    // A failure is not an empty list: it says so and offers to try again.
    content = (
      <EmptyState
        tone='error'
        icon={TriangleAlert}
        title={t('STORE_DRIVER_GROUPS_LOAD_ERROR', "We couldn't load the driver groups.")}
        description={translateApiMessage(t, error, undefined)}
        action={<Button onClick={() => reload()}>{t('RETRY', 'Retry')}</Button>}
      />
    )
  } else if (!loading && groups.length === 0) {
    content = (
      <EmptyState
        icon={Users}
        title={t('STORE_DRIVER_GROUPS_EMPTY', "This store isn't in any driver group.")}
      />
    )
  } else if (isPhone) {
    content = (
      <div className='odc-sdg-cards'>
        <RecordCardList
          label={listLabel}
          items={loading ? [] : pageGroups.map(toCard)}
          loading={loading}
          loadingLabel={loadingLabel}
          skeletonCount={3}
        />
      </div>
    )
  } else {
    content = (
      <DataTable
        label={listLabel}
        columns={columns}
        rows={pageGroups}
        getRowId={group => group.id}
        loading={loading}
        loadingLabel={loadingLabel}
        skeletonRows={3}
      />
    )
  }

  return (
    <>
      <div className='odc-sdg-head'>
        <p className='odc-sdg-description'>{t('BUSINESS_IN_FOLLOWING_DRIVER_GROUPS', 'This business is in the following driver groups')}</p>
        {canManageGroups && (
          <Button variant='link' onClick={() => events?.emit('go_to_page', { page: 'drivers_groups' })}>
            {t('MANAGE_DRIVER_GROUPS', 'Manage driver groups')}
          </Button>
        )}
      </div>
      {/* The anchor of the tour sits on the container of the list, whatever the list is drawing */}
      <div className='odc-sdg-list' data-tour='tour_delivery_completed'>
        {content}
        {!loading && !error && groups.length > PAGE_SIZE && (
          <div className='odc-sdg-foot'>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={groups.length}
              onPageChange={setPage}
              label={t('PAGINATION', 'Pagination')}
              previousLabel={t('PREVIOUS_PAGE', 'Previous page')}
              nextLabel={t('NEXT_PAGE', 'Next page')}
              pageOfLabel={(totalPages, figureOf) => fill(t('PAGE_OF_TOTAL', 'of _total_'), { total: figureOf(totalPages) })}
              rangeLabel={(from, to, total, figureOf) => fill(t('SHOWING_RANGE', 'Showing _from_–_to_ of _total_'), { from: figureOf(from), to: figureOf(to), total: figureOf(total) })}
              pageStatusLabel={(current, totalPages) => t('PAGE_STATUS', 'Page _page_ of _total_').replace('_page_', String(current)).replace('_total_', String(totalPages))}
            />
          </div>
        )}
      </div>
    </>
  )
}
