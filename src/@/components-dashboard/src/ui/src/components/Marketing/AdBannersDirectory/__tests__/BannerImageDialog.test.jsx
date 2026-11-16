/* eslint-disable import/first */
// redesign AB-B4 (decision 3 → 3A; M-AB01, M-AB03, M-AB08, M-AB13, M-AB15, M-AB16, M-AB18, M-AB22, M-AB24, M-AB25): the image dialog.
// K/BannerImageDetails is a stateful stand-in that follows the README contract (state, setters, `handleSaveImage()` resolving
// `{ ok, error, result }`, closing on a successful add the way the real one does); K/BusinessProductsListing is a stub that hands its
// UIComponent a `businessState`; ImageCrop (cropperjs needs a canvas) is a stand-in that «crops» to a data URL. Dialog, ConfirmDialog,
// ImageField, RadioGroup, SearchField, Pagination and InlineNotice are the real Product wrappers. Nothing is ever sent.
import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  save: null,
  imageError: null,
  businessList: null,
  businessState: null,
  controllerProps: null,
  listingProps: null,
  mounts: 0,
  onSearch: null,
  onPage: null,
  cropProps: null,
  uiProps: null
}))

vi.mock('../../../Shared/UI/ImageCrop', () => ({
  ImageCrop: props => {
    mocks.cropProps = props
    return (
      <div data-testid='image-crop'>
        <button
          type='button'
          onClick={() => {
            props.handleChangePhoto('data:image/png;base64,CROPPED')
            props.onClose && props.onClose()
          }}
        >
          Crop
        </button>
      </div>
    )
  }
}))

vi.mock('../../../../../../index', async () => {
  const React = await import('react')
  const Controller = (props) => {
    const { UIComponent } = props
    const stored = props.image?.action
    const [changes, setChanges] = React.useState({})
    const [type, setType] = React.useState(stored?.type ?? (props.image ? 'none' : null)) // as the real one (P13)
    const [businessId, setBusinessId] = React.useState(stored?.business_id ?? null)
    const [categoryId, setCategoryId] = React.useState(stored?.category_id ?? null)
    const [productId, setProductId] = React.useState(stored?.product_id ?? null)
    const [loading, setLoading] = React.useState(false)
    const [search, setSearch] = React.useState(null)
    const [, repaint] = React.useState(0)
    React.useEffect(() => { mocks.mounts += 1 }, [])
    // as the real controller: choosing a link type puts the ids back to the stored action's
    const first = React.useRef(true)
    React.useEffect(() => {
      if (first.current) { first.current = false; return }
      setBusinessId(stored?.business_id ?? null)
      setCategoryId(stored?.category_id ?? null)
      setProductId(stored?.product_id ?? null)
    }, [type])
    mocks.controllerProps = props
    const handleSaveImage = async () => {
      setLoading(true)
      const result = await mocks.save({ type, businessId, categoryId, productId, changes })
      setLoading(false)
      if (result.ok && !props.image) props.onClose?.()
      return result
    }
    return (
      <UIComponent
        {...props}
        imageState={{ image: props.image, loading, error: mocks.imageError }}
        changesState={{ changes, loading: false, error: null }}
        handleChangeItem={(next) => setChanges(prev => ({ ...prev, ...next }))}
        searchValue={search}
        onSearch={(text) => { setSearch(text); mocks.onSearch(text) }}
        businessList={mocks.businessList}
        handleChangeBusinessPage={(page) => { mocks.onPage(page); repaint(n => n + 1) }}
        selectedLinkType={type}
        setSelectedLinkType={setType}
        selectedBusinessId={businessId}
        setSelectedBusinessId={setBusinessId}
        selectedCategoryId={categoryId}
        setSelectedCategoryId={setCategoryId}
        selectedProductId={productId}
        setSelectedProductId={setProductId}
        handleSaveImage={handleSaveImage}
      />
    )
  }
  const Listing = (props) => {
    const { UIComponent } = props
    mocks.listingProps = props
    return <UIComponent {...props} businessState={mocks.businessState} />
  }
  return {
    BannerImageDetails: Controller,
    BusinessProductsListing: Listing,
    useLanguage: () => [{ dictionary: {} }, (_key, text) => text],
    useUtils: () => [{ optimizeImage: (url, params) => `${url}?${params}` }],
    useApi: () => [{ fake: 'ordering' }]
  }
})

