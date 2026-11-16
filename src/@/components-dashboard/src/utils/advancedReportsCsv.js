import { toCsv } from './businessReports'

/**
 * CSV files of /intelligence/reports. They keep the shape of the ones `main` builds in the browser (BI/Reports*), so
 * whoever imports them keeps working; the only change is the quoting of a value that has a comma, a quote or a line
 * break (RP-19), which in `main` breaks the row.
 */

// redesign reports FA2 (D11): the BOM main puts in front of every file, so Excel reads UTF-8
export const CSV_BOM = '﻿'

const rowsOf = (section) => (Array.isArray(section?.rows) ? section.rows : [])

/** One cell as main writes it (`${value}`), in double quotes with the quotes doubled when it holds a comma, a quote or a line break. */
// redesign reports FA2 (RP-19)
const cellText = (value) => {
  const text = `${value}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The CSV of a table report (`content` of the API: `{ header, body, footer }`, each with `rows` of cells
 * `{ value, colspan, value_unit }`) the way `main` builds it (`main`'s ReportsBusinessSpend:57-99, ReportsSpentTime:50-92):
 * BOM, the header rows, a blank line, the body rows, a blank line, the footer rows, a blank line. Each cell is `value,`
 * followed by one ` ,` per extra colspan. Values go as they come (raw seconds, raw numbers, header keys untranslated)
 * and so do `null`/`undefined` (they write `null`, as in `main`).
 *
 * `options.currencySuffix` ('$' in reports 8 and 18) is added to the cells of the body whose `value_unit` is
 * `currency`, as `main`'s ReportsOrderStatus:63-106 and ReportsAverageSales:49-92 do.
 *
 * Returns null when there is nothing to download: no `content`, no header rows, or no body rows (the case where `main`
 * does nothing; with a missing `header` `main` throws a TypeError).
 */
// redesign reports FA2 (D11, RP-19, auditor 11)
export const pivotToCsv = (content, options = {}) => {
  const header = content?.header
  if (!Array.isArray(header?.rows)) return null
  if (rowsOf(content.body).length === 0) return null
  const suffix = options?.currencySuffix ? `${options.currencySuffix}` : ''

  const writeRows = (rows, withSuffix) => {
    let text = ''
    rows.forEach((tr) => {
      if (!Array.isArray(tr)) return
      tr.forEach((th) => {
        const value = withSuffix && suffix && th?.value_unit === 'currency' ? `${th?.value}${suffix}` : th?.value
        text += `${cellText(value)},`
        for (let i = 1; i < th?.colspan; i++) {
          text += ' ,'
        }
      })
      text += '\n'
    })
    return `${text}\n`
  }

  return CSV_BOM +
    writeRows(header.rows, false) +
    writeRows(rowsOf(content.body), true) +
    writeRows(rowsOf(content.footer), false)
}

/**
 * The CSV of a chart report: the header as «Time, Orders» and every row as `x,y,` (trailing comma), the shape of
 * reports 12 to 16 and 20 in `main`. It is `toCsv` of /intelligence/business (same shape, same quoting), without BOM.
 */
// redesign reports FA2 (D11, RP-19)
export const seriesToCsv = (header, rows) => toCsv(header, rows)

/**
 * Saves `text` as `fileName`: a link with a blob URL clicked once, as `main` does for tables. The file starts with one
 * BOM: it is added when `text` does not carry it already (`pivotToCsv` does, `seriesToCsv` does not). Nothing without text.
 * `downloadCsv` of businessReports always adds the BOM, so with `pivotToCsv` it would write two: use this one.
 */
// redesign reports FA2 (D11)
export const downloadText = (fileName, text) => {
  if (typeof text !== 'string' || text === '') return
  const blob = new Blob([text.startsWith(CSV_BOM) ? text : CSV_BOM + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
