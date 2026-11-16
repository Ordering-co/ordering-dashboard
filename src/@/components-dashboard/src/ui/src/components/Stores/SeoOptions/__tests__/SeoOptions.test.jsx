/* eslint-disable import/first */
// redesign stores 5.1b: the SEO form of a store, a category and a product on Product. Covered: every field has a label
// tied to its control; the save bar counts what differs from the stored value (the category keeps its whole record in `changes`);
// «Use the … name and description»; save (spy on the consumer's request), «Saved», the failed save with «Try again»; discard for
// each consumer's own state; the store's slug (StoreSlugField) and the category's slug rule; the product's
// cleanup on unmount; and the image, with P/ImageField stood in (the crop has its own tests).
import React, { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const probe = vi.hoisted(() => ({ validated: undefined }))

vi.mock('../../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }]
}))
// `~components` and the relative index are the same module: both mocks must say the same
vi.mock('~components', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useUtils: () => [{ optimizeImage: url => url }]
}))
vi.mock('../../../Shared/Product/ImageField', () => ({
  ImageField: (props) => (
    <div data-testid='image-field' data-value={props.value}>
      <span>{props.label}</span>
      <button type='button' onClick={() => props.onChange('data:image/png;base64,AAA')}>Pick image</button>
      <button type='button' onClick={() => { probe.validated = props.validateFile({ type: 'text/plain', size: 10 }) }}>Pick text file</button>
      {props.error && <span data-testid='image-error'>{props.error}</span>}
    </div>
  )
}))

import { SeoOptions } from '../index'

const STORE = { id: 2, name: 'Fast Bite', description: 'Quick food', seo_title: 'Old title', seo_description: '', slug: 'fastbite', seo_image: '' }
const CATEGORY = { id: 5, name: 'Pizzas', description: 'Hot pizzas', seo_title: 'Cat title', seo_description: 'cat desc', slug: 'pizzas', seo_image: '' }
const PRODUCT = { id: 9, name: 'Margherita', description: 'Tomato and basil', seo_title: 'Prod title', seo_description: 'prod desc', seo_keywords: 'pizza', slug: 'margherita', seo_image: '' }

// Each consumer keeps its own state, as its controller does. A successful save stores the changes (the category's controller keeps
// the whole record in `changes`; the store's and the product's are emptied).
const Harness = ({ kind = 'store', data: initialData, spy, patches, cleanSpy, result = { ok: true }, initialChanges, staleData = false, realClean = false }) => {
  const base = initialData || { store: STORE, category: CATEGORY, product: PRODUCT }[kind]
  const [data, setData] = useState(base)
  const [formState, setFormState] = useState({
    loading: false,
    changes: initialChanges || (kind === 'category' ? { ...base } : {})
  })
  const latest = useRef(null)
  latest.current = { data, formState }
  Harness.formState = formState
  // another record opened in the same panel: the controller replaces `changes` and keeps `result` (review R-1)
  Harness.open = (record) => {
    setData(record)
    setFormState(prev => ({ ...prev, changes: kind === 'category' ? { ...record } : {} }))
  }

  const setter = kind === 'store'
    ? setFormState
    : (patch) => {
        patches && patches.push(patch)
        setFormState(prev => ({ ...prev, changes: { ...prev.changes, ...patch } }))
      }

  const handleUpdateClick = async (...args) => {
    spy && spy(...args)
    if (result.ok && staleData) {
      // as the real category and product controllers: the answer goes to `formState.result`, the record given (`data`) stays
      const answer = { ...latest.current.data, ...latest.current.formState.changes }
      setFormState(prev => ({ ...prev, changes: kind === 'category' ? { ...answer } : {}, result: { error: false, result: answer } }))
    } else if (result.ok) {
      const merged = { ...latest.current.data, ...latest.current.formState.changes }
      setData(merged)
      setFormState(prev => ({ ...prev, changes: kind === 'category' ? { ...merged } : {} }))
    }
    return result
  }

  return (
    <SeoOptions
      data={data}
      formState={formState}
      setFormState={setter}
      handleUpdateClick={handleUpdateClick}
      cleanFormState={realClean
        ? (values) => {
            cleanSpy && cleanSpy(values)
            setFormState(prev => ({ ...prev, ...values }))
          }
        : cleanSpy}
      isBusinessSeo={kind === 'store'}
      isCategorySeo={kind === 'category'}
      isProductSeo={kind === 'product'}
    />
  )
}

