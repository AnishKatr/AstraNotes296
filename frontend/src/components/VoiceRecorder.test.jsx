import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesService from '../services/notes'
import VoiceRecorder from './VoiceRecorder'

vi.mock('../services/notes')

function renderRecorder(props = {}) {
  return render(<VoiceRecorder noteId="note1" audioFileId={null} {...props} />)
}

// ---------------------------------------------------------------------------
// Feature detection (NFR-02)
// ---------------------------------------------------------------------------

describe('VoiceRecorder — MediaRecorder unavailable', () => {
  beforeEach(() => {
    // jsdom has no MediaRecorder; make it explicit so later stubs don't leak in.
    vi.stubGlobal('MediaRecorder', undefined)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders a disabled record button', () => {
    renderRecorder()
    expect(screen.getByRole('button', { name: /record audio/i })).toBeDisabled()
  })

  it('record button has a tooltip explaining the limitation', () => {
    renderRecorder()
    const btn = screen.getByRole('button', { name: /record audio/i })
    expect(btn).toHaveAttribute('title', expect.stringMatching(/not supported in this browser/i))
  })

  it('does not show an audio player when no audio is attached', () => {
    renderRecorder()
    expect(document.querySelector('audio')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Recording and upload flow
// ---------------------------------------------------------------------------

describe('VoiceRecorder — recording flow', () => {
  // capturedMR is set by the class constructor each time new MediaRecorder() is called.
  let capturedMR

  beforeEach(() => {
    // Vitest 4.x requires a class (not mockReturnValue) when mocking a constructor.
    vi.stubGlobal('MediaRecorder', class {
      constructor() {
        const mr = { start: vi.fn(), ondataavailable: null, onstop: null }
        mr.stop = vi.fn().mockImplementation(() => {
          if (typeof mr.onstop === 'function') mr.onstop()
        })
        capturedMR = mr
        return mr
      }
    })

    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    })

    notesService.uploadAudio.mockResolvedValue({ audio_file_id: 'gfs-file-id', note_type: 'voice' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('clicking Record then Stop calls uploadAudio with a Blob', async () => {
    renderRecorder()

    await userEvent.click(screen.getByRole('button', { name: /record audio/i }))

    // getUserMedia resolves, MediaRecorder starts, Stop button appears.
    await waitFor(() => screen.getByRole('button', { name: /stop recording/i }))

    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    // stop() fires onstop() which calls doUpload() -> uploadAudio().
    await waitFor(() => expect(notesService.uploadAudio).toHaveBeenCalledWith(
      'note1',
      expect.any(Blob),
    ))
  })

  it('shows the audio player after a successful upload', async () => {
    renderRecorder()
    await userEvent.click(screen.getByRole('button', { name: /record audio/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop recording/i }))
    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    await waitFor(() => expect(document.querySelector('audio')).not.toBeNull())
    expect(document.querySelector('audio')).toHaveAttribute('src', '/api/notes/note1/audio')
  })

  it('415 response shows unsupported-format error message', async () => {
    const err = new Error('Unsupported audio format.')
    err.code = 'UNSUPPORTED_AUDIO_FORMAT'
    notesService.uploadAudio.mockRejectedValue(err)

    renderRecorder()
    await userEvent.click(screen.getByRole('button', { name: /record audio/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop recording/i }))
    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Unsupported audio format')
    )
  })

  it('413 response shows too-large error message', async () => {
    const err = new Error('Audio too large.')
    err.code = 'AUDIO_TOO_LARGE'
    notesService.uploadAudio.mockRejectedValue(err)

    renderRecorder()
    await userEvent.click(screen.getByRole('button', { name: /record audio/i }))
    await waitFor(() => screen.getByRole('button', { name: /stop recording/i }))
    await userEvent.click(screen.getByRole('button', { name: /stop recording/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Recording is too large (max 10 MB)')
    )
  })
})

// ---------------------------------------------------------------------------
// Playback
// ---------------------------------------------------------------------------

describe('VoiceRecorder — audio playback', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('renders an audio player when audioFileId is already set', () => {
    vi.stubGlobal('MediaRecorder', undefined) // feature detection state doesn't matter for playback
    renderRecorder({ audioFileId: 'existing-file-id' })
    const audio = document.querySelector('audio')
    expect(audio).not.toBeNull()
    expect(audio).toHaveAttribute('src', '/api/notes/note1/audio')
  })

  it('does not render audio player when audioFileId is null', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    renderRecorder({ audioFileId: null })
    expect(document.querySelector('audio')).toBeNull()
  })
})
