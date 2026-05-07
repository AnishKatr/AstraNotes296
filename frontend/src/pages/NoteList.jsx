import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listNotes } from '../services/notes'

export default function NoteList() {
  const [notes, setNotes] = useState([])
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    listNotes()
      .then(data => setNotes(data.notes))
      .catch(err => setError(err.message))
  }, [])

  function formatDate(iso) {
    return new Date(iso).toLocaleString()
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">AstraNotes</h1>
        <button
          onClick={() => navigate('/notes/new')}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-sm"
        >
          New note
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">Error: {error}</p>
      )}

      {notes.length === 0 && !error && (
        <p className="text-gray-400 text-sm">No notes yet. Create one above.</p>
      )}

      <ul className="space-y-2">
        {notes.map(note => (
          <li key={note.id}>
            <button
              onClick={() => navigate(`/notes/${note.id}`)}
              className="w-full text-left bg-white border border-gray-200 rounded p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <p className="font-medium text-gray-900 truncate">{note.title}</p>
              <p className="text-gray-400 text-xs mt-1">{formatDate(note.updated_at)}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
