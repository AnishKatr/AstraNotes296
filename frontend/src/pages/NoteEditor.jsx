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
  const [isSecure, setIsSecure] = useState(false)
  const [error, setError] = useState(null)
  const [decryptionFailed, setDecryptionFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    getNote(id)
      .then(note => {
        setTitle(note.title)
        setBody(note.body ?? '')
        setIsSecure(note.note_type === 'secure')
      })
      .catch(err => {
        if (err.code === 'DECRYPTION_FAILED') {
          setDecryptionFailed(true)
        } else {
          setError(err.message)
        }
      })
  }, [id, isNew])

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      if (isNew) {
        const note = await createNote({ title, body, note_type: isSecure ? 'secure' : 'text' })
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

      {decryptionFailed ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-red-600 text-sm">This note could not be decrypted.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              placeholder="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="flex-1 text-xl font-semibold border-0 border-b border-gray-200 pb-2 focus:outline-none focus:border-indigo-400"
            />
            {!isNew && isSecure && (
              <span className="shrink-0 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5">
                Encrypted
              </span>
            )}
          </div>

          {isNew && (
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSecure}
                onChange={e => setIsSecure(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Mark as Secure (encrypted)
            </label>
          )}

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
        </>
      )}
    </div>
  )
}
