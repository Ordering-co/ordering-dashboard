import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ShellMain } from '..'

// (#76a): the shell had no <main>, and the skip link of the sidebar points at #main-content
describe('ShellMain', () => {
  it('is the one main landmark of the shell, with the id the skip link points at', () => {
    render(<ShellMain><h1>Orders</h1></ShellMain>)
    const main = screen.getByRole('main')
    expect(main.tagName).toBe('MAIN')
    expect(main).toHaveAttribute('id', 'main-content')
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(main).toContainElement(screen.getByRole('heading', { name: 'Orders' }))
  })

  it('does not draw a box: its children stay children of the flex layout', () => {
    render(<ShellMain><div>Page</div></ShellMain>)
    expect(screen.getByRole('main').style.display).toBe('contents')
  })

  it('the skip link of the sidebar resolves to it', () => {
    render(<><a href='#main-content'>Skip</a><ShellMain>x</ShellMain></>)
    const target = document.querySelector(screen.getByText('Skip').getAttribute('href'))
    expect(target).toBe(screen.getByRole('main'))
  })
})
