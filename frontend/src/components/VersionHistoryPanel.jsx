import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
    <div className="flex flex-col w-72 shrink-0 border-l border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Version History</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close history panel"
          className="h-7 w-7 text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading && <p className="text-sm text-muted-foreground p-4">Loading…</p>}
        {error && <p className="text-sm text-destructive p-4">Error: {error}</p>}
        {!loading && !error && versions.length === 0 && (
          <p className="text-sm text-muted-foreground p-4">No previous versions yet.</p>
        )}
        {!loading && !error && versions.length > 0 && (
          <ul className="divide-y divide-border">
            {versions.map(v => {
              const isCorrupted = v.body_preview === CORRUPTED_MARKER
              return (
                <li key={v.snapshot_id} className="p-3 space-y-1.5">
                  <span
                    title={new Date(v.timestamp).toLocaleString()}
                    className="block text-xs text-muted-foreground"
                  >
                    {formatRelative(v.timestamp)}
                  </span>

                  {isCorrupted ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle aria-hidden="true" className="w-3 h-3 shrink-0" />
                      Could not decrypt
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground line-clamp-2">{v.body_preview}</p>
                  )}

                  <div className="flex gap-1.5 pt-0.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewId(prev => prev === v.snapshot_id ? null : v.snapshot_id)}
                      disabled={isCorrupted}
                      className="text-xs px-2 py-0.5 h-auto"
                    >
                      {previewId === v.snapshot_id ? 'Hide' : 'Preview'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmVersion(v)}
                      disabled={isCorrupted}
                      className="text-xs px-2 py-0.5 h-auto"
                    >
                      Restore
                    </Button>
                  </div>

                  {previewId === v.snapshot_id && (
                    <div className="mt-1 p-2 bg-background border border-border rounded overflow-auto max-h-40 text-xs">
                      <MarkdownPreview content={v.body_preview} />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Restore confirmation dialog */}
      <Dialog open={!!confirmVersion} onOpenChange={open => !open && setConfirmVersion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore version</DialogTitle>
            <DialogDescription>
              This will replace the current note with the selected version. The current state will also be saved as a new version. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmVersion(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRestore} disabled={restoring}>
              {restoring ? 'Restoring…' : 'Restore'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