const box = name => screen.getByRole('textbox', { name })
const bar = () => screen.queryByRole('group', { name: 'Save changes' })
const saveButton = () => screen.getByRole('button', { name: 'Save changes' })
const type = async (name, text) => {
  const field = box(name)
  await userEvent.clear(field)
  await userEvent.type(field, text)
}

beforeEach(() => {
  probe.validated = undefined
})
afterEach(() => {
  Harness.formState = undefined
})

describe('SeoOptions · labels', () => {
  it('store: every field has a label tied to its control, and no SEO Keywords', () => {
    render(<Harness kind='store' />)
    expect(box('SEO Title')).toHaveValue('Old title')
    expect(box('SEO Description')).toHaveValue('')
    expect(box('Slug')).toHaveValue('fastbite')
    expect(screen.getByText('SEO Image')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'SEO Keywords' })).toBeNull()
  })

  it('category: same fields, no SEO Keywords', () => {
    render(<Harness kind='category' />)
    expect(box('SEO Title')).toHaveValue('Cat title')
    expect(box('SEO Description')).toHaveValue('cat desc')
    expect(box('Slug')).toHaveValue('pizzas')
    expect(screen.queryByRole('textbox', { name: 'SEO Keywords' })).toBeNull()
  })

  it('product: SEO Keywords is there', () => {
    render(<Harness kind='product' />)
    expect(box('SEO Keywords')).toHaveValue('pizza')
    expect(box('SEO Title')).toHaveValue('Prod title')
    expect(box('Slug')).toHaveValue('margherita')
  })
})

describe('SeoOptions · what counts as changed', () => {
  it('store: no bar before a change; one change is counted and named; typing the stored value back leaves nothing', async () => {
    render(<Harness kind='store' />)
    expect(bar()).toBeNull()
    await type('SEO Title', 'New title')
    const group = bar()
    expect(group).not.toBeNull()
    expect(within(group).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(group).getByText(/SEO Title/)).toBeInTheDocument()
    await type('SEO Title', 'Old title')
    expect(bar()).toBeNull()
    expect(Harness.formState.changes).toEqual({})
    expect('seo_title' in Harness.formState.changes).toBe(false)
  })

  it('category: its whole record in `changes` counts as nothing on mount; editing the description counts 1', async () => {
    render(<Harness kind='category' />)
    expect(bar()).toBeNull()
    await userEvent.type(box('SEO Description'), '!')
    expect(within(bar()).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(bar()).getByText(/SEO Description/)).toBeInTheDocument()
  })

  it('product: changes start empty; an edit of the keywords counts 1', async () => {
    render(<Harness kind='product' />)
    expect(bar()).toBeNull()
    await userEvent.type(box('SEO Keywords'), ', pasta')
    expect(within(bar()).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(bar()).getByText(/SEO Keywords/)).toBeInTheDocument()
  })
})

describe('SeoOptions · use the name and description', () => {
  it('store: fills title and description only, and a slug typed before stays pending', async () => {
    render(<Harness kind='store' />)
    await userEvent.type(box('Slug'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Use the store\'s name and description' }))
    expect(box('SEO Title')).toHaveValue('Fast Bite')
    expect(box('SEO Description')).toHaveValue('Quick food')
    expect(box('Slug')).toHaveValue('fastbite2')
    expect(Harness.formState.changes).toEqual({ seo_title: 'Fast Bite', seo_description: 'Quick food', slug: 'fastbite2' })
    expect(within(bar()).getByText('3 unsaved changes')).toBeInTheDocument()
  })

  it('never writes «undefined» when the data has no description (title only)', async () => {
    render(<Harness kind='store' data={{ ...STORE, description: undefined }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Use the store\'s name and description' }))
    expect(box('SEO Title')).toHaveValue('Fast Bite')
    expect(box('SEO Description')).toHaveValue('')
    expect(Harness.formState.changes).toEqual({ seo_title: 'Fast Bite' })
    expect(document.body.textContent).not.toContain('undefined')
  })

  it('category and product show their own label', async () => {
    const category = render(<Harness kind='category' />)
    await userEvent.click(screen.getByRole('button', { name: 'Use the category\'s name and description' }))
    expect(box('SEO Title')).toHaveValue('Pizzas')
    expect(box('SEO Description')).toHaveValue('Hot pizzas')
    category.unmount()

    render(<Harness kind='product' />)
    await userEvent.click(screen.getByRole('button', { name: 'Use the product\'s name and description' }))
    expect(box('SEO Title')).toHaveValue('Margherita')
    expect(box('SEO Description')).toHaveValue('Tomato and basil')
  })
})

