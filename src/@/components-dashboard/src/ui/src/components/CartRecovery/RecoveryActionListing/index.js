import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RecoveryActionListing as RecoveryActionListingController, useLanguage } from '../../../../../index'
import { RecoveryActionHeader } from '../RecoveryActionHeader'
import { RecoveryActionList } from '../RecoveryActionList'
import { SideBar } from '../../Shared'
import { RecoveryActionDetail } from '../RecoveryActionDetail'
import { RecoveryActionAdd } from '../RecoveryActionAdd'
import { addQueryToUrl, removeQueryToUrl, learnOptionsValues } from '../../../utils'

import {
  RecoveryActionsContainer
} from './styles'
import { useOpenFromQuery } from '../../../hooks/useOneShotQuery'

const RecoveryActionListingUI = (props) => {
  const [, t] = useLanguage()
  const query = new URLSearchParams(useLocation().search)
  const [isOpenDetail, setIsOpenDetail] = useState(false)
  const [selectedAction, setSelectedAction] = useState(null)
  const [selectedActionId, setSelectedActionId] = useState(null)
  const [isAddMode, setIsAddMode] = useState(false)
  const learnOptions = learnOptionsValues(['cart_recovery'], t)

  const handleCloseDetail = () => {
    setIsOpenDetail(false)
    setSelectedAction(null)
    setIsAddMode(false)
    removeQueryToUrl(['id', 'tab'])
  }

  const handleOpenDetail = (action, isInitialRender) => {
    setSelectedAction(action)
    setSelectedActionId(action?.id)
    setIsOpenDetail(true)
    if (!Object.keys(action || {}).length) {
      setIsAddMode(true)
      removeQueryToUrl(['id'])
      return
    } else {
      setIsAddMode(false)
    }
    if (action && !isInitialRender) {
      addQueryToUrl({ id: action.id })
    }
  }

  // `?add=1` (command palette) opens the add form like the button
  useOpenFromQuery('add', () => handleOpenDetail({}))

  useEffect(() => {
    const id = query.get('id')
    if (id) {
      setSelectedAction({})
      setSelectedActionId(Number(id))
      setIsOpenDetail(true)
    }
  }, [])

  return (
    <>
      <RecoveryActionsContainer>
        <RecoveryActionHeader
          {...props}
          handleOpenDetail={handleOpenDetail}
          learnOptions={learnOptions}
        />
        {!isAddMode
          ? (
          <RecoveryActionList
            {...props}
            handleOpenDetail={handleOpenDetail}
            selectedAction={selectedAction}
          />
            )
          : (
          <RecoveryActionAdd
            {...props}
            action={selectedAction}
            actionId={selectedActionId}
            onClose={() => handleCloseDetail()}
          />
            )}
      </RecoveryActionsContainer>
      {isOpenDetail && !isAddMode && (
        <SideBar
          open={isOpenDetail}
          onClose={() => handleCloseDetail()}
          defaultSideBarWidth={550}
        >
          <RecoveryActionDetail
            {...props}
            action={selectedAction}
            actionId={selectedActionId}
            onClose={() => handleCloseDetail()}
          />
        </SideBar>
      )}
    </>
  )
}

export const RecoveryActionListing = (props) => {
  const query = new URLSearchParams(useLocation().search)
  const defaultPage = query.get('page') || 1
  const defaultPageSize = query.get('pageSize') || 10
  const recoveryActionsProps = {
    ...props,
    UIComponent: RecoveryActionListingUI,
    isSearchByName: true,
    isSearchByDescription: true,
    paginationSettings: {
      initialPage: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPage) : 1,
      pageSize: props.isUseQuery && !isNaN(defaultPage) ? Number(defaultPageSize) : 10,
      controlType: 'pages'
    }
  }
  return <RecoveryActionListingController {...recoveryActionsProps} />
}
