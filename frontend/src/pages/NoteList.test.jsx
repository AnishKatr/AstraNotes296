import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import NoteList from './NoteList'

vi.mock('../services/notes')

const NOW = new Date().toISOString()

function note(overrides) {
  return { id: '1', title: 'Untitled', note_type: 'text', is_encrypted: false, updated_at: NOW, ...overrides }
}

function renderList() {
  return render(
    <MemoryRouter>
      <NoteList />
    </MemoryRouter>
  )
}

// ---------------------------------------------------------------------------
// Phase 2 regression: lock icon for secure notes
// ---------------------------------------------------------------------------

describe('NoteList — lock icon for secure notes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows lock icon for a secure note', async () => {
    notesService.listNotes.mockResolvedValue({
      notes: [note({ id: '1', title: 'Secret', note_type: 'secure', is_encrypted: true })],
      total: 1,
      next_cursor: null,
    })
    renderList()
    await waitFor(() =>
      expect(screen.getByLabelText('Encrypted note')).toBeInTheDocument()
    )
  })

  it('does not show lock icon for a text note', async () => {
    notesService.listNotes.mockResolvedValue({
      notes: [note({ id: '2', title: 'Plain' })],
      total: 1,
      next_cursor: null,
    })
    renderList()
    await waitFor(() => expect(screen.getByText('Plain')).toBeInTheDocument())
    expect(screen.queryByLabelText('Encrypted note')).not.toBeInTheDocument()
  })

  it('shows lock icon only for secure notes in a mixed list', async () => {
    notesService.listNotes.mockResolvedValue({
      notes: [
        note({ id: '1', title: 'Secret', note_type: 'secure', is_encrypted: true }),
        note({ id: '2', title: 'Plain' }),
      ],
      total: 2,
      next_cursor: null,
    })
    renderList()
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    expect(screen.getAllByLabelText('Encrypted note')).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Phase 4: type filter (US-05)
// ---------------------------------------------------------------------------

describe('NoteList — type filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders All, Text, Voice, Secure filter buttons', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    for (const label of ['All', 'Text', 'Voice', 'Secure']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('calls API with type=text immediately when Text filter is clicked', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalledTimes(1))
    notesService.listNotes.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Text' }))

    await waitFor(() =>
      expect(notesService.listNotes).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'text' })
      )
    )
  })

  it('calls API with type=secure immediately when Secure filter is clicked', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalledTimes(1))
    notesService.listNotes.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Secure' }))

    await waitFor(() =>
      expect(notesService.listNotes).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'secure' })
      )
    )
  })

  it('calls API without type param when All filter is selected', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalledTimes(1))
    notesService.listNotes.mockClear()

    // Switch to Text then back to All
    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    notesService.listNotes.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())

    const lastArg = notesService.listNotes.mock.calls.at(-1)[0]
    expect(lastArg.type).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Phase 4: search bar debounce (US-05)
// ---------------------------------------------------------------------------

describe('NoteList — search debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('does not call the API synchronously when typing', async () => {
    renderList()
    await act(async () => {}) // flush initial mount
    notesService.listNotes.mockClear()

    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'alpha' },
    })

    expect(notesService.listNotes).not.toHaveBeenCalled()
  })

  it('does not call the API before 300 ms have elapsed', async () => {
    renderList()
    await act(async () => {})
    notesService.listNotes.mockClear()

    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'alpha' },
    })
    act(() => vi.advanceTimersByTime(299))

    expect(notesService.listNotes).not.toHaveBeenCalled()
  })

  it('calls the API with the search term after 300 ms', async () => {
    renderList()
    await act(async () => {})
    notesService.listNotes.mockClear()

    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'alpha' },
    })

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(notesService.listNotes).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'alpha' })
    )
  })
})

// ---------------------------------------------------------------------------
// Phase 4: clear button (US-05)
// ---------------------------------------------------------------------------

