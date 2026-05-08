import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import NoteEditor from './NoteEditor'

vi.mock('../services/notes')

function renderEditor(path = '/notes/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notes/:id" element={<NoteEditor />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('NoteEditor — secure note toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.createNote.mockResolvedValue({ id: 'abc123', note_type: 'text' })
    notesService.updateNote.mockResolvedValue({ id: 'abc123' })
    notesService.getNote.mockResolvedValue({
      id: 'abc123',
      title: '',
      body: '',
      note_type: 'text',
      is_encrypted: false,
    })
  })

  it('shows "Mark as Secure" checkbox on new note', () => {
    renderEditor('/notes/new')
    expect(screen.getByRole('checkbox', { name: /mark as secure/i })).toBeInTheDocument()
  })

  it('sends note_type "text" when toggle is off', async () => {
    renderEditor('/notes/new')
    await userEvent.type(screen.getByPlaceholderText('Title'), 'My note')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(notesService.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ note_type: 'text' })
    )
  })

  it('sends note_type "secure" when toggle is on', async () => {
    renderEditor('/notes/new')
    await userEvent.click(screen.getByRole('checkbox', { name: /mark as secure/i }))
    await userEvent.type(screen.getByPlaceholderText('Title'), 'Secret')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(notesService.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ note_type: 'secure' })
    )
  })

  it('does not show toggle when editing an existing note', async () => {
    notesService.getNote.mockResolvedValue({
      id: 'abc123',
      title: 'Existing',
      body: 'content',
      note_type: 'text',
      is_encrypted: false,
    })
    renderEditor('/notes/abc123')
    await waitFor(() => expect(screen.getByDisplayValue('Existing')).toBeInTheDocument())
    expect(screen.queryByRole('checkbox', { name: /mark as secure/i })).not.toBeInTheDocument()
  })
})

describe('NoteEditor — encrypted badge', () => {
  it('shows "Encrypted" badge for an existing secure note', async () => {
    notesService.getNote.mockResolvedValue({
      id: 'sec1',
      title: 'Secret',
      body: 'plaintext',
      note_type: 'secure',
      is_encrypted: true,
    })
    renderEditor('/notes/sec1')
    await waitFor(() => expect(screen.getByText('Encrypted')).toBeInTheDocument())
  })

  it('does not show "Encrypted" badge for a text note', async () => {
    notesService.getNote.mockResolvedValue({
      id: 'txt1',
      title: 'Plain',
      body: 'hello',
      note_type: 'text',
      is_encrypted: false,
    })
    renderEditor('/notes/txt1')
    await waitFor(() => expect(screen.getByDisplayValue('Plain')).toBeInTheDocument())
    expect(screen.queryByText('Encrypted')).not.toBeInTheDocument()
  })
})

describe('NoteEditor — decryption failure', () => {
  it('shows "This note could not be decrypted" when API returns 403 DECRYPTION_FAILED', async () => {
    const err = new Error('Decryption failed.')
    err.code = 'DECRYPTION_FAILED'
    notesService.getNote.mockRejectedValue(err)
    renderEditor('/notes/broken')
    await waitFor(() =>
      expect(screen.getByText('This note could not be decrypted.')).toBeInTheDocument()
    )
  })

  it('does not show the editor when decryption fails', async () => {
    const err = new Error('Decryption failed.')
    err.code = 'DECRYPTION_FAILED'
    notesService.getNote.mockRejectedValue(err)
    renderEditor('/notes/broken')
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Write your note in Markdown…')).not.toBeInTheDocument()
    )
  })
})
