// redesign SC-B1 (M-SC03, M-SC10): the paged loader of the four lists. A failure is never an empty list.
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSchoolList } from '../useSchoolList'

const ok = (result, pagination = {}) => ({ error: false, result, pagination })
const fail = (result) => ({ error: true, result })

// a call the test resolves by hand, to order the answers
const deferred = () => {
  let finish
  const promise = new Promise((resolve) => { finish = resolve })
  return { promise, resolve: finish }
}

const setup = (fetchPage, props = {}) => {
  const onPageChange = vi.fn()
  const hook = renderHook(
    (current) => useSchoolList({ fetchPage, onPageChange, ...current }),
    { initialProps: props }
  )
  return { ...hook, onPageChange }
}

describe('first load', () => {
  it('loads initialPage with the page size, and says it is loading until then', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }, { id: 2 }], { current_page: 3, total: 52, total_pages: 3 }))
    const { result, onPageChange } = setup(fetchPage, { initialPage: 3, deps: ['s1'] })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(fetchPage).toHaveBeenCalledWith({ page: 3, pageSize: 25 })
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.current.page).toBe(3)
    expect(result.current.total).toBe(52)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.error).toBeNull()
    expect(onPageChange).not.toHaveBeenCalled()
  })

  it('page 1, 25 per page and one page when nothing says otherwise', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }]))
    const { result } = setup(fetchPage)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 25 })
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(1)
    expect(result.current.total).toBeNull()
  })

  it('takes the page size it is given', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([]))
    const { result } = setup(fetchPage, { pageSize: 10 })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenCalledWith({ page: 1, pageSize: 10 })
    expect(result.current.pageSize).toBe(10)
  })
})

describe('deps', () => {
  it('a change of deps goes back to page 1 and tells the shell', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }], { current_page: 1, total_pages: 4 }))
    const { result, rerender, onPageChange } = setup(fetchPage, { initialPage: 3, deps: ['s1'] })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ initialPage: 3, deps: ['s2'] })
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2))
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
    expect(onPageChange).toHaveBeenCalledTimes(1)
    expect(onPageChange).toHaveBeenCalledWith(1)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('the same deps in a new array do not reload', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([]))
    const { result, rerender } = setup(fetchPage, { deps: ['s1', null] })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ deps: ['s1', null] })
    rerender({ deps: ['s1', null] })
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('uses the latest fetchPage, not the one of the first render', async () => {
    const first = vi.fn().mockResolvedValue(ok([{ id: 'a' }]))
    const second = vi.fn().mockResolvedValue(ok([{ id: 'b' }]))
    const { result, rerender } = setup(first, { deps: ['s1'] })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ fetchPage: second, deps: ['s2'] })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'b' }]))
    expect(second).toHaveBeenCalledTimes(1)
  })
})

describe('paging', () => {
  it('goToPage loads that page and tells the shell', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }], { total_pages: 5 }))
    const { result, onPageChange } = setup(fetchPage)
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goToPage(4))
    expect(onPageChange).toHaveBeenCalledWith(4)
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith({ page: 4, pageSize: 25 }))
    await waitFor(() => expect(result.current.page).toBe(4))
  })

  it('changePageSize goes back to page 1 with the new size and keeps it for the next page', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }], { total_pages: 5 }))
    const { result, onPageChange } = setup(fetchPage, { initialPage: 3 })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.changePageSize(50))
    expect(onPageChange).toHaveBeenCalledWith(1)
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 50 }))
    await waitFor(() => expect(result.current.pageSize).toBe(50))
    act(() => result.current.goToPage(2))
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 }))
  })

  it('works without onPageChange', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }]))
    const { result } = renderHook(() => useSchoolList({ fetchPage }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goToPage(2))
    act(() => result.current.changePageSize(10))
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 }))
  })
})

describe('an empty page beyond the first', () => {
  it('loads the page before and tells the shell (the last row was deleted)', async () => {
    const fetchPage = vi.fn(async ({ page }) => (page >= 3 ? ok([], { total_pages: 2 }) : ok([{ id: page }], { current_page: page, total_pages: 2 })))
    const { result, onPageChange } = setup(fetchPage, { initialPage: 3 })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 2 }]))
    expect(fetchPage.mock.calls.map(([args]) => args.page)).toEqual([3, 2])
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(result.current.page).toBe(2)
    expect(result.current.loading).toBe(false)
  })

  it('jumps to the last page the answer reports, never below page 1 (review r1 #1: ?page=40 asked 40 pages)', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([], { total_pages: 1 }))
    const { result, onPageChange } = setup(fetchPage, { initialPage: 40 })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage.mock.calls.map(([args]) => args.page)).toEqual([40, 1])
    expect(onPageChange.mock.calls.map(([page]) => page)).toEqual([1])
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('an out-of-range page lands on the last one in one more request', async () => {
    const fetchPage = vi.fn(async ({ page }) => (page > 3 ? ok([], { total_pages: 3 }) : ok([{ id: page }], { current_page: page, total_pages: 3 })))
    const { result, onPageChange } = setup(fetchPage, { initialPage: 999 })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 3 }]))
    expect(fetchPage.mock.calls.map(([args]) => args.page)).toEqual([999, 3])
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('an empty page 1 is an empty list: no further request', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([]))
    const { result, onPageChange } = setup(fetchPage)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchPage).toHaveBeenCalledTimes(1)
    expect(onPageChange).not.toHaveBeenCalled()
  })
})

