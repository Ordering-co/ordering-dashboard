import React from 'react'

import { useLanguage } from '../../../../../index'
import { CircleAlert, Maximize2, Minimize2, Star } from '../../Shared/Icon'
import { Avatar, Button, EmptyState, IconButton, RecordPanel, Skeleton, useSplitView } from '../../Shared/Product'
import { ReviewRating } from './ReviewRating'
import './reviews-panel.css'

const SKELETON_BLOCKS = 3

const ReviewsSkeleton = ({ label }) => (
  <div className='odc-rv-skeleton' role='status' aria-busy='true' aria-label={label}>
    {Array.from({ length: SKELETON_BLOCKS }, (_, index) => (
      <div key={index} className='odc-rv-skeleton-item'>
        <Skeleton size='40%' />
        <Skeleton size='100%' />
        <Skeleton size='70%' />
      </div>
    ))}
  </div>
)

/**
 * The shell of the three panels of /intelligence/reviews (redesign reviews FC, D1, D4, D5, D8, D9; RV-02, RV-04, RV-09): one
 * RecordPanel inside the SplitView of the page, with the head of the record (picture, average, count and a `summary` slot), and the
 * four states of the list: loading (three skeleton blocks), error («Try again» calls `onRetry`, RV-08), empty (RV-09) and the list
 * (`children`: the `ReviewItem`s). Loading wins over error, and error over empty.
 *
 *  - `title` (a node: the name; `titleLoading` paints a skeleton in its place), `subtitle` (a node), `headerActions` (the actions of the panel);
 *  - `avatar`: `{ kind: 'business' | 'person', name, src }`;
 *  - `rating`: the average (number or `null`, which paints a dash); `undefined` paints none; `ratingDecimals`: 1 or 2;
 *  - `count`: how many reviews (shown when it is a number and the list is not loading or failed);
 *  - `expanded` and `onExpandedChange`: «Open as page», only when the host gives `onExpandedChange` (and not on a phone);
 *  - `loading`, `error`, `empty` (booleans), `onRetry`, `onClose`.
 */
export const ReviewPanel = ({
  title,
  titleLoading = false,
  subtitle,
  avatar,
  rating,
  ratingDecimals = 1,
  count,
  summary,
  headerActions,
  expanded = false,
  onExpandedChange,
  onClose,
  loading = false,
  error = false,
  empty = false,
  onRetry,
  children
}) => {
  const [, t] = useLanguage()
  const split = useSplitView()
  const phone = split.mode === 'full'

  const actions = (
    <>
      {headerActions}
      {!phone && onExpandedChange && (
        <IconButton
          icon={expanded ? Minimize2 : Maximize2}
          label={expanded ? t('BACK_TO_SPLIT_VIEW', 'Back to split view') : t('OPEN_AS_PAGE', 'Open as page')}
          onClick={() => onExpandedChange(!expanded)}
        />
      )}
    </>
  )

  const showCount = typeof count === 'number' && !loading && !error
  // «_count_ reviews»: the number goes in a figure, wherever the translation puts it
  const countText = count === 1 ? t('REVIEWS_COUNT_ONE', '_count_ review') : t('REVIEWS_COUNT_OTHER', '_count_ reviews')
  const [beforeCount, afterCount = ''] = String(countText).split('_count_')

  const showRating = rating !== undefined
  const hasHead = Boolean(avatar) || showRating || showCount

  let content
  if (loading) {
    content = <ReviewsSkeleton label={t('LOADING', 'Loading')} />
  } else if (error) {
    content = (
      <EmptyState
        tone='error'
        icon={CircleAlert}
        title={t('REVIEWS_LOAD_ERROR', "We couldn't load the reviews.")}
        action={onRetry && <Button onClick={onRetry}>{t('TRY_AGAIN', 'Try again')}</Button>}
      />
    )
  } else if (empty) {
    content = <EmptyState icon={Star} title={t('REVIEWS_EMPTY', 'No reviews yet')} />
  } else {
    content = <div className='odc-rv-list'>{children}</div>
  }

  return (
    <RecordPanel
      title={titleLoading ? <span className='odc-rv-title-skeleton'><Skeleton /></span> : title}
      subtitle={subtitle}
      closeLabel={phone ? t('BACK', 'Back') : t('CLOSE', 'Close')}
      onClose={onClose}
      headerActions={actions}
    >
      <div className='odc-rv-body'>
        {hasHead && (
          <div className='odc-rv-head'>
            {avatar && <Avatar kind={avatar.kind} size='lg' name={avatar.name} src={avatar.src} />}
            {(showRating || showCount) && (
              <div className='odc-rv-head-info'>
                {showRating && <ReviewRating value={rating} size='lg' decimals={ratingDecimals} />}
                {showCount && (
                  <span className='odc-rv-count'>
                    {beforeCount}<span className='odc-figure'>{count}</span>{afterCount}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {summary && <div className='odc-rv-summary'>{summary}</div>}
        {content}
      </div>
    </RecordPanel>
  )
}