import { BannerImageDialog } from '../BannerImageDialog'

const kcf = { id: 1, name: 'KCF', slug: 'kcf', logo: null }
const bite = { id: 2, name: 'Fast Bite', slug: 'fast-bite', logo: null }
const dono = { id: 3, name: "Dono's Pizza", slug: 'donos', logo: null }
const listOf = (overrides = {}) => ({
  loading: false,
  businesses: [kcf, bite, dono],
  pagination: { current_page: 1, total_pages: 1, page_size: 10, total: 3 },
  ...overrides
})
const menu = {
  id: 1,
  categories: [{
    id: 10,
    name: 'Burgers',
    enabled: true,
    rank: 1,
    products: [{ id: 100, name: 'Classic', enabled: true, category_id: 10 }, { id: 101, name: 'Double', enabled: true, category_id: 10 }],
    subcategories: []
  }]
}

const web = { key: 'web_business_page', group: 'web', size: '1440 x 300', aspectRatio: 1440 / 300, showAspectRatioBox: false }
const app = { key: 'app_home_page', group: 'app', size: '300 x 300', aspectRatio: 1, showAspectRatioBox: true }

const businessImage = { id: 55, url: 'https://cdn.example.test/banner.png', action: { type: 'business', business_id: 1, url: '/store/kcf' } }
const productImage = {
  id: 56,
  url: 'https://cdn.example.test/banner2.png',
  action: { type: 'product', business_id: 99, category_id: 10, product_id: 100, url: '/store/old-shop?category=10&product=100' }
}
const otherImage = { id: 57, url: 'https://cdn.example.test/banner3.png', action: { type: 'category', url: '/search' } }

let host
const draw = (props = {}) => {
  host = {
    onClose: vi.fn(),
    handleDeleteBannerItem: vi.fn(async () => ({ ok: true, error: null, result: {} })),
    handleUpdateBannerItem: vi.fn(),
    handleSuccessBannerItemAdd: vi.fn()
  }
  const all = { open: true, image: null, bannerId: 9, bannerName: 'Summer sale', position: web, ...host, ...props }
  const view = render(<BannerImageDialog {...all} />)
  return { ...view, props: all }
}
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
const dialog = () => screen.getByRole('dialog')
const inDialog = () => within(dialog())
const fileInput = () => document.querySelector('input[type="file"]')
const send = (file) => fireEvent.change(fileInput(), { target: { files: [file] } })
const png = () => new File(['pixels'], 'banner.png', { type: 'image/png' })
const sized = (kilobytes, name = 'big.png', type = 'image/png') => {
  const file = new File(['x'], name, { type })
  Object.defineProperty(file, 'size', { value: kilobytes * 1024 })
  return file
}
const pickImage = async (u, file = png()) => {
  send(file)
  await u.click(await screen.findByRole('button', { name: 'Crop' }))
}
const chooseLink = (u, name) => u.click(screen.getByRole('radio', { name }))

beforeEach(() => {
  mocks.save = vi.fn(async () => ({ ok: true, error: null, result: {} }))
  mocks.imageError = null
  mocks.businessList = listOf()
  mocks.businessState = { business: menu, loading: false, error: null }
  mocks.controllerProps = null
  mocks.listingProps = null
  mocks.mounts = 0
  mocks.onSearch = vi.fn()
  mocks.onPage = vi.fn()
  mocks.cropProps = null
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  document.getElementById('app-modals')?.remove()
})

