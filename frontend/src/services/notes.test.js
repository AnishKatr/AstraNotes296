import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createNote,
  deleteNote,
  getNote,
  getVersions,
  listNotes,
  restoreVersion,
  updateNote,
  uploadAudio,
} from './notes'

// ---------------------------------------------------------------------------
// Fetch mock helpers
// ---------------------------------------------------------------------------

function mockOk(body, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  })
}

function mockNoContent() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 204,
    json: () => Promise.resolve(null),
  })
}

function mockError(status, body = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

function mockErrorBadJson(status) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new SyntaxError('bad json')),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// listNotes
// ---------------------------------------------------------------------------

describe('listNotes', () => {
  it('calls /api/notes with no query string when invoked with no args', async () => {
    mockOk({ notes: [], total: 0 })
    const result = await listNotes()
    expect(fetch).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(result).toEqual({ notes: [], total: 0 })
  })

  it('appends q param when provided', async () => {
    mockOk({ notes: [] })
    await listNotes({ q: 'meeting' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=meeting'), expect.any(Object)
    )
  })

  it('appends type param when provided', async () => {
    mockOk({ notes: [] })
    await listNotes({ type: 'secure' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('type=secure'), expect.any(Object)
    )
  })

  it('appends limit param when provided', async () => {
    mockOk({ notes: [] })
    await listNotes({ limit: 20 })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('limit=20'), expect.any(Object)
    )
  })

  it('appends cursor param when provided', async () => {
    mockOk({ notes: [] })
    await listNotes({ cursor: 'abc123' })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('cursor=abc123'), expect.any(Object)
    )
  })

  it('combines multiple params', async () => {
    mockOk({ notes: [] })
    await listNotes({ q: 'hello', type: 'text', limit: 10 })
    const url = fetch.mock.calls[0][0]
    expect(url).toContain('q=hello')
    expect(url).toContain('type=text')
    expect(url).toContain('limit=10')
  })
})

// ---------------------------------------------------------------------------
// getNote
// ---------------------------------------------------------------------------

describe('getNote', () => {
  it('calls /api/notes/<id> and returns the note', async () => {
    const note = { id: '123', title: 'Test', body: 'hi' }
    mockOk(note)
    const result = await getNote('123')
    expect(fetch).toHaveBeenCalledWith('/api/notes/123', expect.any(Object))
    expect(result).toEqual(note)
  })
})

// ---------------------------------------------------------------------------
// createNote
// ---------------------------------------------------------------------------

describe('createNote', () => {
  it('POSTs to /api/notes with JSON body', async () => {
    const note = { id: '1', title: 'New', body: 'body' }
    mockOk(note, 201)
    const result = await createNote({ title: 'New', body: 'body', note_type: 'text' })
    expect(fetch).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'New', body: 'body', note_type: 'text' }),
    }))
    expect(result).toEqual(note)
  })
})

// ---------------------------------------------------------------------------
// updateNote
// ---------------------------------------------------------------------------

describe('updateNote', () => {
  it('PATCHes /api/notes/<id> with JSON body', async () => {
    const updated = { id: '1', title: 'Updated', body: 'new body' }
    mockOk(updated)
    const result = await updateNote('1', { title: 'Updated', body: 'new body' })
    expect(fetch).toHaveBeenCalledWith('/api/notes/1', expect.objectContaining({
      method: 'PATCH',
    }))
    expect(result).toEqual(updated)
  })
})

// ---------------------------------------------------------------------------
// deleteNote
// ---------------------------------------------------------------------------

describe('deleteNote', () => {
  it('DELETEs /api/notes/<id> and returns null on 204', async () => {
    mockNoContent()
    const result = await deleteNote('1')
    expect(fetch).toHaveBeenCalledWith('/api/notes/1', expect.objectContaining({
      method: 'DELETE',
    }))
    expect(result).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// getVersions
// ---------------------------------------------------------------------------

describe('getVersions', () => {
  it('fetches /api/notes/<id>/versions', async () => {
    const versions = [{ snapshot_id: 'v1', body_preview: 'hi' }]
    mockOk(versions)
    const result = await getVersions('42')
    expect(fetch).toHaveBeenCalledWith('/api/notes/42/versions', expect.any(Object))
    expect(result).toEqual(versions)
  })
})

// ---------------------------------------------------------------------------
// restoreVersion
// ---------------------------------------------------------------------------

describe('restoreVersion', () => {
  it('POSTs to /api/notes/<id>/restore/<snapshotId>', async () => {
    const note = { id: '42', body: 'old body' }
    mockOk(note)
    const result = await restoreVersion('42', 'snap-1')
    expect(fetch).toHaveBeenCalledWith(
      '/api/notes/42/restore/snap-1',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual(note)
  })
})

// ---------------------------------------------------------------------------
// uploadAudio
// ---------------------------------------------------------------------------

describe('uploadAudio', () => {
  it('POSTs multipart to /api/notes/<id>/audio and returns updated note', async () => {
    const updated = { id: '7', audio_file_id: 'gfs-1' }
    mockOk(updated)
    const blob = new Blob(['audio'], { type: 'audio/webm' })
    const result = await uploadAudio('7', blob)
    expect(fetch).toHaveBeenCalledWith(
      '/api/notes/7/audio',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    )
    expect(result).toEqual(updated)
  })

  it('throws an error with code when upload fails', async () => {
    mockError(415, { error: 'Unsupported audio format.', code: 'UNSUPPORTED_AUDIO_FORMAT' })
    const blob = new Blob(['audio'])
    await expect(uploadAudio('7', blob)).rejects.toMatchObject({
      message: 'Unsupported audio format.',
      code: 'UNSUPPORTED_AUDIO_FORMAT',
    })
  })

  it('falls back to HTTP status message when response JSON is unparseable', async () => {
    mockErrorBadJson(500)
    const blob = new Blob(['audio'])
    await expect(uploadAudio('7', blob)).rejects.toMatchObject({
      message: 'HTTP 500',
    })
  })
})

// ---------------------------------------------------------------------------
// request() error handling (via any exported function)
// ---------------------------------------------------------------------------

describe('request error handling', () => {
  it('throws an error with message and code from the response body', async () => {
    mockError(404, { error: 'Note not found', code: 'NOT_FOUND' })
    await expect(getNote('bad-id')).rejects.toMatchObject({
      message: 'Note not found',
      code: 'NOT_FOUND',
    })
  })

  it('falls back to "HTTP <status>" when error response JSON is unparseable', async () => {
    mockErrorBadJson(500)
    await expect(getNote('any')).rejects.toMatchObject({ message: 'HTTP 500' })
  })
})
