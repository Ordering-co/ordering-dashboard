import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '~/__tests__/helpers/testUtils'

// redesign (B2): the page of /profile. The controller of UserDetails is outside this file: it is mocked with a stand-in
// that records the props it gets and renders the UIComponent with `handleGoogleAccountLink`, as the real one does.
const state = vi.hoisted(() => ({
  user: null,
  isCollapse: false,
  handleMenuCollapse: null,
  controllerProps: null,
  formProps: null,
  link: null
}))

vi.mock('../../../../../index', () => ({
  useLanguage: () => [{}, (_key, fallback) => fallback],
  useSession: () => [{ user: state.user }],
  UserDetails: (props) => {
    state.controllerProps = props
    const { UIComponent } = props
    return <UIComponent {...props} handleGoogleAccountLink={state.link} />
  }
}))

vi.mock('../../../contexts/InfoShareContext', () => ({
  useInfoShare: () => [{ isCollapse: state.isCollapse }, { handleMenuCollapse: state.handleMenuCollapse }]
}))

// the edit form of the profile: a stand-in that records its props (P12)
vi.mock('../ProfilePage/ProfileEditForm', () => ({
  ProfileEditForm: (props) => {
    state.formProps = props
    return <div data-testid='profile-form'>form</div>
  }
}))

vi.mock('../Sessions', () => ({
  Sessions: () => <div data-testid='sessions-card'>sessions</div>
}))

import { ProfilePage, ProfilePageUI } from '../ProfilePage'

const theme = {
  colors: {},
  images: { general: { googleCalendarIcon: 'google-calendar.svg' } },
  third_party_code: {}
}

const makeUser = (overrides = {}) => ({
  id: 7,
  level: 0,
  name: 'Ordering',
  lastname: 'Admin',
  email: 'admin@ordering.co',
  cellphone: '+1 555 0100',
  photo: null,
  session_strategy: 'jwt_session',
  ...overrides
})

const renderPage = (user = makeUser()) => {
  state.user = user
  return renderWithProviders(<ProfilePage />, { theme })
}

beforeEach(() => {
  state.user = makeUser()
  state.isCollapse = false
  state.handleMenuCollapse = vi.fn()
  state.controllerProps = null
  state.formProps = null
  state.link = vi.fn()
})

describe('ProfilePage · controller wiring', () => {
  it('mounts the UserDetails controller with ProfilePageUI and the id of the session user', () => {
    renderPage()
    expect(state.controllerProps.UIComponent).toBe(ProfilePageUI)
    expect(state.controllerProps.userId).toBe(7)
  })

  it('hands the controller a copy of the session user, equal to it but not the same object (PF-09)', () => {
    const sessionUser = makeUser()
    renderPage(sessionUser)
    expect(state.controllerProps.user).toEqual(sessionUser)
    expect(state.controllerProps.user).not.toBe(sessionUser)
  })

  it('keeps the same copy while the session user is the same (memoized by user)', () => {
    const sessionUser = makeUser()
    const { rerender } = renderPage(sessionUser)
    const first = state.controllerProps.user
    rerender(<ProfilePage />)
    expect(state.controllerProps.user).toBe(first)
  })

  it('passes the props of the page through', () => {
    state.user = makeUser()
    renderWithProviders(<ProfilePage foo='bar' />, { theme })
    expect(state.controllerProps.foo).toBe('bar')
  })
})