describe('SeoOptions · save', () => {
  it('calls the consumer\'s request once with no arguments, then says «Saved»', async () => {
    const spy = vi.fn()
    render(<Harness kind='store' spy={spy} />)
    await type('SEO Title', 'New title')
    await userEvent.click(saveButton())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith()
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull()
  })

  it('category and product save the same way', async () => {
    const spy = vi.fn()
    const category = render(<Harness kind='category' spy={spy} />)
    await userEvent.type(box('SEO Title'), '!')
    await userEvent.click(saveButton())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith()
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    category.unmount()

    const productSpy = vi.fn()
    render(<Harness kind='product' spy={productSpy} />)
    await userEvent.type(box('SEO Keywords'), '!')
    await userEvent.click(saveButton())
    expect(productSpy).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('a failed save says why in the bar and offers «Try again»', async () => {
    const spy = vi.fn()
    render(<Harness kind='store' spy={spy} result={{ ok: false, error: ['Boom'] }} />)
    await type('SEO Title', 'New title')
    await userEvent.click(saveButton())
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Boom')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })
    expect(screen.queryByText('Saved')).toBeNull()
    await userEvent.click(retry)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('a failed save with the API\'s slug message shows it', async () => {
    render(<Harness kind='store' result={{ ok: false, error: ['Slug already in use'] }} />)
    await userEvent.type(box('Slug'), '2')
    await userEvent.click(saveButton())
    expect(await screen.findByText('Slug already in use')).toBeInTheDocument()
  })
})

describe('SeoOptions · discard', () => {
  it('store: removes the SEO keys and the slug from the shared form and the fields show the stored values', async () => {
    render(<Harness kind='store' initialChanges={{ name: 'Other' }} />)
    await type('SEO Title', 'New title')
    await userEvent.type(box('Slug'), '2')
    expect(Harness.formState.changes).toEqual({ name: 'Other', seo_title: 'New title', slug: 'fastbite2' })
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(Harness.formState.changes).toEqual({ name: 'Other' })
    expect(box('SEO Title')).toHaveValue('Old title')
    expect(box('Slug')).toHaveValue('fastbite')
    expect(bar()).toBeNull()
  })

  it('category: calls setFormState with the stored values of the changed keys', async () => {
    const patches = []
    render(<Harness kind='category' patches={patches} />)
    await userEvent.type(box('SEO Description'), '!')
    patches.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(patches).toEqual([{ seo_description: 'cat desc' }])
    expect(box('SEO Description')).toHaveValue('cat desc')
    expect(bar()).toBeNull()
  })

  it('product: calls setFormState with the stored values of the changed keys', async () => {
    const patches = []
    render(<Harness kind='product' patches={patches} />)
    await userEvent.type(box('SEO Keywords'), ', pasta')
    patches.length = 0
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(patches).toEqual([{ seo_keywords: 'pizza' }])
    expect(box('SEO Keywords')).toHaveValue('pizza')
    expect(bar()).toBeNull()
  })
})

describe('SeoOptions · slug', () => {
  it('store: only letters and numbers are kept', async () => {
    render(<Harness kind='store' />)
    await userEvent.type(box('Slug'), '-é')
    expect(box('Slug')).toHaveValue('fastbite')
    expect(bar()).toBeNull()
  })

  it('store: an empty slug says «Slug is required» and is not saved', async () => {
    const spy = vi.fn()
    render(<Harness kind='store' spy={spy} />)
    await userEvent.clear(box('Slug'))
    expect(screen.getByText('Slug is required')).toBeInTheDocument()
    await userEvent.click(saveButton())
    expect(spy).not.toHaveBeenCalled()
    expect(await screen.findByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('category: a slug with special characters is not allowed and is not saved', async () => {
    const spy = vi.fn()
    render(<Harness kind='category' spy={spy} />)
    await type('Slug', 'my cat')
    await userEvent.click(saveButton())
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText('The slug is not allowed special characters.')).toBeInTheDocument()
    expect(screen.getByText('Fix 1 field to save.')).toBeInTheDocument()
  })

  it('category: an unchanged stored slug with a dash does not block the save', async () => {
    const spy = vi.fn()
    render(<Harness kind='category' spy={spy} data={{ ...CATEGORY, slug: 'my-cat' }} />)
    await userEvent.type(box('SEO Title'), '!')
    await userEvent.click(saveButton())
    expect(spy).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('The slug is not allowed special characters.')).toBeNull()
  })

  // main no owner loses the store's slug any more
  it('a store always has its Slug field, and so does a category', () => {
    render(<Harness kind='store' />)
    expect(box('Slug')).toBeInTheDocument()
    expect(box('SEO Title')).toBeInTheDocument()
    cleanup()
    render(<Harness kind='category' />)
    expect(box('Slug')).toBeInTheDocument()
  })
})

describe('SeoOptions · lifecycle', () => {
  it('product: on unmount cleanFormState is called with `{ changes: {} }`', () => {
    const cleanSpy = vi.fn()
    const view = render(<Harness kind='product' cleanSpy={cleanSpy} />)
    expect(cleanSpy).not.toHaveBeenCalled()
    view.unmount()
    expect(cleanSpy).toHaveBeenCalledTimes(1)
    expect(cleanSpy).toHaveBeenCalledWith({ changes: {} })
  })
})

describe('SeoOptions · image (G2-05)', () => {
  it('an image given by the field is counted as «SEO Image»', async () => {
    render(<Harness kind='store' />)
    await userEvent.click(screen.getByRole('button', { name: 'Pick image' }))
    const group = bar()
    expect(within(group).getByText('1 unsaved change')).toBeInTheDocument()
    expect(within(group).getByText(/SEO Image/)).toBeInTheDocument()
    expect(screen.getByTestId('image-field')).toHaveAttribute('data-value', 'data:image/png;base64,AAA')
  })

  it('a file that is not an image is refused with «Only images can be accepted»', async () => {
    render(<Harness kind='store' />)
    await userEvent.click(screen.getByRole('button', { name: 'Pick text file' }))
    expect(probe.validated).toBe(false)
    expect(screen.getByTestId('image-error')).toHaveTextContent('Only images can be accepted')
    expect(bar()).toBeNull()
  })

  it('discard drops the image', async () => {
    render(<Harness kind='category' />)
    await userEvent.click(screen.getByRole('button', { name: 'Pick image' }))
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    })
    expect(bar()).toBeNull()
    expect(screen.getByTestId('image-field')).toHaveAttribute('data-value', '')
  })
})

// redesign stores 5.1b: found in the live smoke of a category's SEO. Their controllers keep a save's answer in
// `formState.result` and do not refresh the record they were given, so the answer is the stored value: nothing stays «unsaved».
describe('SeoOptions · category and product after a save (the answer is the stored value)', () => {
  it.each(['category', 'product'])('%s: «Saved», and nothing counts as changed', async (kind) => {
    render(<Harness kind={kind} staleData />)
    await type('SEO Title', 'Fresh title')
    expect(bar()).toHaveTextContent('1 unsaved change')
    await userEvent.click(saveButton())
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(bar()).not.toHaveTextContent('unsaved')
    expect(box('SEO Title')).toHaveValue('Fresh title')
  })
})

// redesign stores 5.1b, Opus review R-1 and R-2
describe('SeoOptions · review R-1: the answer of a save belongs to its own record', () => {
  it.each(['category', 'product'])('%s: after saving one, another opened shows its own values and nothing pending', async (kind) => {
    const spy = vi.fn()
    render(<Harness kind={kind} staleData spy={spy} />)
    await type('SEO Title', 'Title of A')
    await userEvent.click(saveButton())
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    const other = { id: 77, name: 'Other', description: 'Other desc', seo_title: 'B title', seo_description: '', seo_keywords: '', slug: 'other', seo_image: '' }
    act(() => Harness.open(other))
    expect(box('SEO Title')).toHaveValue('B title')
    expect(bar()).not.toHaveTextContent('unsaved')
  })
})

describe('SeoOptions · review R-2: Discard in a product leaves nothing for the next request', () => {
  it('the SEO keys leave the product\'s changes; the next save sends only what changed', async () => {
    render(<Harness kind='product' realClean />)
    await type('SEO Title', 'Typed')
    await type('SEO Keywords', 'kw')
    await userEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(Harness.formState.changes).toEqual({})
    await type('SEO Description', 'Only this')
    expect(Harness.formState.changes).toEqual({ seo_description: 'Only this' })
  })
})