describe('a failure (M-SC03)', () => {
  const failAt = async (answer) => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce(ok([{ id: 1 }, { id: 2 }], { total_pages: 3 }))
      .mockImplementationOnce(answer)
    const hook = setup(fetchPage)
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    act(() => hook.result.current.goToPage(2))
    await waitFor(() => expect(hook.result.current.error).not.toBeNull())
    return { ...hook, fetchPage }
  }

  it('the message of an API list is result[0] and the rows stay as they were', async () => {
    const { result } = await failAt(async () => fail(['The school does not exist', 'other']))
    expect(result.current.error).toBe('The school does not exist')
    expect(result.current.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(result.current.loading).toBe(false)
    expect(result.current.page).toBe(1)
  })

  it('the message of an API text is the text', async () => {
    const { result } = await failAt(async () => fail('INTERNAL_ERROR'))
    expect(result.current.error).toBe('INTERNAL_ERROR')
    expect(result.current.items).toHaveLength(2)
  })

  it('an exception is a failure with its message', async () => {
    const { result } = await failAt(async () => { throw new Error('Network down') })
    expect(result.current.error).toBe('Network down')
    expect(result.current.items).toHaveLength(2)
  })

  it('a failure with no message is still a failure: error is true, never null', async () => {
    const { result } = await failAt(async () => fail(undefined))
    expect(result.current.error).toBe(true)
    expect(result.current.items).toHaveLength(2)
  })

  it('a failure on the first load leaves no rows and says so', async () => {
    const fetchPage = vi.fn().mockResolvedValue(fail(['Boom']))
    const { result } = setup(fetchPage)
    await waitFor(() => expect(result.current.error).toBe('Boom'))
    expect(result.current.items).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('reload repeats the page that failed and clears the error when it works', async () => {
    const { result, fetchPage } = await failAt(async () => fail(['Boom']))
    fetchPage.mockResolvedValueOnce(ok([{ id: 9 }], { current_page: 2, total_pages: 3 }))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 2, pageSize: 25 })
    expect(result.current.items).toEqual([{ id: 9 }])
    expect(result.current.page).toBe(2)
  })
})

describe('answers out of order', () => {
  it('an old answer never overwrites a new one', async () => {
    const slow = deferred()
    const fast = deferred()
    const fetchPage = vi.fn()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)
    const { result, rerender } = setup(fetchPage, { deps: ['s1'] })
    rerender({ deps: ['s2'] })
    await act(async () => { fast.resolve(ok([{ id: 'new' }])) })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'new' }]))
    await act(async () => { slow.resolve(ok([{ id: 'old' }])) })
    expect(result.current.items).toEqual([{ id: 'new' }])
    expect(result.current.loading).toBe(false)
  })

  it('an old failure never paints an error over a new list', async () => {
    const slow = deferred()
    const fast = deferred()
    const fetchPage = vi.fn()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise)
    const { result, rerender } = setup(fetchPage, { deps: ['s1'] })
    rerender({ deps: ['s2'] })
    await act(async () => { fast.resolve(ok([{ id: 'new' }])) })
    await act(async () => { slow.resolve(fail(['Old failure'])) })
    expect(result.current.error).toBeNull()
    expect(result.current.items).toEqual([{ id: 'new' }])
  })

  it('an answer that comes after the list is gone does nothing', async () => {
    const late = deferred()
    const fetchPage = vi.fn().mockReturnValueOnce(late.promise)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = setup(fetchPage)
    unmount()
    await act(async () => { late.resolve(ok([{ id: 1 }])) })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('reload', () => {
  it('repeats the last page', async () => {
    const fetchPage = vi.fn().mockResolvedValue(ok([{ id: 1 }], { total_pages: 5 }))
    const { result } = setup(fetchPage)
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.goToPage(3))
    await waitFor(() => expect(result.current.page).toBe(3))
    act(() => result.current.reload())
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(3))
    expect(fetchPage).toHaveBeenLastCalledWith({ page: 3, pageSize: 25 })
  })
})
