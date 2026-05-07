const BASE = '/api/notes'

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export function listNotes() {
  return request(BASE)
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
