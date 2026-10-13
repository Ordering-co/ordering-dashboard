/* eslint-disable import/first */
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../index.js', () => ({
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

import { PageNotFound } from '..'

describe('PageNotFound', () => {
  it('renders translated fallback text and themed imagery', () => {
    renderWithProviders(<PageNotFound />, {
      theme: {
        colors: {},
        images: {
          general: {
            notFoundLighting: '/lighting.svg',
            notFound404: '/404.svg'
          }
        }
      }
    })

    expect(screen.getByText('PAGE NOT FOUND')).toBeInTheDocument()
    expect(screen.getByAltText('lighting')).toHaveAttribute('src', '/lighting.svg')
    expect(screen.getByAltText('error404')).toHaveAttribute('src', '/404.svg')
  })
})