describe('NoteList — clear button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
  })

  it('clear button is not visible when the search input is empty', async () => {
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
  })

  it('clear button appears once text is typed', async () => {
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())

    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'hello' },
    })
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
  })

  it('clicking clear resets the input and triggers a refetch without query', async () => {
    vi.useFakeTimers()
    renderList()
    await act(async () => {}) // flush initial mount
    notesService.listNotes.mockClear()

    // Type a search term and let debounce fire
    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'hello' },
    })
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(notesService.listNotes).toHaveBeenCalledWith(expect.objectContaining({ q: 'hello' }))
    notesService.listNotes.mockClear()

    // Click clear — should reset immediately (no debounce)
    fireEvent.click(screen.getByLabelText('Clear search'))
    await act(async () => {})

    expect(screen.getByPlaceholderText('Search notes...')).toHaveValue('')
    expect(notesService.listNotes).toHaveBeenCalled()
    const lastArg = notesService.listNotes.mock.calls.at(-1)[0]
    expect(lastArg.q).toBeUndefined()

    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Phase 4: empty states (US-05)
// ---------------------------------------------------------------------------

describe('NoteList — empty states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "No notes yet" when there are no notes and no filter is active', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() =>
      expect(screen.getByText('No notes yet. Create one above.')).toBeInTheDocument()
    )
  })

  it('shows "No notes match" when a type filter returns empty results', async () => {
    notesService.listNotes
      .mockResolvedValueOnce({
        notes: [note({ id: '1', title: 'A text note' })],
        total: 1,
        next_cursor: null,
      })
      .mockResolvedValueOnce({ notes: [], total: 0, next_cursor: null })

    renderList()
    await waitFor(() => expect(screen.getByText('A text note')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Secure' }))

    await waitFor(() =>
      expect(screen.getByText('No notes match your search.')).toBeInTheDocument()
    )
  })

  it('shows "No notes match" when a text search returns empty results', async () => {
    vi.useFakeTimers()
    notesService.listNotes
      .mockResolvedValueOnce({
        notes: [note({ id: '1', title: 'Existing note' })],
        total: 1,
        next_cursor: null,
      })
      .mockResolvedValueOnce({ notes: [], total: 0, next_cursor: null })

    renderList()
    await act(async () => {})

    fireEvent.change(screen.getByPlaceholderText('Search notes...'), {
      target: { value: 'zzznomatch' },
    })
    await act(async () => { vi.advanceTimersByTime(300) })

    expect(screen.getByText('No notes match your search.')).toBeInTheDocument()

    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Phase 4: Load more / cursor pagination (US-05)
// ---------------------------------------------------------------------------

describe('NoteList — Load more', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Load more button when next_cursor is not null', async () => {
    notesService.listNotes.mockResolvedValue({
      notes: [note({ id: '1', title: 'First' })],
      total: 3,
      next_cursor: 'cursor-abc',
    })
    renderList()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
    )
  })

  it('does not show Load more button when next_cursor is null', async () => {
    notesService.listNotes.mockResolvedValue({
      notes: [note({ id: '1', title: 'Only one' })],
      total: 1,
      next_cursor: null,
    })
    renderList()
    await waitFor(() => expect(screen.getByText('Only one')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('appends next page results when Load more is clicked', async () => {
    notesService.listNotes
      .mockResolvedValueOnce({
        notes: [note({ id: '1', title: 'First' })],
        total: 2,
        next_cursor: 'cursor-abc',
      })
      .mockResolvedValueOnce({
        notes: [note({ id: '2', title: 'Second' })],
        total: 2,
        next_cursor: null,
      })

    renderList()
    await waitFor(() => expect(screen.getByText('First')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(screen.getByText('Second')).toBeInTheDocument())
    expect(screen.getByText('First')).toBeInTheDocument() // still present
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('calls Load more with the cursor from the previous page', async () => {
    notesService.listNotes.mockResolvedValueOnce({
      notes: [note({ id: '1', title: 'First' })],
      total: 2,
      next_cursor: 'cursor-abc',
    })
    notesService.listNotes.mockResolvedValueOnce({
      notes: [note({ id: '2', title: 'Second' })],
      total: 2,
      next_cursor: null,
    })

    renderList()
    await waitFor(() => screen.getByRole('button', { name: 'Load more' }))

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))

    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalledTimes(2))
    expect(notesService.listNotes).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-abc' })
    )
  })
})

// ---------------------------------------------------------------------------
// Phase 4: secure note search hint
// ---------------------------------------------------------------------------

describe('NoteList — secure note hint', () => {
  it('renders the search disclaimer about secure notes', async () => {
    notesService.listNotes.mockResolvedValue({ notes: [], total: 0, next_cursor: null })
    renderList()
    await waitFor(() => expect(notesService.listNotes).toHaveBeenCalled())
    expect(
      screen.getByText('Secure note contents are not searchable.')
    ).toBeInTheDocument()
  })
})
