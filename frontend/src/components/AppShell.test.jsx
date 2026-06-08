import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import { ThemeProvider } from './ThemeProvider'
import AppShell from './AppShell'
import NotesLayout from './NotesLayout'
import EmptyEditorPane from './EmptyEditorPane'
import TrashPage from '../pages/TrashPage'
import SettingsPage from '../pages/SettingsPage'

vi.mock('../services/notes')

function mockMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function renderApp(path = '/notes') {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/notes" element={<NotesLayout />}>
              <Route index element={<EmptyEditorPane />} />
            </Route>
            <Route path="/trash" element={<TrashPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  document.documentElement.classList.remove('light', 'dark')
  mockMatchMedia()
  notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
  notesService.getTags.mockResolvedValue({ tags: [] })
  notesService.listTrash.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
})

// ---------------------------------------------------------------------------
// AppShell — top chrome and layout
// ---------------------------------------------------------------------------

describe('AppShell — top chrome', () => {
  it('renders the AstraNotes title in the chrome bar', () => {
    renderApp()
    // Title appears at minimum in the top chrome
    expect(screen.getAllByText('AstraNotes').length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Sidebar — navigation
// ---------------------------------------------------------------------------

describe('Sidebar — desktop nav', () => {
  it('renders All notes, Trash, and Settings nav items', async () => {
    renderApp()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(screen.getByText('All notes')).toBeInTheDocument()
    expect(screen.getByText('Trash')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows the note count badge after the API resolves', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 7, next_cursor: null })
    renderApp()
    await waitFor(() => expect(screen.getByText('7')).toBeInTheDocument())
  })

  it('hides the count badge when total is not yet known', () => {
    // Before the async effect resolves, count is null — badge should not appear
    notesService.listNotes.mockReturnValue(new Promise(() => {})) // never resolves
    renderApp()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})

describe('Sidebar — mobile drawer', () => {
  it('mobile hamburger button opens the sidebar drawer', async () => {
    renderApp()
    const hamburger = screen.getByRole('button', { name: /open sidebar/i })
    await userEvent.click(hamburger)
    expect(screen.getByRole('button', { name: /close sidebar/i })).toBeInTheDocument()
  })

  it('close button in mobile drawer dismisses it', async () => {
    renderApp()
    await userEvent.click(screen.getByRole('button', { name: /open sidebar/i }))
    const closeBtn = screen.getByRole('button', { name: /close sidebar/i })
    await userEvent.click(closeBtn)
    expect(screen.queryByRole('button', { name: /close sidebar/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// EmptyEditorPane
// ---------------------------------------------------------------------------

describe('EmptyEditorPane', () => {
  it('renders "No note selected" message at /notes', async () => {
    renderApp('/notes')
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(screen.getByText('No note selected')).toBeInTheDocument()
  })

  it('renders a New note button', async () => {
    renderApp('/notes')
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// TrashPage
// ---------------------------------------------------------------------------

describe('TrashPage', () => {
  it('renders the trash empty state at /trash', async () => {
    renderApp('/trash')
    await waitFor(() => expect(notesService.listTrash).toHaveBeenCalled())
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// SettingsPage
// ---------------------------------------------------------------------------

describe('SettingsPage', () => {
  it('renders the settings placeholder at /settings', async () => {
    renderApp('/settings')
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(
      screen.getByText('App settings will appear here in a future update.')
    ).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// NotesLayout — pane routing
// ---------------------------------------------------------------------------

describe('NotesLayout — pane switching', () => {
  it('shows the empty editor pane at /notes', async () => {
    renderApp('/notes')
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(screen.getByText('Pick a note from the list or create a new one.')).toBeInTheDocument()
  })
})