describe('BannerImageDialog · add and edit', () => {
  it('is «Add image» on add: the title, the primary button, «Cancel», and no «Delete image»', () => {
    draw()
    expect(screen.getByRole('dialog', { name: 'Add image' })).toBeInTheDocument()
    expect(inDialog().getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(inDialog().getByRole('button', { name: 'Add image' })).toBeInTheDocument()
    expect(inDialog().getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    expect(inDialog().queryByRole('button', { name: 'Delete image' })).toBeNull()
  })

  it('is «Edit image» on edit: «Delete image» at the start, «Cancel» and «Save image»', () => {
    draw({ image: businessImage })
    expect(screen.getByRole('dialog', { name: 'Edit image' })).toBeInTheDocument()
    const buttons = inDialog().getAllByRole('button').map(button => button.textContent)
    expect(buttons.slice(-3)).toEqual(['Delete image', 'Cancel', 'Save image'])
  })

  it('mounts K/BannerImageDetails only while open, searching by name, keyed by the image', () => {
    const { rerender, props } = draw({ open: false })
    expect(mocks.mounts).toBe(0)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<BannerImageDialog {...props} open />)
    expect(mocks.mounts).toBe(1)
    expect(mocks.controllerProps).toMatchObject({
      isSearchByName: true,
      bannerId: 9,
      image: null,
      aspectRatio: 1440 / 300,
      showAspectRatioBox: false
    })
    expect(mocks.controllerProps.handleDeleteBannerItem).toBe(props.handleDeleteBannerItem)
    expect(mocks.controllerProps.handleUpdateBannerItem).toBe(props.handleUpdateBannerItem)
    expect(mocks.controllerProps.handleSuccessBannerItemAdd).toBe(props.handleSuccessBannerItemAdd)
    rerender(<BannerImageDialog {...props} open={false} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<BannerImageDialog {...props} open image={businessImage} />)
    expect(mocks.mounts).toBe(2)
    rerender(<BannerImageDialog {...props} open image={productImage} />)
    expect(mocks.mounts).toBe(3)
  })

  it('gives the focus back to what opened it when it closes', async () => {
    const Opener = () => {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type='button' onClick={() => setOpen(true)}>Edit image 1 of Summer sale</button>
          <BannerImageDialog open={open} image={businessImage} bannerId={9} position={web} onClose={() => setOpen(false)} />
        </>
      )
    }
    const u = userEvent.setup()
    render(<Opener />)
    const tile = screen.getByRole('button', { name: 'Edit image 1 of Summer sale' })
    await u.click(tile)
    await screen.findByRole('dialog', { name: 'Edit image' })
    await u.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(tile).toHaveFocus()
  })
})

