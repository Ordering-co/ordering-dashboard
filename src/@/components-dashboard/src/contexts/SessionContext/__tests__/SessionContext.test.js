import { beforeEach, describe, expect, it } from 'vitest'
import { WebStrategy } from '../../../webStrategy'
import { getSessionStorageValues } from '..'

describe('getSessionStorageValues', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('preserves a valid persisted session', async () => {
    const strategy = new WebStrategy()
    const user = { id: 1, level: 0 }
    localStorage.setItem('token', 'valid-token')
    localStorage.setItem('project', 'rokys')
    localStorage.setItem('user', JSON.stringify(user))

    await expect(getSessionStorageValues(strategy)).resolves.toEqual({
      auth: 'valid-token',
      token: 'valid-token',
      project: 'rokys',
      user
    })
    expect(localStorage.getItem('token')).toBe('valid-token')
  })

  it('invalidates only session keys when the persisted user is corrupt', async () => {
    const strategy = new WebStrategy()
    localStorage.setItem('token', 'stale-token')
    localStorage.setItem('project', 'rokys')
    localStorage.setItem('language', JSON.stringify({ code: 'es' }))
    localStorage.setItem('user', '[object Object]')

    await expect(getSessionStorageValues(strategy)).resolves.toEqual({
      auth: null,
      token: null,
      project: 'rokys',
      user: null
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(localStorage.getItem('project')).toBe('rokys')
    expect(localStorage.getItem('language')).toBe(JSON.stringify({ code: 'es' }))
  })

  it('invalidates a session whose user has the wrong JSON shape', async () => {
    const strategy = new WebStrategy()
    localStorage.setItem('token', 'stale-token')
    localStorage.setItem('user', JSON.stringify('invalid-user'))

    await expect(getSessionStorageValues(strategy)).resolves.toMatchObject({
      auth: null,
      token: null,
      user: null
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })
})

it('ignores a mismatched identity before reading or deleting that tenant user and token', async () => {
  localStorage.setItem('project', 'tenant-b')
  localStorage.setItem('token', 'other-token')
  localStorage.setItem('user', '[object Object]')
  await expect(getSessionStorageValues(new WebStrategy(), 'tenant-a')).resolves.toEqual({
    auth: null, token: null, project: 'tenant-a', user: null
  })
  expect(localStorage.getItem('token')).toBe('other-token')
  expect(localStorage.getItem('user')).toBe('[object Object]')
})
