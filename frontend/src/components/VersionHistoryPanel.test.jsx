import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import NoteEditor from '../pages/NoteEditor'

vi.mock('../services/notes')

const BASE_NOTE = {
  id: 'note1',
  title: 'Test Note',
  body: 'Hello world',
  note_type: 'text',
  is_encrypted: false,
}

const MOCK_VERSIONS = [
  {
    snapshot_id: 'snap1',
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    body_preview: 'Old content from an hour ago',
  },
  {
    snapshot_id: 'snap2',
    timestamp: new Date(Date.now() - 7_200_000).toISOString(),
    body_preview: 'Even older content',
  },
]

function renderEditor(id = 'note1') {
  return render(
    <MemoryRouter initialEntries={[`/notes/${id}`]}>
      <Routes>
        <Route path="/notes/:id" element={<NoteEditor />} />
      </Routes>
    </MemoryRouter>
  )
}

async function openHistoryPanel() {
  await waitFor(() => screen.getByDisplayValue('Test Note'))
  await userEvent.click(screen.getByRole('button', { name: /version history/i }))
  await waitFor(() => screen.getByText('Version History'))
}

describe('VersionHistoryPanel — opening the panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.getNote.mockResolvedValue(BASE_NOTE)
    notesService.getVersions.mockResolvedValue(MOCK_VERSIONS)
    notesService.updateNote.mockResolvedValue(BASE_NOTE)
  })

  it('History button opens the version history panel', async () => {
    renderEditor()
    await openHistoryPanel()
    expect(screen.getByText('Version History')).toBeInTheDocument()
  })

  it('History button is not shown on a new note', () => {
    notesService.createNote.mockResolvedValue({ id: 'new1', note_type: 'text' })
    renderEditor('new')
    expect(screen.queryByRole('button', { name: /version history/i })).not.toBeInTheDocument()
  })

  it('closes the panel when the close button is clicked', async () => {
    renderEditor()
    await openHistoryPanel()
    await userEvent.click(screen.getByRole('button', { name: /close history panel/i }))
    expect(screen.queryByText('Version History')).not.toBeInTheDocument()
  })
})

describe('VersionHistoryPanel — version list', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.getNote.mockResolvedValue(BASE_NOTE)
    notesService.getVersions.mockResolvedValue(MOCK_VERSIONS)
  })

  it('renders versions with body previews', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => {
      expect(screen.getByText('Old content from an hour ago')).toBeInTheDocument()
      expect(screen.getByText('Even older content')).toBeInTheDocument()
    })
  })

  it('shows relative timestamps with absolute timestamp in the title attribute', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => {
      const timestampSpans = screen.getAllByTitle(
        (_, el) => el?.tagName === 'SPAN' && el?.title !== ''
      )
      expect(timestampSpans.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows empty state when there are no previous versions', async () => {
    notesService.getVersions.mockResolvedValue([])
    renderEditor()
    await openHistoryPanel()
    await waitFor(() =>
      expect(screen.getByText('No previous versions yet.')).toBeInTheDocument()
    )
  })

  it('Preview button toggles a read-only preview of the version body', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getByText('Old content from an hour ago'))
    const previewBtns = screen.getAllByRole('button', { name: /preview/i })
    await userEvent.click(previewBtns[0])
    expect(screen.getAllByText('Old content from an hour ago').length).toBeGreaterThan(1)
    await userEvent.click(screen.getByRole('button', { name: /hide/i }))
    expect(screen.getAllByText('Old content from an hour ago').length).toBe(1)
  })
})

describe('VersionHistoryPanel — restore flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.getNote.mockResolvedValue(BASE_NOTE)
    notesService.getVersions.mockResolvedValue(MOCK_VERSIONS)
    notesService.restoreVersion.mockResolvedValue({
      ...BASE_NOTE,
      body: 'Old content from an hour ago',
    })
  })

  it('clicking Restore opens the confirmation dialog', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getAllByRole('button', { name: /restore/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(/This will replace the current note with the selected version/i)
    ).toBeInTheDocument()
  })

  it('Cancel button in the dialog dismisses it without calling the API', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getAllByRole('button', { name: /restore/i }))
    await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[0])
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(notesService.restoreVersion).not.toHaveBeenCalled()
  })

  it('confirming restore calls the API with correct IDs and refreshes the editor', async () => {
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getAllByRole('button', { name: /restore/i }))

    // Click first Restore button in the version list
    await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[0])

    // Confirm in the dialog
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /restore/i }))

    expect(notesService.restoreVersion).toHaveBeenCalledWith('note1', 'snap1')

    // Editor body textarea should reflect restored content
    await waitFor(() => {
      expect(
        screen.getByRole('textbox', { name: /markdown editor/i })
      ).toHaveValue('Old content from an hour ago')
    })
  })

  it('after restore the version list is refreshed', async () => {
    const updatedVersions = [
      {
        snapshot_id: 'snap3',
        timestamp: new Date().toISOString(),
        body_preview: 'Current state (before restore)',
      },
      ...MOCK_VERSIONS,
    ]
    notesService.getVersions
      .mockResolvedValueOnce(MOCK_VERSIONS)
      .mockResolvedValueOnce(updatedVersions)

    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getAllByRole('button', { name: /restore/i }))

    await userEvent.click(screen.getAllByRole('button', { name: /restore/i })[0])
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /restore/i }))

    await waitFor(() =>
      expect(screen.getByText('Current state (before restore)')).toBeInTheDocument()
    )
  })
})

describe('VersionHistoryPanel — corrupted versions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notesService.getNote.mockResolvedValue({
      ...BASE_NOTE,
      note_type: 'secure',
      is_encrypted: true,
    })
  })

  it('shows warning style for a version that could not be decrypted', async () => {
    notesService.getVersions.mockResolvedValue([
      {
        snapshot_id: 'bad1',
        timestamp: new Date().toISOString(),
        body_preview: '[Could not decrypt]',
      },
    ])
    renderEditor()
    await openHistoryPanel()
    await waitFor(() =>
      expect(screen.getByText('Could not decrypt')).toBeInTheDocument()
    )
    expect(screen.getByText('Could not decrypt')).toHaveClass('text-red-600')
  })

  it('disables Restore for a corrupted version', async () => {
    notesService.getVersions.mockResolvedValue([
      {
        snapshot_id: 'bad1',
        timestamp: new Date().toISOString(),
        body_preview: '[Could not decrypt]',
      },
    ])
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getByText('Could not decrypt'))
    expect(screen.getByRole('button', { name: /restore/i })).toBeDisabled()
  })

  it('disables Preview for a corrupted version', async () => {
    notesService.getVersions.mockResolvedValue([
      {
        snapshot_id: 'bad1',
        timestamp: new Date().toISOString(),
        body_preview: '[Could not decrypt]',
      },
    ])
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getByText('Could not decrypt'))
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
  })

  it('does not disable Restore for a valid version alongside a corrupted one', async () => {
    notesService.getVersions.mockResolvedValue([
      {
        snapshot_id: 'bad1',
        timestamp: new Date(Date.now() - 1000).toISOString(),
        body_preview: '[Could not decrypt]',
      },
      {
        snapshot_id: 'good1',
        timestamp: new Date(Date.now() - 2000).toISOString(),
        body_preview: 'Valid content',
      },
    ])
    renderEditor()
    await openHistoryPanel()
    await waitFor(() => screen.getByText('Valid content'))
    const restoreBtns = screen.getAllByRole('button', { name: /restore/i })
    expect(restoreBtns[0]).toBeDisabled()
    expect(restoreBtns[1]).not.toBeDisabled()
  })
})
