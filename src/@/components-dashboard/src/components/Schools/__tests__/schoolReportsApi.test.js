import { describe, expect, it, vi } from 'vitest'

import { fetchSchoolReport } from '../schoolApi'

const ordering = { root: 'https://api.example/v400/en/demo' }
const token = 'session-token'
const fileBlob = new Blob(['file'], { type: 'application/octet-stream' })

const fileResponse = ({
  ok = true,
  status = 200,
  contentType = 'application/pdf',
  disposition = 'attachment; filename="centreville_2026-09-14_products-ordered.pdf"',
  blob = fileBlob,
  json
} = {}) => ({
  ok,
  status,
  headers: {
    get: (name) => {
      if (name === 'Content-Type') return contentType
      if (name === 'Content-Disposition') return disposition
      return null
    }
  },
  blob: async () => blob,
  json: async () => json
})

describe('fetchSchoolReport', () => {
  it('requests the report file with the token in the header and only the filters that are set', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse())

    const { blob, filename } = await fetchSchoolReport(ordering, token, 67, 'products_ordered', 'pdf', {
      preparationDate: '2026-09-14',
      gradeId: null,
      classroomId: 119
    }, { fetchFn })

    const [url, options] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api.example/v400/en/demo/backoffice/schools/67/reports/products_ordered.pdf?preparation_date=2026-09-14&classroom_id=119')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer session-token')
    expect(blob).toBe(fileBlob)
    expect(filename).toBe('centreville_2026-09-14_products-ordered.pdf')
  })

  it.each([
    ['kitchen', 'csv', 'text/csv; charset=UTF-8', 'centreville_2026-09-14_kitchen.csv'],
    ['kitchen', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'centreville_2026-09-14_kitchen_filtered.xlsx'],
    ['products_ordered', 'csv', 'text/csv', 'centreville_2026-09-14_products-ordered.csv'],
    ['products_ordered', 'xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'centreville_2026-09-14_products-ordered.xlsx']
  ])('downloads %s.%s and reads the filename from the response', async (report, format, contentType, expected) => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse({ contentType, disposition: `attachment; filename="${expected}"` }))

    const { filename } = await fetchSchoolReport(ordering, token, 67, report, format, { preparationDate: '2026-09-14', gradeId: 3 }, { fetchFn })

    const [url] = fetchFn.mock.calls[0]
    expect(url).toBe(`https://api.example/v400/en/demo/backoffice/schools/67/reports/${report}.${format}?preparation_date=2026-09-14&grade_id=3`)
    expect(filename).toBe(expected)
  })

  it('falls back to a generated filename when the header is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse({ disposition: null }))

    const { filename } = await fetchSchoolReport(ordering, token, 67, 'products_ordered', 'pdf', { preparationDate: '2026-09-14' }, { fetchFn })

    expect(filename).toBe('products_ordered_2026-09-14.pdf')
  })

  it('throws the api message and code when there are no meals', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse({
      ok: false,
      status: 400,
      contentType: 'application/json',
      json: { error: true, result: ['No meals for this date.'], error_codes: ['preparation_date.no_meals'] }
    }))

    await expect(fetchSchoolReport(ordering, token, 67, 'kitchen', 'csv', { preparationDate: '2026-01-01' }, { fetchFn }))
      .rejects.toMatchObject({ message: 'No meals for this date.', code: 'preparation_date.no_meals' })
  })

  it('throws the api message on a permission error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse({
      ok: false,
      status: 401,
      contentType: 'application/json',
      json: { error: true, result: ['You do not have permission.'] }
    }))

    await expect(fetchSchoolReport(ordering, token, 67, 'kitchen', 'xlsx', { preparationDate: '2026-09-14' }, { fetchFn }))
      .rejects.toThrow('You do not have permission.')
  })

  it('rejects a 200 whose content type does not match the requested format', async () => {
    const fetchFn = vi.fn().mockResolvedValue(fileResponse({ contentType: 'application/json' }))

    await expect(fetchSchoolReport(ordering, token, 67, 'kitchen', 'xlsx', { preparationDate: '2026-09-14' }, { fetchFn }))
      .rejects.toThrow('Invalid response format')
  })
})
