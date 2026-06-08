import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import TrashPage from './TrashPage'

vi.mock('../services/notes')

const NOW = new Date().toISOString()

function note(overrides) {
  return {
    id: '1',
    title: 'Trashed Note',
    note_type: 'text',
    is_encrypted: false,
    deleted: true,
    deleted_at: NOW,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TrashPage />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('TrashPage — empty state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listTrash.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
  })

  it('shows "Trash is empty" when there are no deleted notes', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Trash is empty')).toBeInTheDocument())
  })

  it('does not show the Empty trash button when trash is empty', async () => {
    renderPage()
    await waitFor(() => expect(notesService.listTrash).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /empty trash/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Note list
// ---------------------------------------------------------------------------

describe('TrashPage — note list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listTrash.mockResolvedValue({
      notes: [note({ id: '1', title: 'Old draft' })],
      total: 1,
      next_cursor: null,
    })
  })

  it('renders the title of each trashed note', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Old draft')).toBeInTheDocument())
  })

  it('shows Restore and Delete permanently buttons for each note', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Old draft')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /restore old draft/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete old draft permanently/i })).toBeInTheDocument()
  })

  it('shows the Empty trash button when notes exist', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /empty trash/i })).toBeInTheDocument())
  })

  it('shows lock icon for encrypted trashed notes', async () => {
    notesService.listTrash.mockResolvedValue({
      notes: [note({ id: '2', title: 'Secret', note_type: 'secure', is_encrypted: true })],
      total: 1,
      next_cursor: null,
    })
    renderPage()
    await waitFor(() => expect(screen.getByLabelText('Encrypted note')).toBeInTheDocument())
  })
})

// ---------------------------------------------------------------------------
// Restore flow
// ---------------------------------------------------------------------------

describe('TrashPage — restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listTrash
      .mockResolvedValueOnce({
        notes: [note({ id: '1', title: 'To restore' })],
        total: 1,
        next_cursor: null,
      })
      .mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    notesService.restoreNote.mockResolvedValue({ id: '1', deleted: false })
  })

  it('calls restoreNote when Restore is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /restore to restore/i }))
    await userEvent.click(screen.getByRole('button', { name: /restore to restore/i }))
    expect(notesService.restoreNote).toHaveBeenCalledWith('1')
  })

  it('reloads the list after a successful restore', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /restore to restore/i }))
    await userEvent.click(screen.getByRole('button', { name: /restore to restore/i }))
    await waitFor(() => expect(notesService.listTrash).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Permanent delete — confirmation dialog
// ---------------------------------------------------------------------------

describe('TrashPage — permanent delete confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listTrash
      .mockResolvedValueOnce({
        notes: [note({ id: '1', title: 'Doomed' })],
        total: 1,
        next_cursor: null,
      })
      .mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    notesService.permanentDeleteNote.mockResolvedValue(null)
  })

  it('opens confirmation dialog when Delete permanently is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /delete doomed permanently/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete doomed permanently/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument()
  })

  it('cancels and closes dialog when Cancel is clicked', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /delete doomed permanently/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete doomed permanently/i }))
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notesService.permanentDeleteNote).not.toHaveBeenCalled()
  })

  it('calls permanentDeleteNote and reloads after confirmation', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /delete doomed permanently/i }))
    await userEvent.click(screen.getByRole('button', { name: /delete doomed permanently/i }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /delete permanently/i }))
    expect(notesService.permanentDeleteNote).toHaveBeenCalledWith('1')
    await waitFor(() => expect(notesService.listTrash).toHaveBeenCalledTimes(2))
  })
})

// ---------------------------------------------------------------------------
// Empty trash
// ---------------------------------------------------------------------------

describe('TrashPage — empty trash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listTrash.mockResolvedValue({
      notes: [note({ id: '1', title: 'Bye' })],
      total: 1,
      next_cursor: null,
    })
    notesService.emptyTrash.mockResolvedValue(null)
  })

  it('opens empty-trash confirmation dialog', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /empty trash/i }))
    await userEvent.click(screen.getByRole('button', { name: /empty trash/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/permanently deleted/i)).toBeInTheDocument()
  })

  it('calls emptyTrash after confirmation', async () => {
    renderPage()
    await waitFor(() => screen.getByRole('button', { name: /empty trash/i }))
    await userEvent.click(screen.getByRole('button', { name: /empty trash/i }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /empty trash/i }))
    expect(notesService.emptyTrash).toHaveBeenCalled()
  })
})
