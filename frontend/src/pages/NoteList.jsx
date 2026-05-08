import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listNotes } from '../services/notes'

const TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'voice', label: 'Voice' },
  { value: 'secure', label: 'Secure' },
]

const PAGE_SIZE = 20

export default function NoteList() {
  const [inputValue, setInputValue] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [notes, setNotes] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  // Debounce: propagate inputValue to query after 300 ms of inactivity.
  useEffect(() => {
    const id = setTimeout(() => setQuery(inputValue.trim()), 300)
    return () => clearTimeout(id)
  }, [inputValue])

  // Fresh fetch whenever the committed query or type filter changes.
  useEffect(() => {
    setLoading(true)
    setError(null)
    listNotes({ q: query || undefined, type: typeFilter || undefined, limit: PAGE_SIZE })
      .then(data => {
        setNotes(data.notes)
        setNextCursor(data.next_cursor)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [query, typeFilter])

  function handleClear() {
    setInputValue('')
    setQuery('')   // bypass the 300 ms delay on clear
  }

  function handleLoadMore() {
    setLoadingMore(true)
    listNotes({
      q: query || undefined,
      type: typeFilter || undefined,
      limit: PAGE_SIZE,
      cursor: nextCursor,
    })
      .then(data => {
        setNotes(prev => [...prev, ...data.notes])
        setNextCursor(data.next_cursor)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoadingMore(false))
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString()
  }

  const isFiltering = query || typeFilter
  const isEmpty = notes.length === 0 && !loading && !error

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

      {/* Search bar + type filter */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <input
            type="text"
            placeholder="Search notes..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="w-full border border-gray-200 rounded px-3 py-2 pr-8 text-sm focus:outline-none focus:border-indigo-400"
          />
          {inputValue && (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                typeFilter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          Secure note contents are not searchable.
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-4">Error: {error}</p>
      )}

      {isEmpty && (
        isFiltering
          ? <p className="text-gray-400 text-sm">No notes match your search.</p>
          : <p className="text-gray-400 text-sm">No notes yet. Create one above.</p>
      )}

      <ul className="space-y-2">
        {notes.map(note => (
          <li key={note.id}>
            <button
              onClick={() => navigate(`/notes/${note.id}`)}
              className="w-full text-left bg-white border border-gray-200 rounded p-4 hover:border-indigo-300 hover:shadow-sm transition"
            >
              <div className="flex items-center gap-2">
                {note.note_type === 'secure' && (
                  <svg
                    aria-label="Encrypted note"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 text-indigo-400 shrink-0"
                  >
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
                <p className="font-medium text-gray-900 truncate">{note.title}</p>
              </div>
              <p className="text-gray-400 text-xs mt-1">{formatDate(note.updated_at)}</p>
            </button>
          </li>
        ))}
      </ul>

      {nextCursor && (
        <div className="mt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-sm text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
