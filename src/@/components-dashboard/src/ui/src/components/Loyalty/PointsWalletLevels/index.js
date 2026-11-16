import React, { useState, useEffect } from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import { useLanguage, useUtils, PointsWalletLevels as PointsWalletLevelsController } from '../../../../../index'
import { Alert, SideBar, Modal } from '../../Shared'
import { ChevronRight, Plus, Star } from '../../Shared/Icon'
import { Button, EmptyState, Skeleton } from '../../Shared/Product'
import { useWindowSize } from '../../../hooks/useWindowSize'
import { LoyaltyLevelDetail } from '../LoyaltyLevelDetail'
import { levelPoints, sortLevels } from './levelOrder'
import './points-wallet-levels.css'

// «From _count_ point(s)» with the number in a figure (decision 11); a translation without the token keeps its text and the figure goes after it.
const pointsText = (level, t) => {
  const count = levelPoints(level)
  if (count === null) return null
  const text = count === 1
    ? t('LEVELS_FROM_POINTS_ONE', 'From _count_ point')
    : t('LEVELS_FROM_POINTS_OTHER', 'From _count_ points')
  const [before, ...rest] = String(text).split('_count_')
  const figure = <span className='odc-figure'>{count}</span>
  if (rest.length === 0) return <>{before} {figure}</>
  return <>{before}{figure}{rest.join('_count_')}</>
}

// One level: a native button for the whole row. The thumbnail is the image of the level, or a neutral marker when there is none or it
// does not load (never the business logo of the theme). The chevron mirrors in right-to-left (points-wallet-levels.css).
const LevelRow = ({ level, current, image, pointsText, onOpen }) => {
  const [failedImage, setFailedImage] = useState(null)
  const showImage = Boolean(image) && failedImage !== image
  return (
    <button type='button' className='pwl-row' aria-current={current ? 'true' : undefined} onClick={onOpen}>
      <span className='pwl-thumb'>
        {showImage
          ? <img src={image} alt='' onError={() => setFailedImage(image)} />
          : <Star className='odc-icon' />}
      </span>
      <span className='pwl-text'>
        <span className='pwl-name'>{level?.name}</span>
        {pointsText && <> <span className='pwl-points'>{pointsText}</span></>}
      </span>
      <ChevronRight className='odc-icon pwl-chevron' />
    </button>
  )
}

