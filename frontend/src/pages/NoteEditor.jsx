import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MarkdownPreview from '../components/MarkdownPreview'
import { createNote, deleteNote, getNote, updateNote } from '../services/notes'

export default function NoteEditor() {
  const { id } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    getNote(id)
      .then(note => {
        setTitle(note.title)
        setBody(note.body)
      })
      .catch(err => setError(err.message))
  }, [id, isNew])

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      if (isNew) {
        const note = await createNote({ title, body, note_type: 'text' })
        navigate(`/notes/${note.id}`, { replace: true })
      } else {
        await updateNote(id, { title, body })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this note?')) return
    try {
      await deleteNote(id)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          &larr; Back
        </button>
        <div className="flex gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded hover:border-red-400"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded hover:bg-indigo-700 text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-2">Error: {error}</p>}

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full text-xl font-semibold border-0 border-b border-gray-200 pb-2 mb-3 focus:outline-none focus:border-indigo-400"
      />

      <div className="flex flex-col md:flex-row flex-1 gap-0 border border-gray-200 rounded overflow-hidden min-h-0">
        <textarea
          aria-label="Markdown editor"
          placeholder="Write your note in Markdown…"
          value={body}
          onChange={e => setBody(e.target.value)}
          className="flex-1 p-4 text-sm text-gray-700 font-mono resize-none focus:outline-none border-b md:border-b-0 md:border-r border-gray-200"
        />
        <div className="flex-1 p-4 overflow-auto bg-white">
          <MarkdownPreview content={body} />
        </div>
      </div>
    </div>
  )
}
