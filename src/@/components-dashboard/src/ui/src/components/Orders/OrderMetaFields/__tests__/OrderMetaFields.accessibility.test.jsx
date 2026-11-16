/* eslint-disable import/first */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '~/__tests__/helpers/testUtils'

vi.mock('../../../../../../index', () => ({
  MetaFields: ({ UIComponent, ...props }) => <UIComponent {...props} />,
  useLanguage: () => [null, (_key, fallback) => fallback]
}))

vi.mock('jsoneditor-react', () => ({ JsonEditor: () => <div /> }))

import { OrderMetaFields } from '..'

describe('OrderMetaFields accessibility', () => {
  // redesign 5.3: the field is a Product table (Shared/Product IconButton and tokens in activity-tab.css),
  // no longer styled-components. The computed-style assertions of the old markup (identifier/content font
  // size variables, 44px min-height/min-width in the styled button) are gone with it: the 44px coarse-pointer
  // target is now `.odc-btn` in Shared/Product/product.css and the literal guard keeps the CSS on tokens.
  // Names, payloads, direction of the key and novalidate stay as they were.
  it('uses named icon buttons and preserves add/delete payloads', async () => {
    const handleDeleteMetaField = vi.fn()
    const handeAddMetaField = vi.fn()
    const { container } = renderWithProviders(
      <OrderMetaFields
        orderId={42}
        metaFieldsList={{
          loading: false,
          metaFields: [{ id: 7, key: 'dispatch_note', value: 'Gate 4', value_type: 'text' }]
        }}
        actionState={{ loading: false, result: null }}
        handleDeleteMetaField={handleDeleteMetaField}
        handeAddMetaField={handeAddMetaField}
      />
    )

    const remove = screen.getByRole('button', { name: 'Delete dispatch_note' })
    const key = screen.getByText('dispatch_note', { exact: true })
    const value = screen.getByText('Gate 4', { exact: true })
    expect(key).toHaveClass('odc-mono')
    expect(key).toHaveAttribute('dir', 'ltr')
    expect(value).not.toHaveAttribute('dir', 'ltr')
    expect(remove).toHaveClass('odc-btn')
    // redesign W0-12 (T0-47): the click only asks; the payload goes out on confirm (see the confirmation tests below)
    fireEvent.click(remove)
    expect(handleDeleteMetaField).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
    await waitFor(() => expect(handleDeleteMetaField).toHaveBeenCalledWith(7))

    fireEvent.change(screen.getByRole('textbox', { name: 'Key' }), { target: { value: 'priority' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Value' }), { target: { value: 'high' } })
    const add = screen.getByRole('button', { name: 'Add' })
    expect(add).toHaveClass('odc-btn')
    fireEvent.click(add)

    await waitFor(() => {
      expect(handeAddMetaField).toHaveBeenCalledWith({
        key: 'priority',
        order_id: 42,
        value: 'high',
        value_type: 'text'
      })
    })
    expect(container.querySelector('form')).toHaveAttribute('novalidate')
  })

  // redesign W0-12 (T0-47, M-05; owner decision 25): deleting a custom field asks first (C8).
  describe('delete confirmation', () => {
    const fieldsList = {
      loading: false,
      metaFields: [
        { id: 7, key: 'dispatch_note', value: 'Gate 4', value_type: 'text' },
        { id: 8, key: 'gift', value: '1', value_type: 'boolean' }
      ]
    }
    const setup = (handleDeleteMetaField = vi.fn().mockResolvedValue({ error: false })) => {
      renderWithProviders(
        <OrderMetaFields
          orderId={42}
          metaFieldsList={fieldsList}
          actionState={{ loading: false, result: null }}
          handleDeleteMetaField={handleDeleteMetaField}
          handeAddMetaField={vi.fn()}
        />
      )
      return handleDeleteMetaField
    }

    it('a click on delete sends nothing, names the field and puts the focus on Cancel', async () => {
      const handleDelete = setup()
      fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
      const dialog = await screen.findByRole('alertdialog')
      expect(dialog).toHaveAccessibleName('Delete custom field “dispatch_note”?')
      expect(dialog).toHaveTextContent("It will be removed from this order. This can't be undone.")
      expect(screen.getByRole('button', { name: 'Delete field' })).toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('button', { name: 'Keep field' })).toHaveFocus())
      expect(handleDelete).not.toHaveBeenCalled()
    })

    it('confirm sends the delete once, however many times it is pressed', async () => {
      let release
      const handleDelete = setup(vi.fn(() => new Promise(resolve => { release = resolve })))
      fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
      const confirm = await screen.findByRole('button', { name: 'Delete field' })
      fireEvent.click(confirm)
      fireEvent.click(confirm)
      expect(handleDelete).toHaveBeenCalledTimes(1)
      expect(handleDelete).toHaveBeenCalledWith(7)
      await act(async () => release({ error: false }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(handleDelete).toHaveBeenCalledTimes(1)
    })

    it('Cancel, Escape and the close button send nothing and return the focus to the delete button', async () => {
      const handleDelete = setup()
      const remove = screen.getByRole('button', { name: 'Delete dispatch_note' })
      const closers = [
        () => fireEvent.click(screen.getByRole('button', { name: 'Keep field' })),
        () => fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' }),
        () => fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      ]
      for (const close of closers) {
        remove.focus()
        fireEvent.click(remove)
        await screen.findByRole('alertdialog')
        close()
        await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
        await waitFor(() => expect(remove).toHaveFocus())
      }
      expect(handleDelete).not.toHaveBeenCalled()
    })

    it('a refusal shows translated in the dialog, keeps the field and lets the person retry', async () => {
      const handleDelete = setup(vi.fn()
        .mockResolvedValueOnce({ error: true, result: 'Not allowed' })
        .mockResolvedValueOnce({ error: false }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed')
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      expect(screen.getByText('dispatch_note', { exact: true })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Delete field' }))
      await waitFor(() => expect(handleDelete).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    })

    it('without a message from the API the dialog says the field could not be deleted', async () => {
      setup(vi.fn().mockResolvedValue({ error: true, result: '' }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete gift' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
      expect(await screen.findByRole('alert')).toHaveTextContent("The field couldn't be deleted. Try again.")
    })

    it('after a delete the focus goes to the neighbouring delete button, not to the page', async () => {
      const Harness = () => {
        const [list, setList] = React.useState(fieldsList.metaFields)
        const remove = vi.fn(async (id) => {
          setList(current => current.filter(field => field.id !== id))
          return { error: false }
        })
        return (
          <OrderMetaFields
            orderId={42}
            metaFieldsList={{ loading: false, metaFields: list }}
            actionState={{ loading: false, result: null }}
            handleDeleteMetaField={remove}
            handeAddMetaField={vi.fn()}
          />
        )
      }
      renderWithProviders(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Delete dispatch_note' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Delete field' }))
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
      expect(screen.queryByText('dispatch_note', { exact: true })).not.toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('button', { name: 'Delete gift' })).toHaveFocus())
    })
  })
})