describe('BannerImageDialog · the image field', () => {
  it('is a required group named «Image» with the size and the 2 MB limit as its hint', () => {
    draw()
    const group = screen.getByRole('group', { name: /^Image/ })
    expect(group).toHaveTextContent('1440 x 300 · up to 2 MB')
    expect(within(group).getByRole('button', { name: 'Choose image' })).toBeInTheDocument()
  })

  it('shows the stored image (optimized) with «Change image», and the app size on an app position', () => {
    draw({ image: businessImage, position: app })
    const group = screen.getByRole('group', { name: /^Image/ })
    expect(within(group).getByRole('img')).toHaveAttribute('src', 'https://cdn.example.test/banner.png?h_130,c_limit')
    expect(within(group).getByRole('button', { name: 'Change image' })).toBeInTheDocument()
    expect(group).toHaveTextContent('300 x 300 · up to 2 MB')
  })

  it('keeps today\'s chooser filter and takes drops', () => {
    draw()
    expect(fileInput()).toHaveAttribute('accept', 'image/png, image/jpeg, image/jpg')
    const group = screen.getByRole('group', { name: /^Image/ })
    const two = [png(), png()]
    fireEvent.drop(group, { dataTransfer: { files: two } })
    expect(within(group).getByText('Drop one image at a time.')).toBeInTheDocument()
  })

  it('crops with the proportion of the position (web), and with the web-ratio box on app positions', async () => {
    const u = userEvent.setup()
    const first = draw()
    send(png())
    await screen.findByTestId('image-crop')
    expect(mocks.cropProps).toMatchObject({ aspectRatio: 1440 / 300, showAspectRatioBox: false })
    first.unmount()
    cleanup()
    draw({ position: app })
    send(png())
    await screen.findByTestId('image-crop')
    expect(mocks.cropProps).toMatchObject({ aspectRatio: 1, showAspectRatioBox: true })
    await u.click(screen.getByRole('button', { name: 'Crop' }))
  })

  it('shows the cropped image as the new preview and sends it as the change', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    const group = screen.getByRole('group', { name: /^Image/ })
    expect(within(group).getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED')
    expect(within(group).getByRole('button', { name: 'Change image' })).toBeInTheDocument()
  })

  it('refuses a file that is not an image, with main\'s message, and never opens the crop', async () => {
    draw()
    send(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(await screen.findByText('Only images can be accepted')).toBeInTheDocument()
    expect(screen.queryByTestId('image-crop')).toBeNull()
  })

  it('refuses a file over 2 MB, measured as main measures it, with main\'s message', async () => {
    draw()
    send(sized(2049))
    expect(await screen.findByText('The maximum image size is 2 megabytes')).toBeInTheDocument()
    expect(screen.queryByTestId('image-crop')).toBeNull()
  })

  it('accepts exactly 2 MB, and a webp (main accepts every image/*), and clears the message', async () => {
    const u = userEvent.setup()
    draw()
    send(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await screen.findByText('Only images can be accepted')
    send(sized(2048, 'exact.webp', 'image/webp'))
    expect(await screen.findByTestId('image-crop')).toBeInTheDocument()
    expect(screen.queryByText('Only images can be accepted')).toBeNull()
    await u.click(screen.getByRole('button', { name: 'Crop' }))
    const group = screen.getByRole('group', { name: /^Image/ })
    expect(within(group).getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,CROPPED')
  })
})

describe('BannerImageDialog · validation (M-AB25: each message names its field)', () => {
  it('says what is missing on add, field by field, and sends nothing', async () => {
    const u = userEvent.setup()
    draw()
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    const group = screen.getByRole('group', { name: /^Image/ })
    expect(within(group).getByText('Choose an image.')).toBeInTheDocument()
    expect(screen.getByText('Choose what the image links to.')).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('asks for the business of a business link, on its list', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await chooseLink(u, 'A business')
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    expect(screen.getByText('Choose a business.')).toBeInTheDocument()
    expect(screen.queryByText('Choose an image.')).toBeNull()
    expect(screen.queryByText('Choose what the image links to.')).toBeNull()
    expect(mocks.save).not.toHaveBeenCalled()
    await u.click(screen.getByRole('radio', { name: 'KCF' }))
    expect(screen.queryByText('Choose a business.')).toBeNull()
  })

  it('asks for the business, then for the product, of a product link', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await chooseLink(u, 'A product')
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    expect(screen.getByText('Choose a business.')).toBeInTheDocument()
    expect(screen.queryByText('Choose a product.')).toBeNull()
    await u.click(screen.getByRole('radio', { name: 'KCF' }))
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    expect(screen.getByText('Choose a product.')).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Burgers' }))
    await u.click(screen.getByRole('radio', { name: 'Classic' }))
    expect(screen.queryByText('Choose a product.')).toBeNull()
  })

  it('does not ask for an image on edit (the stored one stays)', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(screen.queryByText('Choose an image.')).toBeNull()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it('names the link group as required and tells the field its error', async () => {
    const u = userEvent.setup()
    draw()
    const group = screen.getByRole('radiogroup', { name: 'Link' })
    expect(group).toHaveAttribute('aria-required', 'true')
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(group.getAttribute('aria-describedby'))).toHaveTextContent('Choose what the image links to.')
  })
})

describe('BannerImageDialog · saving', () => {
  it('on add sends the image and a business link, and the controller closes it (once)', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await chooseLink(u, 'A business')
    await u.click(screen.getByRole('radio', { name: 'Fast Bite' }))
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    await waitFor(() => expect(host.onClose).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      type: 'business',
      businessId: 2,
      changes: { image: 'data:image/png;base64,CROPPED', type: 'image' }
    }))
  })

  it('on add sends a product link with the business, the category and the product', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await chooseLink(u, 'A product')
    await u.click(screen.getByRole('radio', { name: 'KCF' }))
    await u.click(screen.getByRole('button', { name: 'Burgers' }))
    await u.click(screen.getByRole('radio', { name: 'Double' }))
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'product', businessId: 1, categoryId: 10, productId: 101 }))
  })

  it('keeps the slug of a business picked on page 1 after the list moves to page 2', async () => {
    const u = userEvent.setup()
    mocks.businessList = listOf({ pagination: { current_page: 1, total_pages: 2, page_size: 10, total: 12 } })
    mocks.onPage = vi.fn(() => {
      mocks.businessList = listOf({ businesses: [{ id: 4, name: 'Else', slug: 'else' }], pagination: { current_page: 2, total_pages: 2, page_size: 10, total: 12 } })
    })
    draw()
    await chooseLink(u, 'A product')
    await u.click(screen.getByRole('radio', { name: 'Dono\'s Pizza' }))
    expect(mocks.listingProps.slug).toBe('donos')
    await u.click(screen.getByRole('button', { name: 'Next page' }))
    expect(screen.getByRole('radio', { name: 'Else' })).toBeInTheDocument()
    expect(mocks.listingProps.slug).toBe('donos')
    expect(screen.getByRole('button', { name: 'Burgers' })).toBeInTheDocument()
  })

  it('forgets the product of another business when the business changes', async () => {
    const u = userEvent.setup()
    mocks.businessList = listOf({ businesses: [kcf, bite, { id: 99, name: 'Old Shop', slug: 'old-shop' }] })
    draw({ image: productImage })
    await u.click(screen.getByRole('radio', { name: 'KCF' }))
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(screen.getByText('Choose a product.')).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('on edit shows «Saved» and closes after it, without asking to discard', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const u = user()
    draw({ image: businessImage })
    await u.click(screen.getByRole('radio', { name: 'Fast Bite' }))
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(host.onClose).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(host.onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Discard your changes?')).toBeNull()
  })

  it('does not close twice if the person closes the dialog during the «Saved» beat', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const u = user()
    draw({ image: businessImage })
    await u.click(screen.getByRole('radio', { name: 'Fast Bite' }))
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    await screen.findByText('Saved')
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    act(() => { vi.advanceTimersByTime(1000) })
    expect(host.onClose).toHaveBeenCalledTimes(1)
  })

  it('shows the button as busy while it saves and ignores a second click', async () => {
    let finish
    mocks.save = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const u = userEvent.setup()
    draw({ image: businessImage })
    const save = inDialog().getByRole('button', { name: 'Save image' })
    await u.click(save)
    expect(save).toHaveAttribute('aria-busy', 'true')
    await u.click(save)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ok: true, error: null, result: {} }) })
  })

  it('keeps the dialog open and shows the translated API error, and lets the person retry (M-AB08)', async () => {
    const u = userEvent.setup()
    mocks.save = vi.fn(async () => ({ ok: false, error: ['INTERNAL_ERROR'], result: ['INTERNAL_ERROR'] }))
    draw({ image: businessImage })
    const save = inDialog().getByRole('button', { name: 'Save image' })
    await u.click(save)
    expect(await screen.findByText('INTERNAL_ERROR')).toBeInTheDocument()
    expect(host.onClose).not.toHaveBeenCalled()
    expect(save).not.toHaveAttribute('aria-busy')
    expect(save).toBeEnabled()
    mocks.save = vi.fn(async () => ({ ok: true, error: null, result: {} }))
    await u.click(save)
    expect(mocks.save).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('INTERNAL_ERROR')).toBeNull())
  })

  it('falls back to a sentence when the failure carries no text, and when the call throws', async () => {
    const u = userEvent.setup()
    mocks.save = vi.fn(async () => ({ ok: false, error: null, result: null }))
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(await screen.findByText("We couldn't save the image. Try again.")).toBeInTheDocument()
    mocks.save = vi.fn(async () => { throw new Error('Network down') })
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(await screen.findByText('Network down')).toBeInTheDocument()
    expect(host.onClose).not.toHaveBeenCalled()
  })

  it('shows an error the controller keeps in its image state', () => {
    mocks.imageError = ['INTERNAL_ERROR']
    draw({ image: businessImage })
    expect(screen.getByText('INTERNAL_ERROR')).toBeInTheDocument()
  })
})

