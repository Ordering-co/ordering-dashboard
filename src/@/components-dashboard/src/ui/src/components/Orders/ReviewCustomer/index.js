import React, { useState, useEffect, useId, useRef } from 'react'
import {
  useLanguage,
  useUtils,
  ReviewCustomer as ReviewCustomerController
} from '../../../../../index'
import { Avatar, Button, Dialog } from '../../Shared/Product'
import { Check } from '../../Shared/Icon'
import { AlertDialog } from '../../Shared/Product/AlertDialog'
import { reviewCommentList } from '../../../utils'

import './review-customer.css'

/**
 * The customer review as a Product Dialog (redesign 5.4-B). The scale is a native radio group (five
 * marks are more than a SegmentedControl takes) whose values are the same 1..5 the payload carries,
 * the quick comments are toggle buttons, and the free text has a visible label. `open` and `onClose`
 * come from the opener; the controller still calls `onClose` once the review is sent.
 */
const ReviewCustomerUI = (props) => {
  const {
    open = true,
    onClose,
    customer,
    reviewState,
    setReviewState,
    actionState,
    handleSendCustomerReview
  } = props

  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const scaleName = useId()
  const scaleLabelId = useId()
  const commentsLabelId = useId()
  const extraId = useId()
  const firstMarkRef = useRef(null)

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [comments, setComments] = useState([])
  const [extraComment, setExtraComment] = useState('')

  const qualificationList = [
    { key: 1, text: t('TERRIBLE', 'Terrible') },
    { key: 2, text: t('BAD', 'Bad') },
    { key: 3, text: t('OKAY', 'Okay') },
    { key: 4, text: t('GOOD', 'Good') },
    { key: 5, text: t('GREAT', 'Great') }
  ]

  // redesign fix-qa C3 (B3): the quick comments are `main`'s (`reviewCommentList(1)`, each mark with its own catalog
  // keys, so the texts a project sets still apply). `main` showed them before a mark was chosen (under the first
  // mark's title), so they stay visible; only the heading is neutral until a mark is chosen.
  const commentsList = reviewCommentList(1)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }
  const handleChangeQualification = (index) => {
    if (index) setReviewState({ ...reviewState, qualification: index, comment: '' })
    setComments([])
  }

  const isSelectedComment = (commentKey) => {
    const found = comments.find((comment) => comment?.key === commentKey)
    return found
  }

  const handleChangeComment = (commentItem) => {
    const found = comments.find((comment) => comment?.key === commentItem.key)
    if (found) {
      const _comments = comments.filter((comment) => comment?.key !== commentItem.key)
      setComments(_comments)
    } else {
      setComments([...comments, commentItem])
    }
  }

  useEffect(() => {
    let _comments = ''
    if (comments.length > 0) {
      comments.map(comment => (_comments += comment.content + '. '))
    }
    const _comment = _comments + extraComment
    setReviewState({ ...reviewState, comment: _comment })
  }, [comments, extraComment])

  useEffect(() => {
    if (!actionState.error) return
    setAlertState({
      open: true,
      content: actionState.error
    })
  }, [actionState.error])

  const fullName = [customer?.name, customer?.middle_name, customer?.lastname, customer?.second_lastname]
    .filter(Boolean)
    .join(' ')
  const currentList = commentsList[reviewState?.qualification || 1]
  const commentsTitle = reviewState?.qualification ? currentList?.title?.trim() : t('QUICK_COMMENTS', 'Quick comments')

  return (
    <>
      <Dialog
        open={!!open}
        onOpenChange={(next) => { if (!next) onClose?.() }}
        size='md'
        initialFocus={firstMarkRef}
        title={t('REVIEW_CUSTOMER', 'Review customer')}
        closeLabel={t('CLOSE', 'Close')}
        footer={(
          <>
            <Button onClick={() => onClose?.()}>{t('CANCEL', 'Cancel')}</Button>
            <Button
              variant='primary'
              busy={!!actionState.loading}
              disabled={!!actionState.loading}
              onClick={() => handleSendCustomerReview()}
            >
              {t('SEND_REVIEW', 'Send review')}
            </Button>
          </>
        )}
      >
        <div className='odc-review'>
          <div className='odc-review-who'>
            <Avatar
              name={fullName}
              src={customer?.photo ? optimizeImage(customer?.photo, 'h_150,c_limit') : undefined}
              size='lg'
            />
            <span className='odc-review-name'>{fullName}</span>
          </div>

          <div className='odc-review-block'>
            <p id={scaleLabelId} className='odc-review-label'>{t('HOW_WAS_THE_CUSTOMER', 'How was the customer?')}</p>
            <div role='radiogroup' aria-labelledby={scaleLabelId} className='odc-review-scale'>
              {qualificationList.map((qualification, index) => (
                <label key={qualification.key} className='odc-review-mark'>
                  <input
                    ref={index === 0 ? firstMarkRef : undefined}
                    type='radio'
                    name={scaleName}
                    value={qualification.key}
                    checked={reviewState?.qualification === qualification.key}
                    onChange={() => handleChangeQualification(qualification.key)}
                  />
                  <span>{qualification.text}</span>
                </label>
              ))}
            </div>
          </div>

          <div className='odc-review-block' role='group' aria-labelledby={commentsLabelId}>
            <p id={commentsLabelId} className='odc-review-label'>{commentsTitle}</p>
            <div className='odc-review-chips'>
              {currentList?.list?.map((commentItem, i) => (
                <button
                  key={i}
                  type='button'
                  className='odc-review-chip'
                  aria-pressed={!!isSelectedComment(commentItem?.key)}
                  onClick={() => handleChangeComment(commentItem)}
                >
                  {isSelectedComment(commentItem?.key) && <Check className='odc-icon' aria-hidden='true' />}
                  {commentItem.content}
                </button>
              ))}
            </div>
          </div>

          <div className='odc-review-block'>
            <label className='odc-review-label' htmlFor={extraId}>
              {t('DO_YOU_WANT_TO_ADD_SOMETHING', 'Do you want to add something?')}
            </label>
            <textarea
              id={extraId}
              name='comments'
              className='odc-review-field'
              rows={3}
              value={extraComment}
              onChange={(e) => setExtraComment(e.target.value)}
              autoComplete='off'
            />
          </div>
        </div>
      </Dialog>
      <AlertDialog
        title={t('REVIEW_NOT_SENT', 'Review not sent')}
        closeLabel={t('CLOSE', 'Close')}
        confirmLabel={t('OK', 'OK')}
        content={alertState.content}
        open={alertState.open}
        onClose={() => closeAlert()}
      />
    </>
  )
}

export const ReviewCustomer = (props) => {
  const reviewProps = {
    ...props,
    UIComponent: ReviewCustomerUI
  }
  return <ReviewCustomerController {...reviewProps} />
}