const PointsWalletLevelsUI = (props) => {
  const {
    levelList,
    handleDeleteLevelList,
    handleUpdateLevelList,
    handleAddLevelList,
    handleParentSidebarMove,
    onDirtyChange
  } = props

  const history = useHistory()
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const replaceQuery = (mutate) => {
    const next = new URLSearchParams(location.search)
    mutate(next)
    const qs = next.toString()
    history.replace(qs ? `${location.pathname}?${qs}` : location.pathname)
  }
  const [, t] = useLanguage()
  const [{ optimizeImage }] = useUtils()
  const { width } = useWindowSize()

  const [alertState, setAlertState] = useState({ open: false, content: [] })
  const [extraOpen, setExtraOpen] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState(null)

  const closeAlert = () => {
    setAlertState({
      open: false,
      content: []
    })
  }

  const handleOpenDetail = (level, isInitialRender) => {
    setSelectedLevel(level)
    setExtraOpen(true)
    if (width >= 1100) {
      handleParentSidebarMove(550)
    }
    if (level && !isInitialRender) {
      replaceQuery(next => {
        next.set('level', String(level.id))
      })
    }
  }

  const handleCloseLevelDetail = () => {
    setExtraOpen(false)
    setSelectedLevel(null)
    handleParentSidebarMove(0)
    replaceQuery(next => {
      next.delete('level')
    })
  }

  useEffect(() => {
    if (width < 1100) {
      handleParentSidebarMove(0)
    } else {
      if (extraOpen) handleParentSidebarMove(550)
    }
  }, [width, extraOpen])

  useEffect(() => {
    if (levelList.loading) return
    const levelId = query.get('level')
    if (levelId) {
      const initLevel = levelList?.levels.find(level => level.id === Number(levelId))
      if (initLevel) {
        handleOpenDetail(initLevel, true)
      }
    }
  }, [levelList.loading])

  const levels = sortLevels(levelList?.levels)
  const showError = Boolean(levelList?.error) && levels.length === 0

  return (
    <div className='pwl'>
      <h1 className='pwl-title'>{t('LEVELS', 'Levels')}</h1>
      {levelList?.loading
        ? (
        <div className='pwl-list' role='status' aria-busy='true' aria-label={t('LOADING', 'Loading')}>
          {[...Array(5).keys()].map(i => (
            <div className='pwl-skeleton-row' key={i}>
              <Skeleton shape='box' size='var(--od-x-control-height-lg)' block='var(--od-x-control-height-lg)' />
              <div className='pwl-skeleton-text'>
                <Skeleton size='40%' />
                <Skeleton size='25%' />
              </div>
            </div>
          ))}
        </div>
          )
        : showError
          ? (
          <EmptyState tone='error' title={t('LEVELS_LOAD_ERROR', "We couldn't load the levels.")} />
            )
          : levels.length === 0
            ? (
            <EmptyState title={t('LEVELS_EMPTY', 'No levels yet')} />
              )
            : (
            <div className='pwl-list'>
              {levels.map((level, i) => (
                <LevelRow
                  key={level?.id ?? i}
                  level={level}
                  current={selectedLevel?.id !== undefined && level?.id === selectedLevel?.id}
                  image={level?.image ? optimizeImage(level.image) : null}
                  pointsText={pointsText(level, t)}
                  onOpen={() => handleOpenDetail(level)}
                />
              ))}
            </div>
              )}
      <div className='pwl-foot'>
        <Button icon={Plus} onClick={() => handleOpenDetail({})}>
          {t('ADD_NEW_LEVEL', 'Add new level')}
        </Button>
      </div>
      {extraOpen && (
        <>
          {width >= 1100
            ? (
            <SideBar
              isBorderShow
              open={extraOpen}
              defaultSideBarWidth={550}
              sidebarId='loyaltyLevel'
              onClose={handleCloseLevelDetail}
            >
              <LoyaltyLevelDetail
                level={selectedLevel}
                handleDeleteLevelList={handleDeleteLevelList}
                handleUpdateLevelList={handleUpdateLevelList}
                handleAddLevelList={handleAddLevelList}
                setSelectedLevel={setSelectedLevel}
                onClose={handleCloseLevelDetail}
                onDirtyChange={onDirtyChange}
              />
            </SideBar>
              )
            : (
            <Modal
              width='70%'
              height='90vh'
              padding='0px'
              open={extraOpen}
              onClose={handleCloseLevelDetail}
            >
              <LoyaltyLevelDetail
                level={selectedLevel}
                handleDeleteLevelList={handleDeleteLevelList}
                handleUpdateLevelList={handleUpdateLevelList}
                handleAddLevelList={handleAddLevelList}
                setSelectedLevel={setSelectedLevel}
                onClose={handleCloseLevelDetail}
                onDirtyChange={onDirtyChange}
              />
            </Modal>
              )}
        </>
      )}
      <Alert
        title={t('LEVELS', 'Levels')}
        content={alertState.content}
        acceptText={t('ACCEPT', 'Accept')}
        open={alertState.open}
        onClose={() => closeAlert()}
        onAccept={() => closeAlert()}
        closeOnBackdrop={false}
      />
    </div>
  )
}

export const PointsWalletLevels = (props) => {
  const pointsWalletLevelsProps = {
    ...props,
    UIComponent: PointsWalletLevelsUI
  }
  return <PointsWalletLevelsController {...pointsWalletLevelsProps} />
}
