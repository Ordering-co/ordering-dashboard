import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useApi } from '../../contexts/ApiContext'
import { useSession } from '../../contexts/SessionContext'

export const CampaignUserList = (props) => {
  const {
    UIComponent,
    campaignId
  } = props
  const [ordering] = useApi()
  const [{ token }] = useSession()

  const [userListState, setUserListState] = useState({ users: [], loading: true, error: null })

  /**
   * Method to get the user list from API
   */
  const getUserList = async () => {
    try {
      setUserListState({ ...userListState, loading: true })

      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }

      const response = await fetch(`${ordering.root}/marketing_campaigns/${campaignId}/users?orderBy=open_at`, requestOptions)
      const content = await response.json()

      if (!content.error) {
        setUserListState({ ...userListState, loading: false, error: null, users: content.result })
      } else {
        setUserListState({ ...userListState, loading: false, error: content.result })
      }
    } catch (err) {
      setUserListState({ ...userListState, loading: false, error: err.message })
    }
  }

  useEffect(() => {
    getUserList()
  }, [])

  return (
    <>
      {UIComponent && (
        <UIComponent
          {...props}
          userListState={userListState}
        />
      )}
    </>
  )
}

CampaignUserList.propTypes = {
  /**
   * UI Component, this must be containt all graphic elements and use parent props
   */
  UIComponent: PropTypes.elementType
}