describe('ProfilePage · structure (D1 A)', () => {
  it('is a column root with the Product header: h1 «Profile» and its description', () => {
    const { container } = renderPage()
    const root = container.querySelector("[data-slot='profile-page']")
    expect(root).toHaveClass('odc-profile')
    expect(root).toHaveAttribute('dir', 'ltr')
    expect(screen.getByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument()
    expect(screen.getByText('Your account and where it is signed in')).toBeInTheDocument()
  })

  it('puts the account card, then the Google Calendar card (level 8), then the sessions', () => {
    state.user = makeUser({ level: 8 })
    const { container } = renderWithProviders(<ProfilePage />, { theme })
    const regions = Array.from(container.querySelectorAll('.odc-profile > section, .odc-profile > [data-testid]'))
    expect(regions.map(node => node.getAttribute('data-testid') || node.querySelector('h2').textContent)).toEqual(['Account', 'Google Calendar', 'sessions-card'])
  })

  it('has the menu button only when the menu is collapsed, and it opens the menu once', async () => {
    const closed = renderPage()
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull()
    closed.unmount()

    state.isCollapse = true
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Open menu' }))
    expect(state.handleMenuCollapse).toHaveBeenCalledTimes(1)
    expect(state.handleMenuCollapse).toHaveBeenCalledWith(false)
  })

  // the opener is PageHeader's `leading`, the first child of the lead block (before the title)
  it('puts the menu button in the page header lead block, as its first child, with no wrapper of its own', () => {
    state.isCollapse = true
    const { container } = renderPage()
    const button = screen.getByRole('button', { name: 'Open menu' })
    expect(button.closest('.odc-pagehead-lead')?.firstElementChild).toBe(button)
    expect(container.querySelector('.odc-profile-head')).toBeNull()
    expect(container.querySelector('.odc-profile > .odc-pagehead')).not.toBeNull()
  })
})

describe('ProfilePage · account card (D5)', () => {
  it('shows the full name, the email and the phone in a left-to-right bdi', () => {
    renderPage(makeUser({ name: ' Ordering ', lastname: ' Admin ' }))
    const account = screen.getByRole('region', { name: 'Account' })
    expect(within(account).getByText('Ordering Admin')).toBeInTheDocument()
    expect(within(account).getByText('admin@ordering.co')).toBeInTheDocument()
    const phone = within(account).getByText('+1 555 0100')
    expect(phone.tagName).toBe('BDI')
    expect(phone).toHaveAttribute('dir', 'ltr')
  })

  it('has no phone line without a phone, and no stray «undefined» without a last name', () => {
    renderPage(makeUser({ cellphone: null, lastname: undefined }))
    const account = screen.getByRole('region', { name: 'Account' })
    expect(account.querySelector('bdi')).toBeNull()
    expect(within(account).getByText('Ordering')).toBeInTheDocument()
    expect(account).not.toHaveTextContent('undefined')
  })

  it.each([
    [0, 'Administrator'],
    [2, 'Business owner'],
    [5, 'Driver manager'],
    [8, 'Professional']
  ])('names level %s as «%s» beside the name', (level, label) => {
    renderPage(makeUser({ level }))
    const account = screen.getByRole('region', { name: 'Account' })
    expect(within(account).getByText(label)).toBeInTheDocument()
    for (const other of ['Administrator', 'Business owner', 'Driver manager', 'Professional']) {
      if (other !== label) expect(within(account).queryByText(other)).toBeNull()
    }
  })

  it('has no role tag for a level it does not name', () => {
    renderPage(makeUser({ level: 3 }))
    expect(screen.getByRole('region', { name: 'Account' }).querySelector('.odc-profile-tag')).toBeNull()
  })

  it.each(['readOnlyAdmin', 'readOnlyBusinessOwner', 'readOnlyDeliveryManager', 'viewOnlyBusinessOwner'])('tags a user with %s as «Read only»', (flag) => {
    renderPage(makeUser({ [flag]: true }))
    expect(within(screen.getByRole('region', { name: 'Account' })).getByText('Read only')).toBeInTheDocument()
  })

  it('has no «Read only» tag for a user who can write', () => {
    renderPage()
    expect(screen.queryByText('Read only')).toBeNull()
  })

  it('shows the initials when there is no photo (PF-06)', () => {
    const { container } = renderPage()
    expect(container.querySelector('.odc-avatar')).toHaveTextContent('OA')
    expect(container.querySelector('.odc-avatar img')).toBeNull()
  })

  it('shows the photo, and the initials again when it fails to load (PF-06)', () => {
    const { container } = renderPage(makeUser({ photo: 'https://example.com/broken.png' }))
    const image = container.querySelector('.odc-avatar img')
    expect(image).toHaveAttribute('src', 'https://example.com/broken.png')
    fireEvent.error(image)
    expect(container.querySelector('.odc-avatar img')).toBeNull()
    expect(container.querySelector('.odc-avatar')).toHaveTextContent('OA')
  })

  it('draws the avatar large, which the CSS takes to --od-x-profile-avatar', () => {
    const { container } = renderPage()
    const avatar = container.querySelector('.odc-avatar')
    expect(avatar).toHaveAttribute('data-size', 'lg')
    expect(avatar).toHaveAttribute('data-kind', 'person')
  })
})

describe('ProfilePage · Google Calendar card (D6)', () => {
  it.each([0, 2, 5])('is not there for level %s', (level) => {
    renderPage(makeUser({ level }))
    expect(screen.queryByRole('region', { name: 'Google Calendar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sync with Google calendar' })).toBeNull()
  })

  it('shows the explanation, visible, and no (i) button, for level 8', () => {
    renderPage(makeUser({ level: 8 }))
    const card = screen.getByRole('region', { name: 'Google Calendar' })
    expect(card).toHaveTextContent('Connect your Professional account with your Google account to synchronize the appointments with the Google calendar Application.')
    expect(card).toHaveTextContent('do not forget to notify the admin to Complete the synchronization.')
    expect(screen.queryByRole('button', { name: 'Information' })).toBeNull()
  })

  it('has the button with the Google icon, which calls the controller', async () => {
    state.link = vi.fn()
    renderPage(makeUser({ level: 8 }))
    const button = screen.getByRole('button', { name: 'Sync with Google calendar' })
    const icon = button.querySelector('img')
    expect(icon).toHaveAttribute('src', 'google-calendar.svg')
    expect(icon).toHaveAttribute('alt', '')
    await userEvent.setup().click(button)
    expect(state.link).toHaveBeenCalledTimes(1)
  })

  it('says the browser blocked the window, and takes it away when pressed again', async () => {
    state.link = vi.fn()
      .mockResolvedValueOnce({ ok: false, reason: 'popup-blocked' })
      .mockResolvedValueOnce({ ok: true })
    renderPage(makeUser({ level: 8 }))
    const user = userEvent.setup()
    const warning = 'Your browser blocked the Google window. Allow pop-ups for this site and try again.'

    await user.click(screen.getByRole('button', { name: 'Sync with Google calendar' }))
    expect(await screen.findByText(warning)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sync with Google calendar' }))
    await waitFor(() => expect(screen.queryByText(warning)).toBeNull())
    expect(state.link).toHaveBeenCalledTimes(2)
  })

  it.each([undefined, { ok: true }, { ok: false, reason: 'other' }, null])('shows no warning when the controller answers %j', async (answer) => {
    state.link = vi.fn().mockResolvedValue(answer)
    renderPage(makeUser({ level: 8 }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sync with Google calendar' }))
    await waitFor(() => expect(state.link).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/blocked the Google window/)).toBeNull()
  })
})

// P12 (D-15): api-core lets level 2 edit itself through POST /users/{id} (never its level). Levels 5 and 8 wait for the
// check with a real account; level 0 edits itself in Users.
describe('ProfilePage · «Edit profile» (P12)', () => {
  it('lets a business owner open the form of their own profile', async () => {
    const user = userEvent.setup()
    const owner = makeUser({ level: 2 })
    renderPage(owner)
    expect(screen.queryByTestId('profile-form')).toBeNull()
    await user.click(within(screen.getByRole('region', { name: 'Account' })).getByRole('button', { name: 'Edit profile' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit profile' })
    expect(within(dialog).getByTestId('profile-form')).toBeInTheDocument()
    expect(state.formProps.user).toEqual(owner)
  })

  it.each([0, 5, 8])('has no «Edit profile» for level %s', (level) => {
    renderPage(makeUser({ level }))
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
  })

  it('has no «Edit profile» for a read-only business owner', () => {
    renderPage(makeUser({ level: 2, readOnlyBusinessOwner: true }))
    expect(screen.queryByRole('button', { name: 'Edit profile' })).toBeNull()
  })
})
