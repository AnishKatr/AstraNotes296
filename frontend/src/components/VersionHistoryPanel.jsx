import { useCallback, useEffect, useState } from 'react'
import { getVersions, restoreVersion } from '../services/notes'
import MarkdownPreview from './MarkdownPreview'

const CORRUPTED_MARKER = '[Could not decrypt]'

function formatRelative(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years !== 1 ? 's' : ''} ago`
}

export default function VersionHistoryPanel({ noteId, onRestore, onClose, refreshKey = 0 }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [confirmVersion, setConfirmVersion] = useState(null)
  const [restoring, setRestoring] = useState(false)

  const loadVersions = useCallback(() => {
    setLoading(true)
    setError(null)
    getVersions(noteId)
      .then(data => setVersions(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [noteId, refreshKey])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  async function handleConfirmRestore() {
    if (!confirmVersion) return
    setRestoring(true)
    try {
      const restoredNote = await restoreVersion(noteId, confirmVersion.snapshot_id)
      setConfirmVersion(null)
      loadVersions()
      onRestore(restoredNote)
    } catch (err) {
      setError(err.message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col w-72 shrink-0 border-l border-gray-200 bg-gray-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 shrink-0">
        <h2 className="text-sm font-semibold text-gray-700">Version History</h2>
        <button
          onClick={onClose}
          aria-label="Close history panel"
          className="text-gray-400 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <p className="text-sm text-gray-400 p-4">Loading…</p>}
        {error && <p className="text-sm text-red-600 p-4">Error: {error}</p>}
        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-gray-400 p-4">No previous versions yet.</p>
        )}
        {!loading && !error && versions.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {versions.map(v => {
              const isCorrupted = v.body_preview === CORRUPTED_MARKER
              return (
                <li key={v.snapshot_id} className="p-3 space-y-1.5">
                  <span
                    title={new Date(v.timestamp).toLocaleString()}
                    className="block text-xs text-gray-500"
                  >
                    {formatRelative(v.timestamp)}
                  </span>

                  {isCorrupted ? (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      Could not decrypt
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 line-clamp-2">{v.body_preview}</p>
                  )}

                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      onClick={() => setPreviewId(prev => prev === v.snapshot_id ? null : v.snapshot_id)}
                      disabled={isCorrupted}
                      className="text-xs px-2 py-0.5 border border-gray-200 rounded hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {previewId === v.snapshot_id ? 'Hide' : 'Preview'}
                    </button>
                    <button
                      onClick={() => setConfirmVersion(v)}
                      disabled={isCorrupted}
                      className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Restore
                    </button>
                  </div>

                  {previewId === v.snapshot_id && (
                    <div className="mt-1 p-2 bg-white border border-gray-200 rounded overflow-auto max-h-40 text-xs">
                      <MarkdownPreview content={v.body_preview} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {confirmVersion && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={e => { if (e.target === e.currentTarget) setConfirmVersion(null) }}
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-gray-700 mb-5">
              This will replace the current note with the selected version. The current state will also be saved as a new version. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmVersion(null)}
                className="text-sm px-3 py-1.5 border border-gray-200 rounded hover:border-gray-400 text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoring}
                className="text-sm px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {restoring ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
