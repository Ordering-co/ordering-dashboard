import React, { useEffect, useRef, useState } from 'react'
import 'chartjs-adapter-moment'
import { lighten } from 'polished'
import BsArrowsAngleExpand from '@meronex/icons/bs/BsArrowsAngleExpand'
import BsDownload from '@meronex/icons/bs/BsDownload'
import { Line } from 'react-chartjs-2'
import { useLanguage } from '../../../../../index'
import Skeleton from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { Modal } from '../../Shared'
import {
  Container,
  ChartContentWrapper,
  ChartHeaderContainer,
  ActionBlock,
  EmptyContent
} from './styles'
import { GraphLoadingMessage } from '../GraphLoadingMessage'

export const AnalitycsClicks = (props) => {
  const {
    chartDataList,
    type = 'Business'
  } = props

  const [, t] = useLanguage()
  // const [{ parsePrice }] = useUtils()
  const chartRef = useRef(null)
  const [isShowPreview, setIsShowPreview] = useState(false)
  const [dataOptions, setDataOptions] = useState(null)

  const generateData = () => {
    if (props.isOrders) {
      const values = chartDataList.data.click[type].map((item, index) => {
        const list = []
        if (item?.data?.length > 0) {
          for (const value of item?.data) {
            list.push(value.y)
          }
        }
        return {
          label: item.label,
          data: [...list],
          fill: false,
          backgroundColor: 'rgba(75,192,192,0.2)',
          borderColor: lighten(index / 10, '#2C7BE5'),
          tension: 0.4,
          borderWidth: 3
        }
      })
      return values
    } else {
      const list = []
      if (chartDataList.data.click[type]?.length > 0) {
        for (const value of chartDataList.data.click[type]) {
          list.push(value.total)
        }
      }
      return [{
        label: t('CLICKS_OF_BUSINESSES', 'Clicks of businesses'),
        data: [...list],
        fill: false,
        backgroundColor: 'rgba(75,192,192,0.2)',
        borderColor: '#2C7BE5',
        tension: 0.4,
        borderWidth: 3
      }]
    }
  }

  const generateLabel = () => {
    const values = []
    const chartData = chartDataList.data.click[type]
    chartData && chartData.forEach(data => {
      values.push(data.name)
    })
    return values
  }

  const options = {
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          drawBorder: false
        },
        ticks: {
          font: {
            size: 12,
            color: '#CED4DA'
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
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
    const exportName = `clicks_${type?.toLowerCase()}`
    downloadLink.download = `${exportName}_${fileSuffix}.csv`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  const previewChart = () => {
    const chartData = chartDataList?.data?.click?.[type]
    if (chartData.length === 0) return
    setIsShowPreview(true)
  }

  useEffect(() => {
    const chartData = chartDataList?.data?.click?.[type]
    if (chartData && chartData?.length > 0) {
      const defaultData = {
        labels: generateLabel(),
        datasets: generateData()
      }
      setDataOptions(defaultData)
    }
  }, [chartDataList])

  return (
    <>
      <Container>
        <ChartHeaderContainer>
          <p>{t(`CLICKS_OF_${type?.toUpperCase()}`, `CLICKS OF ${type?.toUpperCase()}`)}</p>
          <ActionBlock disabled={!(chartDataList?.data?.click?.[type])?.length}>
            <BsArrowsAngleExpand onClick={previewChart} />
            <BsDownload className='download-view' onClick={downloadCSV} />
          </ActionBlock>
        </ChartHeaderContainer>
        <ChartContentWrapper>
          {
            chartDataList?.loading
              ? (
              <div>
                <Skeleton height={150} />
                <GraphLoadingMessage />
              </div>
                )
              : (
                  ((chartDataList?.data?.click?.[type])?.length > 0 && dataOptions) ? <Line data={dataOptions} options={options} ref={chartRef} /> : <EmptyContent>{t('NO_DATA', 'No Data')}</EmptyContent>
                )
          }
        </ChartContentWrapper>
      </Container>
      {isShowPreview && (
        <Modal
          width='70%'
          height='80vh'
          padding='30px'
          title={t(`CLICKS_OF_${type?.toUpperCase()}`, `CLICKS OF ${type?.toUpperCase()}`)}
          open={isShowPreview}
          onClose={() => setIsShowPreview(false)}
        >
          <ChartContentWrapper>
            {dataOptions && <Line data={dataOptions} options={options} />}
          </ChartContentWrapper>
        </Modal>
      )}
    </>
  )
}
