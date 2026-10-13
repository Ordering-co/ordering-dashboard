import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchSchoolLabelsPdf, getSchoolLabelsCount } from '../schoolApi'

const ordering = { root: 'https://api.example/v400/en/demo' }
const token = 'session-token'
const pdfBlob = new Blob(['%PDF-fake'], { type: 'application/pdf' })

const pdfResponse = ({
  ok = true,
  status = 200,
  contentType = 'application/pdf',
  disposition = 'attachment; filename="centreville_2026-09-09.pdf"',
  blob = pdfBlob,
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

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getSchoolLabelsCount', () => {
  it('requests the count endpoint with only the filters that are set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ error: false, result: { labels: 46, sheets: 2 } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { error, result } = await getSchoolLabelsCount(ordering, token, 67, {
      preparationDate: '2026-09-09',
      gradeId: null,
      classroomId: 119
    })

    expect(error).toBe(false)
    expect(result.labels).toBe(46)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example/v400/en/demo/backoffice/schools/67/labels?preparation_date=2026-09-09&classroom_id=119')
    expect(options.headers.Authorization).toBe('Bearer session-token')
  })
})

describe('fetchSchoolLabelsPdf', () => {
  it('downloads the sheet as a blob and reads the filename from the response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse())

    const { blob, filename } = await fetchSchoolLabelsPdf(ordering, token, 67, { preparationDate: '2026-09-09' }, { fetchFn })

    const [url, options] = fetchFn.mock.calls[0]
    expect(url).toBe('https://api.example/v400/en/demo/backoffice/schools/67/labels.pdf?preparation_date=2026-09-09')
    expect(options.method).toBe('GET')
    expect(options.headers.Authorization).toBe('Bearer session-token')
    expect(blob).toBe(pdfBlob)
    expect(filename).toBe('centreville_2026-09-09.pdf')
  })

  it('asks for cut guides only when requested and forwards the abort signal', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse())
    const controller = new AbortController()

    await fetchSchoolLabelsPdf(ordering, token, 67, { preparationDate: '2026-09-09', gradeId: 1, guides: true }, { fetchFn, signal: controller.signal })

    const [url, options] = fetchFn.mock.calls[0]
    expect(url).toContain('grade_id=1')
    expect(url).toContain('guides=1')
    expect(options.signal).toBe(controller.signal)
  })

  it('falls back to a generated filename when the header is missing', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse({ disposition: null }))

    const { filename } = await fetchSchoolLabelsPdf(ordering, token, 67, { preparationDate: '2026-09-09' }, { fetchFn })

    expect(filename).toBe('labels_2026-09-09.pdf')
  })

  it('throws the api message and code when the response is not ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse({
      ok: false,
      status: 400,
      contentType: 'application/json',
      json: { error: true, result: ['No meals for this date.'], error_codes: ['preparation_date.no_meals'] }
    }))

    await expect(fetchSchoolLabelsPdf(ordering, token, 67, { preparationDate: '2026-01-01' }, { fetchFn }))
      .rejects.toMatchObject({ message: 'No meals for this date.', code: 'preparation_date.no_meals' })
  })

  it('rejects a 200 that is not a pdf', async () => {
    const fetchFn = vi.fn().mockResolvedValue(pdfResponse({ contentType: 'text/html' }))

    await expect(fetchSchoolLabelsPdf(ordering, token, 67, { preparationDate: '2026-09-09' }, { fetchFn }))
      .rejects.toThrow('Invalid response format')
  })
})