describe('BannerImageDialog · deleting (M-AB13, M-AB24)', () => {
  it('asks with verb and object, names the banner, and puts the focus on Cancel', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog', { name: 'Delete this image?' })
    expect(confirm).toHaveTextContent('It stops showing in "Summer sale". This can\'t be undone.')
    expect(within(confirm).getByRole('button', { name: 'Delete image' })).toBeInTheDocument()
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus())
    expect(host.handleDeleteBannerItem).not.toHaveBeenCalled()
  })

  it('says «this banner» when the host gives no name', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage, bannerName: undefined })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(confirm).toHaveTextContent('It stops showing in this banner. This can\'t be undone.')
  })

  it('Cancel leaves everything as it was', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog')
    await u.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(host.handleDeleteBannerItem).not.toHaveBeenCalled()
    expect(host.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Edit image' })).toBeInTheDocument()
  })

  it('on success deletes by id and closes', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog')
    await u.click(within(confirm).getByRole('button', { name: 'Delete image' }))
    await waitFor(() => expect(host.onClose).toHaveBeenCalledTimes(1))
    expect(host.handleDeleteBannerItem).toHaveBeenCalledWith(55)
  })

  it('on failure keeps the dialog open with the translated error and does not close', async () => {
    const u = userEvent.setup()
    const { props } = draw({ image: businessImage, handleDeleteBannerItem: vi.fn(async () => ({ ok: false, error: ['INTERNAL_ERROR'], result: null })) })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog')
    await u.click(within(confirm).getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByText('INTERNAL_ERROR')).toBeInTheDocument()
    expect(props.onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(screen.getByRole('dialog', { name: 'Edit image' })).toBeInTheDocument()
  })

  it('on failure without text says so with a sentence', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage, handleDeleteBannerItem: vi.fn(async () => ({ ok: false, error: null, result: null })) })
    await u.click(inDialog().getByRole('button', { name: 'Delete image' }))
    const confirm = await screen.findByRole('alertdialog')
    await u.click(within(confirm).getByRole('button', { name: 'Delete image' }))
    expect(await screen.findByText("We couldn't delete the image. Try again.")).toBeInTheDocument()
  })
})

