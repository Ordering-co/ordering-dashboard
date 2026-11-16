// redesign SC-B1 (decision 2A): the school the user chose last, per project and user, in localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { readRememberedSchool, rememberSchool } from '../rememberedSchool'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('rememberedSchool', () => {
  it('writes and reads back the school as a number', () => {
    rememberSchool('acme', 7, 42)
    expect(readRememberedSchool('acme', 7)).toBe(42)
  })

  it('uses the key odc-schools-last:<project>:<userId>', () => {
    rememberSchool('acme', 7, 42)
    expect(localStorage.getItem('odc-schools-last:acme:7')).toBe('42')
  })

  it('is kept per user', () => {
    rememberSchool('acme', 7, 42)
    rememberSchool('acme', 8, 9)
    expect(readRememberedSchool('acme', 7)).toBe(42)
    expect(readRememberedSchool('acme', 8)).toBe(9)
    expect(readRememberedSchool('acme', 9)).toBeNull()
  })

  it('is kept per project: the same user id in another project is another person', () => {
    rememberSchool('acme', 7, 42)
    expect(readRememberedSchool('other', 7)).toBeNull()
    rememberSchool('other', 7, 5)
    expect(readRememberedSchool('acme', 7)).toBe(42)
    expect(readRememberedSchool('other', 7)).toBe(5)
  })

  it('a null school forgets', () => {
    rememberSchool('acme', 7, 42)
    rememberSchool('acme', 7, null)
    expect(readRememberedSchool('acme', 7)).toBeNull()
    expect(localStorage.getItem('odc-schools-last:acme:7')).toBeNull()
  })

  it.each([[undefined], [null], ['']])('without a user (%j) it reads null and writes nothing', (userId) => {
    expect(readRememberedSchool('acme', userId)).toBeNull()
    rememberSchool('acme', userId, 42)
    expect(localStorage).toHaveLength(0)
  })

  it.each([[undefined], [null], ['']])('without a project (%j) it reads null and writes nothing', (project) => {
    expect(readRememberedSchool(project, 7)).toBeNull()
    rememberSchool(project, 7, 42)
    expect(localStorage).toHaveLength(0)
  })

  it.each([['abc'], ['-3'], ['0'], ['2.5'], [''], ['12abc'], ['NaN'], ['1e3'], [' 4']])('a stored %j is not a school id: null', (stored) => {
    localStorage.setItem('odc-schools-last:acme:7', stored)
    expect(readRememberedSchool('acme', 7)).toBeNull()
  })

  it('remembers nothing for an id that is not a positive whole number', () => {
    rememberSchool('acme', 7, 0)
    rememberSchool('acme', 7, -2)
    rememberSchool('acme', 7, 1.5)
    rememberSchool('acme', 7, 'abc')
    expect(localStorage).toHaveLength(0)
  })

  it('a storage that throws on read (private mode, blocked) reads null', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readRememberedSchool('acme', 7)).toBeNull()
  })

  it('a storage that throws on write does nothing and does not throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => rememberSchool('acme', 7, 42)).not.toThrow()
    expect(() => rememberSchool('acme', 7, null)).not.toThrow()
  })
})
