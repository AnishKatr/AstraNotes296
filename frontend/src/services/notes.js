const BASE = '/api/notes'

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `HTTP ${res.status}`)
    err.code = body.code
    throw err
  }
  if (res.status === 204) return null
  return res.json()
}

export function listNotes({ q, type, limit, cursor } = {}) {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (type) params.set('type', type)
  if (limit != null) params.set('limit', String(limit))
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return request(qs ? `${BASE}?${qs}` : BASE)
}

export function getNote(id) {
  return request(`${BASE}/${id}`)
}

export function createNote(data) {
  return request(BASE, { method: 'POST', body: JSON.stringify(data) })
}

export function updateNote(id, data) {
  return request(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

export function deleteNote(id) {
  return request(`${BASE}/${id}`, { method: 'DELETE' })
}

export function getVersions(id) {
  return request(`${BASE}/${id}/versions`)
}

export function restoreVersion(id, snapshotId) {
  return request(`${BASE}/${id}/restore/${snapshotId}`, { method: 'POST' })
}