describe('BannerImageDialog · a link main did not know (M-AB03)', () => {
  it('keeps it: a read-only line above the radios, none of them chosen, nothing asked', async () => {
    const u = userEvent.setup()
    draw({ image: otherImage })
    expect(screen.getByText('Link kept as it is (category)')).toBeInTheDocument()
    expect(screen.getAllByRole('radio').filter(radio => radio.getAttribute('aria-checked') === 'true')).toHaveLength(0)
    expect(screen.queryByRole('radiogroup', { name: 'Business' })).toBeNull()
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(screen.queryByText('Choose what the image links to.')).toBeNull()
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'category' }))
  })

  it('choosing a radio replaces it', async () => {
    const u = userEvent.setup()
    draw({ image: otherImage })
    await chooseLink(u, 'A business')
    expect(screen.queryByText(/Link kept as it is/)).toBeNull()
    expect(screen.getByRole('radiogroup', { name: 'Business' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'A business' })).toBeChecked()
  })
})

describe('BannerImageDialog · the business list (M-AB01)', () => {
  it('lists the businesses with the stored one checked, and the link type chosen', () => {
    draw({ image: businessImage })
    expect(screen.getByRole('radio', { name: 'A business' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'KCF' })).toBeChecked()
  })

  it('searches through the controller (debounced) and pages through it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const u = user()
    mocks.businessList = listOf({ pagination: { current_page: 1, total_pages: 3, page_size: 10, total: 25 } })
    draw({ image: businessImage })
    await u.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'fast')
    expect(mocks.onSearch).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(300) })
    expect(mocks.onSearch).toHaveBeenCalledWith('fast')
    await u.click(screen.getByRole('button', { name: 'Next page' }))
    expect(mocks.onPage).toHaveBeenCalledWith(2)
  })

  it('says which business is linked when it is not on the visible page', () => {
    mocks.businessList = listOf({ businesses: [bite, dono] })
    draw({ image: businessImage })
    expect(screen.getByText('Linked now: /store/kcf')).toBeInTheDocument() // redesign AB-R1 (review r1 #6): by its path, not its id
  })

  it('a product link has the same searchable, paginated list (it had the first 10 only)', async () => {
    const u = userEvent.setup()
    mocks.businessList = listOf({ businesses: [kcf, bite], pagination: { current_page: 1, total_pages: 2, page_size: 10, total: 12 } })
    draw({ image: productImage })
    expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument()
    expect(screen.getByText('Linked now: /store/old-shop')).toBeInTheDocument() // redesign AB-R1 (review r1 #6)
    await u.click(screen.getByRole('button', { name: 'Next page' }))
    expect(mocks.onPage).toHaveBeenCalledWith(2)
  })

  it('keeps the search the controller holds when the person switches between the two link types', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const u = user()
    draw()
    await chooseLink(u, 'A business')
    await u.type(screen.getByRole('searchbox', { name: 'Search businesses' }), 'fa')
    act(() => { vi.advanceTimersByTime(300) })
    await chooseLink(u, 'A product')
    expect(screen.getByRole('searchbox', { name: 'Search businesses' })).toHaveValue('fa')
  })
})

