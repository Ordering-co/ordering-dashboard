import React from 'react'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useLanguage } from '../../../../../index'

import { ActionBlock, AnalyticsTopOrdersHeader, Container, ProductCategoryContainer, SkeletonContainerWrapper, TopOrdersContainerWrapper, TopOrdersContent, ValueContainer, ValueWrapper } from './styles'
import { EmptyContent } from '../AnalyticsTopOrders/styles'
import BsDownload from '@meronex/icons/bs/BsDownload'
import { GraphLoadingMessage } from '../GraphLoadingMessage'

export const AnalitycsTopClicks = (props) => {
  const {
    chartDataList,
    type
  } = props

  const [, t] = useLanguage()

  const generateData = () => {
    const values = chartDataList?.data?.click?.[type].sort((a, b) => b.total - a.total).slice(0, 10)
    return values
  }

  const downloadCSV = () => {
    let csv = `${`CLICKS OF ${type?.toUpperCase()}`}, ${t('CLICKS', 'Clicks')}\n`
    const chartData = chartDataList?.data?.click?.[type]
    for (const row of chartData) {
      csv += `${row.name},`
      csv += `${row.total},`
      csv += '\n'
    }
    const downloadLink = document.createElement('a')
    const blob = new Blob(['\ufeff', csv])
    const url = URL.createObjectURL(blob)
    downloadLink.href = url
    const fileSuffix = new Date().getTime()
    const exportName = `top_clicks_${type?.toLowerCase()}`
    downloadLink.download = `${exportName}_${fileSuffix}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  return (
    <>
      <Container>
        <AnalyticsTopOrdersHeader>
          <p>{t(`CLICKS_OF_${type?.toUpperCase()}`, `CLICKS OF ${type?.toUpperCase()}`)}</p>
          <ActionBlock disabled={!chartDataList?.data?.click?.[type]?.length}>
            <BsDownload onClick={downloadCSV} />
          </ActionBlock>
        </AnalyticsTopOrdersHeader>
        {
          chartDataList?.loading
            ? (
              <SkeletonContainerWrapper>
                {
                  [...Array(5).keys()].map(i => (
                    <div key={i}>
                      <Skeleton height={30} />
                    </div>
                  ))
                }
                <GraphLoadingMessage />
              </SkeletonContainerWrapper>
              )
            : (
              <TopOrdersContainerWrapper>
                {
                  chartDataList?.data?.click?.[type]?.length > 0
                    ? (
                      <ProductCategoryContainer>
                        {
                          generateData().map((item, i) => (
                            <TopOrdersContent key={i}>
                              <p>{item?.name}</p>
                              <ValueWrapper>
                                <ValueContainer >{item?.total}</ValueContainer>
                              </ValueWrapper>
                            </TopOrdersContent>
                          ))
                        }
                      </ProductCategoryContainer>
                      )
                    : (
                      <EmptyContent>{t('NO_DATA', 'No Data')}</EmptyContent>
                      )
                }
              </TopOrdersContainerWrapper>
              )
        }
      </Container>
    </>
  )
}