describe('BannerImageDialog · the product tree of a stored product link (M-AB22)', () => {
  it('opens the linked product\'s category and checks it, reading the slug from the stored URL when its business is not on the page', () => {
    draw({ image: productImage })
    expect(mocks.listingProps.slug).toBe('old-shop')
    expect(screen.getByRole('radio', { name: 'A product' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Burgers' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked()
  })

  it('takes the slug from the loaded page when the business is on it', () => {
    mocks.businessList = listOf({ businesses: [kcf, bite, { id: 99, name: 'Old Shop', slug: 'old-shop-2' }] })
    draw({ image: productImage })
    expect(mocks.listingProps.slug).toBe('old-shop-2')
  })

  it('saves the stored product link untouched when nothing changed', async () => {
    const u = userEvent.setup()
    draw({ image: productImage })
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'product', businessId: 99, categoryId: 10, productId: 100 }))
  })
})

describe('BannerImageDialog · discarding (decision 17)', () => {
  const guard = () => screen.findByRole('alertdialog', { name: 'Discard your changes?' })

  it('closes at once when nothing changed, by Cancel, the X and Escape', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    expect(host.onClose).toHaveBeenCalledTimes(1)
    await u.click(inDialog().getByRole('button', { name: 'Close' }))
    expect(host.onClose).toHaveBeenCalledTimes(2)
    await u.keyboard('{Escape}')
    await waitFor(() => expect(host.onClose).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks after a picked image, with «Keep editing» focused and «Discard» as the way out', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    const confirm = await guard()
    expect(confirm).toHaveTextContent('What you changed here is not saved yet.')
    await waitFor(() => expect(within(confirm).getByRole('button', { name: 'Keep editing' })).toHaveFocus())
    expect(host.onClose).not.toHaveBeenCalled()
    await u.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(host.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Add image' })).toBeInTheDocument()
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    await u.click(within(await guard()).getByRole('button', { name: 'Discard' }))
    expect(host.onClose).toHaveBeenCalledTimes(1)
  })

  it('asks from the X and from Escape too', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await u.click(inDialog().getByRole('button', { name: 'Close' }))
    await u.click(within(await guard()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await u.keyboard('{Escape}')
    await guard()
    expect(host.onClose).not.toHaveBeenCalled()
  })

  it('asks after a changed link on edit, and not after putting it back', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await chooseLink(u, 'A product')
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    await u.click(within(await guard()).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await chooseLink(u, 'A business')
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    expect(host.onClose).toHaveBeenCalledTimes(1)
  })

  it('asks after a different business on edit', async () => {
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(screen.getByRole('radio', { name: 'Fast Bite' }))
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    await guard()
  })

  it('does not close while it is saving', async () => {
    let finish
    mocks.save = vi.fn(() => new Promise(resolve => { finish = resolve }))
    const u = userEvent.setup()
    draw({ image: businessImage })
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    await u.click(inDialog().getByRole('button', { name: 'Cancel' }))
    expect(host.onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await act(async () => { finish({ ok: false, error: ['INTERNAL_ERROR'], result: null }) })
  })
})

// P13: api-core takes an image without a link (no action key). Left out on an edit, the stored link stays, so «No link» is
// offered only while there is no stored link (a new image, or one saved without a link).
describe('BannerImageDialog · «No link» (P13)', () => {
  const unlinkedImage = { id: 58, url: 'https://cdn.example.test/banner4.png', action: null }

  it('adds an image with «No link», without asking for a business', async () => {
    const u = userEvent.setup()
    draw()
    await pickImage(u)
    await chooseLink(u, 'No link')
    expect(screen.queryByRole('radio', { name: 'Fast Bite' })).toBeNull()
    await u.click(inDialog().getByRole('button', { name: 'Add image' }))
    await waitFor(() => expect(host.onClose).toHaveBeenCalledTimes(1))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'none' }))
  })

  it('opens an image saved without a link on «No link», and saves it as it is', async () => {
    const u = userEvent.setup()
    draw({ image: unlinkedImage })
    expect(screen.getByRole('radio', { name: 'No link' })).toBeChecked()
    await u.click(inDialog().getByRole('button', { name: 'Save image' }))
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ type: 'none' }))
  })

  it('does not offer «No link» for an image that has a link (the API keeps a stored link)', () => {
    draw({ image: businessImage })
    expect(screen.getByRole('radio', { name: 'A business' })).toBeChecked()
    expect(screen.queryByRole('radio', { name: 'No link' })).toBeNull()
  })
})
